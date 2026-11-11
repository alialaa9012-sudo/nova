"""Convert a delivery-fee page (HTML) or its JSON backup into a zones CSV.

Usage (stdlib only):
  python3 -I import_zones.py --branch zagazig --html page.html   --out ../delivery_zones_zagazig.csv
  python3 -I import_zones.py --branch ashry   --backup backup.json --out ../delivery_zones_ashry.csv

--html    reads the ORIGINAL list embedded in the staff page (edits saved in a staff browser
          are NOT inside the file).
--backup  reads the text produced by the page's "نسخة احتياطية / استرجاع" button, which is the
          latest list as edited by staff. Prefer this when it is available.

Nothing is guessed. A zone is exported as status=pending (hidden from the customer app until
the owner decides) when its fee is a range or has two values, or when the source carries a note.
Same-name rows with the same fee are merged. Near-identical names with different fees are
flagged status=review (they stay active).
Columns: branch,zone_type,zone_name,fee_min,fee_max,status,note,source
"""
import argparse
import csv
import json
import re
import sys

BRANCHES = {"ashry": "العاشر من رمضان", "zagazig": "الزقازيق", "tagamoa": "التجمع الخامس"}
TYPE_NAMES = {"m": "مجاورة", "h": "حي", "c": "كود", "n": "منطقة"}
TYPE_ORDER = ["مجاورة", "حي", "كود", "منطقة"]


def norm(s):
    s = re.sub(r"[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"\s+", " ", s).strip()


def split_top(s):
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch in "([":
            depth += 1
        if ch in ")]":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p for p in parts if p.strip()]


def match_close(s, start):
    depth = 0
    for i in range(start, len(s)):
        if s[i] in "([":
            depth += 1
        elif s[i] in ")]":
            depth -= 1
            if depth == 0:
                return i
    raise ValueError("unbalanced expression")


def ev(expr):
    """Tiny evaluator for the JS list expressions used by the Ashry page: R(a,b), [..], X.concat(..)."""
    s = expr.strip()
    if s.startswith("R("):
        end = match_close(s, 1)
        a, b = (int(x) for x in s[2:end].split(","))
        res, rest = list(range(a, b + 1)), s[end + 1:]
    elif s.startswith("["):
        end = match_close(s, 0)
        res, rest = [int(x) for x in split_top(s[1:end])], s[end + 1:]
    else:
        raise ValueError(f"unsupported expression: {expr[:40]}")
    while rest.startswith(".concat("):
        end = match_close(rest, len(".concat"))
        for arg in split_top(rest[len(".concat(") : end]):
            res += ev(arg)
        rest = rest[end + 1:]
    return res


def from_html(branch, src):
    if branch in ("zagazig", "tagamoa"):
        d = json.loads(re.search(r"var D=(\[.*?\]);\n", src, re.S).group(1))
        return [dict(t="منطقة", n=r[0], p=r[1], w=(r[2] if len(r) > 2 else "")) for r in d]
    store = {"M": {}, "H": {}}
    for m in re.finditer(r"([MH])\.a\(", src):
        end = match_close(src, m.end() - 1)
        price, expr = src[m.end():end].split(",", 1)
        for n in ev(expr):
            store[m.group(1)].setdefault(n, [])
            if int(price) not in store[m.group(1)][n]:
                store[m.group(1)][n].append(int(price))
    out = [dict(t="مجاورة", n=str(n), p=v, w="") for n, v in store["M"].items()]
    out += [dict(t="حي", n=str(n), p=v, w="") for n, v in store["H"].items()]
    c = re.search(r"var C=\{(.*?)\};", src, re.S).group(1)
    out += [dict(t="كود", n=k, p=[int(x) for x in v.split(",")], w="") for k, v in re.findall(r"(\w+):\[([\d,]+)\]", c)]
    block = re.search(r"var N=\[(.*?)\];\n", src, re.S).group(1)
    out += [dict(t="منطقة", n=r[0], p=[int(r[1])], w=r[2]) for r in re.findall(r'\["([^"]+)",(\d+)(?:,"([^"]+)")?\]', block)]
    return out


