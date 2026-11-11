"""Extract the Tagamoa menu (black PDF, "FINAL Menu - RESTURANT") from its text layer.

Usage:  pip install pdfplumber
        python3 -I extract_menu_tagamoa.py <menu.pdf> <out.csv>

Prices are paired with item names by page position (same text line, nearest name to the
right of the price). Nothing is guessed: any number that is not paired is reported.
Category names, size labels and description separators are normalised to the same
vocabulary used by menu_ashry_zagazig.csv. Output columns:
category,item,size_label,price,description,advance_notice_hours,status,note,source
"""
import csv
import re
import sys
import unicodedata

import pdfplumber

LIGATURES = {
    "ﻵ": "لآ", "ﻶ": "لآ", "ﻷ": "لأ", "ﻸ": "لأ",
    "ﻹ": "لإ", "ﻺ": "لإ", "ﻻ": "لا", "ﻼ": "لا",
}
PRIV = {chr(0xE000 + i): v for i, v in enumerate(LIGATURES.values())}
PRIV_OF = {k: chr(0xE000 + i) for i, k in enumerate(LIGATURES)}
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
LETTER = re.compile(r"[ء-ي]")


def fix(text):
    """Visual-order PDF word -> logical Arabic text with ASCII digits."""
    for lig, priv in PRIV_OF.items():
        text = text.replace(lig, priv)
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[‎‏‪-‮⁦-⁩]", "", text)
    text = text.translate(DIGITS)
    if LETTER.search(text):
        text = text[::-1]
        text = text.translate(str.maketrans("()", ")("))
    for priv, seq in PRIV.items():
        text = text.replace(priv, seq)
    return text


def is_num(t):
    return re.fullmatch(r"\d+", t) is not None


# (page index, price x1 positions, y range, category, size labels by price x1 or None, has description)
SIZES_GRILL = {1001: "ربع", 926: "تلت", 851: "نصف"}
CATEGORY_MAP = {
    "المشويات": "المشويات",
    "الاطباق الرئيسية": "الأطباق الرئيسية",
    "اطباق جانبية": "الأطباق الجانبية",
    "العزايم والعقائق": "العزائم والعقائق",
    "طاسات": "الطاسات",
}
SIZE_MAP = {"نصف": "نص"}
# Prices that look inconsistent with their neighbours; kept as printed but flagged "check".
CHECKS = {
    ("ستيك بقري", "تلت"): "سعر الثلث 515 بينما باقي أصناف فئة 750 سعر الثلث فيها 505، تحقق من الطباعة",
}
WINDOWS = [
    (0, [847], (90, 245), "المشويات", None, False),
    (0, [1001, 926, 851], (280, 720), "المشويات", SIZES_GRILL, False),
    (0, [67], (110, 190), "الاطباق الرئيسية", None, False),
    (0, [67], (370, 590), "الصواني", None, True),
    (0, [438], (410, 510), "الحلو", None, False),
    (0, [641], (410, 640), "المشروبات", None, False),
    (1, [469], (120, 640), "الطواجن", None, False),
    (1, [469], (680, 780), "الفتة", None, False),
    (1, [1008], (160, 335), "الشوربة", None, False),
    (1, [1008], (395, 620), "المقبلات", None, False),
    (1, [837], (160, 560), "السلطات", None, False),
    (1, [1006, 834], (695, 815), "اطباق جانبية", None, False),
    (1, [231], (180, 270), "الروستو", None, False),
    (1, [53], (175, 265), "العزايم والعقائق", None, False),
    (1, [53], (350, 415), "المندي", None, False),
    (1, [54], (475, 620), "طاسات", None, False),
    (1, [51], (675, 765), "الساندوتشات", None, False),
]
TOL_X = 6
TOL_Y = 8


def near(x, targets):
    for t in targets:
        if abs(x - t) <= TOL_X:
            return t
    return None