def from_backup(branch, text):
    d = json.loads(text)
    if branch == "ashry":
        return [dict(t=TYPE_NAMES[r["t"]], n=str(r["n"]), p=list(r["p"]), w=r.get("w", "")) for r in d]
    return [dict(t="منطقة", n=str(r["n"]), p=str(r["p"]), w=r.get("w", "")) for r in d]


def prices_of(p):
    if isinstance(p, list):
        return [int(x) for x in p]
    return [int(x) for x in re.findall(r"\d+", str(p))]


def build(zones):
    rows, seen = [], {}
    for z in zones:
        ps = prices_of(z["p"])
        raw = z["p"] if isinstance(z["p"], str) else None
        lo, hi = min(ps), max(ps)
        note, status = z["w"].strip(), "ok"
        if len(ps) > 1 or (raw and re.search(r"\d\s*[-–/]\s*\d", raw)):
            status = "pending"
            what = f"مدى سعري مكتوب {raw}" if raw else "سعران في الملف: " + " و".join(map(str, sorted(ps)))
            note = (note + " | " if note else "") + what
        elif note:
            status = "pending"
            note = "ملاحظة في الملف: " + note
        key = (z["t"], norm(z["n"]))
        if key in seen:
            prev = seen[key]
            if (prev["fee_min"], prev["fee_max"]) == (lo, hi):
                prev["note"] = (prev["note"] + " | " if prev["note"] else "") + "مكرر في الملف الأصلي بنفس السعر وتم دمجه"
                continue
            for r in (prev, None):
                if r:
                    r["status"] = "pending"
                    r["note"] = (r["note"] + " | " if r["note"] else "") + "نفس الاسم بسعر مختلف في الملف"
            status, note = "pending", (note + " | " if note else "") + "نفس الاسم بسعر مختلف في الملف"
        row = dict(zone_type=z["t"], zone_name=z["n"].strip(), fee_min=lo, fee_max=hi, status=status, note=note)
        seen[key] = row
        rows.append(row)
    named = [r for r in rows if r["zone_type"] == "منطقة" and r["status"] == "ok"]
    for i, a in enumerate(named):
        for b in named[i + 1:]:
            na, nb = norm(a["zone_name"]), norm(b["zone_name"])
            if na != nb and min(len(na), len(nb)) >= 5 and (na in nb or nb in na) and a["fee_min"] != b["fee_min"]:
                for x, y in ((a, b), (b, a)):
                    x["status"] = "review"
                    x["note"] = (x["note"] + " | " if x["note"] else "") + f"يتداخل اسمياً مع «{y['zone_name']}» بسعر {y['fee_min']}"
    def sort_key(r):
        name = r["zone_name"]
        return (TYPE_ORDER.index(r["zone_type"]), 0 if name.isdigit() else 1, int(name) if name.isdigit() else 0, norm(name))
    return sorted(rows, key=sort_key)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--branch", required=True, choices=BRANCHES)
    ap.add_argument("--html")
    ap.add_argument("--backup")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if bool(a.html) == bool(a.backup):
        sys.exit("give exactly one of --html or --backup")
    if a.html:
        zones, source = from_html(a.branch, open(a.html, encoding="utf-8").read()), "html-seed"
    else:
        zones, source = from_backup(a.branch, open(a.backup, encoding="utf-8").read()), "backup"
    rows = build(zones)
    with open(a.out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["branch", "zone_type", "zone_name", "fee_min", "fee_max", "status", "note", "source"])
        for r in rows:
            w.writerow([BRANCHES[a.branch], r["zone_type"], r["zone_name"], r["fee_min"], r["fee_max"], r["status"], r["note"], source])
    counts = {s: sum(r["status"] == s for r in rows) for s in ("ok", "review", "pending")}
    print(f"{a.branch}: {len(rows)} zones {counts} -> {a.out}")


if __name__ == "__main__":
    main()