def main(pdf_path, out_path):
    rows = []
    claimed = set()
    all_prices = []
    with pdfplumber.open(pdf_path) as pdf:
        for pi, page in enumerate(pdf.pages):
            words = page.extract_words(x_tolerance=2, y_tolerance=3)
            for w in words:
                w["t"] = fix(w["text"])
            for win_i, (wp, pxs, (y0, y1), cat, sizes, has_desc) in enumerate(WINDOWS):
                if wp != pi:
                    continue
                prices = [w for w in words if is_num(w["t"]) and y0 <= w["top"] <= y1 and near(w["x1"], pxs) is not None]
                NOTE_WORDS = {"حجز", "مسبق", "ساعة"}
                arabic = [w for w in words if (LETTER.search(w["t"]) or "(" in w["t"] or ")" in w["t"]) and w["t"] not in NOTE_WORDS]
                lines = {}
                for p in prices:
                    cands = [w for w in arabic if abs(w["top"] - p["top"]) <= TOL_Y and w["x0"] > p["x1"] + 2]
                    if not cands:
                        raise SystemExit(f"no name for price {p['t']} page {pi+1} y={p['top']:.1f}")
                    start = min(cands, key=lambda w: w["x0"])
                    chain = [start]
                    while True:
                        nxt = [w for w in cands if w["x0"] > chain[-1]["x1"] - 1 and w["x0"] - chain[-1]["x1"] <= 14 and w not in chain]
                        # stop if a digit word sits between (another column's price)
                        if not nxt:
                            break
                        chain.append(min(nxt, key=lambda w: w["x0"]))
                    name = " ".join(w["t"] for w in sorted(chain, key=lambda w: -w["x1"]))
                    key = (round(min(w["top"] for w in chain) / 4), name)
                    entry = lines.setdefault(key, {"name": name, "top": min(w["top"] for w in chain), "x1": max(c["x1"] for c in chain), "x0": min(c["x0"] for c in chain), "prices": []})
                    entry["prices"].append((near(p["x1"], pxs), int(p["t"])))
                    claimed.add((pi, round(p["x0"]), round(p["top"])))
                ordered = sorted(lines.values(), key=lambda e: e["top"])
                for idx, e in enumerate(ordered):
                    note = ""
                    name = e["name"]
                    m = re.search(r"\(([^)]*)\)", name)
                    if m:
                        note = m.group(1)
                        name = re.sub(r"\s*\([^)]*\)", "", name).strip()
                    desc = ""
                    if has_desc:
                        nxt_top = ordered[idx + 1]["top"] if idx + 1 < len(ordered) else e["top"] + 75
                        dwords = [w for w in words if e["top"] + 9 < w["top"] < nxt_top - 6 and 72 < w["x1"] <= 400]
                        clusters = []
                        for w in sorted(dwords, key=lambda w: w["top"]):
                            if clusters and w["top"] - clusters[-1][-1]["top"] <= 5:
                                clusters[-1].append(w)
                            else:
                                clusters.append([w])
                        parts = [" ".join(w["t"] for w in sorted(c, key=lambda w: -w["x1"])) for c in clusters]
                        desc = ""
                        for part in parts:
                            if not desc:
                                desc = part
                            elif part.startswith("-") or desc.endswith("-"):
                                desc += " " + part
                            else:
                                desc += " - " + part
                    advance = ""
                    for w in words:
                        if w["t"] == "حجز" and abs(w["top"] - e["top"]) <= 10 and pi == 1 and cat == "الروستو":
                            advance = 24
                    ps = sorted(e["prices"], key=lambda z: -z[0])
                    desc = desc.replace(" - ", " + ")
                    if advance:
                        note = (note + " | " if note else "") + "حجز مسبق 24 ساعة"
                    for px, val in ps:
                        size = SIZE_MAP.get(sizes[px], sizes[px]) if sizes else ""
                        status, extra = "ok", ""
                        if (name, size) in CHECKS:
                            status, extra = "check", CHECKS[(name, size)]
                        full_note = " | ".join(x for x in (note, extra) if x)
                        rows.append([CATEGORY_MAP.get(cat, cat), name, size, val, desc, advance, status, full_note, f"p{pi+1}"])
            # every price-looking number in the grid must be claimed
            cols = [847, 1001, 926, 851, 67, 438, 641] if pi == 0 else [469, 1008, 837, 1006, 834, 231, 53, 54, 51]
            all_prices.extend((pi, w) for w in words if is_num(w["t"]) and near(w["x1"], cols) is not None and not re.match(r"^0\d{8,}", w["t"]))
    unclaimed = [(pi + 1, w["t"], round(w["x0"]), round(w["top"])) for pi, w in all_prices if (pi, round(w["x0"]), round(w["top"])) not in claimed]
    with open(out_path, "w", newline="", encoding="utf-8-sig") as fh:
        wr = csv.writer(fh)
        wr.writerow(["category", "item", "size_label", "price", "description", "advance_notice_hours", "status", "note", "source"])
        wr.writerows(rows)
    print(f"rows: {len(rows)}")
    print("unclaimed numbers (page, text, x, y):", unclaimed)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
