// Runs inside the page: measures layout, touch targets, typography, colour and RTL facts.
export function probe() {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 }
  const label = (e) => (e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.getAttribute('alt') || e.getAttribute('placeholder') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
  const hiddenByModal = (e) => !!e.closest('[aria-hidden="true"],[inert],[data-aria-hidden="true"]')
  const stuck = (t) => { for (let a = t; a && a !== document.body; a = a.parentElement) { const pos = getComputedStyle(a).position; if (pos === 'fixed' || pos === 'sticky') return true } return false }
  const inScroller = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true } return false }
  const interactive = [...document.querySelectorAll('a[href],button,input,select,textarea,[role=button],[role=radio],[role=option],[role=combobox],[tabindex]:not([tabindex="-1"])')].filter(visible).filter((e) => !hiddenByModal(e))
  const onScreen = (r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
  // 1. horizontal overflow
  const docOverflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth
  const offscreen = [...document.querySelectorAll('body *')].filter(visible).filter((e) => { const r = e.getBoundingClientRect(); return (r.right > vw + 1 || r.left < -1) && !inScroller(e) && getComputedStyle(e).position !== 'fixed' }).slice(0, 15).map((e) => ({ el: e.tagName.toLowerCase(), text: label(e), left: Math.round(e.getBoundingClientRect().left), right: Math.round(e.getBoundingClientRect().right) }))
  // 2. clipped / truncated text
  const clipped = [...document.querySelectorAll('body *')].filter(visible).filter((e) => { const cs = getComputedStyle(e); if (!e.textContent.trim()) return false; if (cs.textOverflow === 'ellipsis') return e.scrollWidth > e.clientWidth + 1; const clamp = cs.webkitLineClamp; return clamp && clamp !== 'none' && e.scrollHeight > e.clientHeight + 4 }).slice(0, 20).map((e) => label(e))
  // 3. interactive elements covered by something else (center not reachable)
  const coverInfo = interactive.map((e) => { const r = e.getBoundingClientRect(); if (!onScreen(r)) return null; const x = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1); const t = document.elementFromPoint(x, y); if (!t || t === e || e.contains(t) || t.contains(e) || (e.labels && [...e.labels].some((l) => l.contains(t)))) return null; return { el: label(e), by: label(t), sticky: stuck(t) && !stuck(e) } }).filter(Boolean)
  const covered = coverInfo.filter((c) => !c.sticky).slice(0, 15)
  const underSticky = coverInfo.filter((c) => c.sticky).slice(0, 15)
  // 4. touch targets (effective hit area through elementFromPoint, so pseudo-elements count)
  const targets = interactive.filter((e) => { const r = e.getBoundingClientRect(); return onScreen(r) && (r.width < 44 || r.height < 44) && !e.disabled }).map((e) => {
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const hits = (x, y) => { if (x < 0 || y < 0 || x >= vw || y >= vh) return false; const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t) || (e.labels && [...e.labels].some((l) => l.contains(t)))) }
    let w = 0, h = 0; for (let d = -30; d <= 30; d++) { if (hits(cx + d, cy)) w++; if (hits(cx, cy + d)) h++ }
    return { el: label(e), box: `${Math.round(r.width)}x${Math.round(r.height)}`, hitW: w, hitH: h }
  })
  const tinyTargets = targets.filter((t) => (t.hitW < 24 || t.hitH < 24) && t.hitW > 0 && t.hitH > 0)
  const smallTargets = targets.filter((t) => (t.hitW < 44 || t.hitH < 44) && !(t.hitW < 24 || t.hitH < 24) && t.hitW > 0 && t.hitH > 0)
  // 5. typography
  const textEls = [...document.querySelectorAll('body *')].filter(visible).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1))
  const sizes = {}, families = {}, weights = {}, colors = {}
  for (const e of textEls) { const cs = getComputedStyle(e); const fs = Math.round(parseFloat(cs.fontSize)); sizes[fs] = (sizes[fs] || 0) + 1; const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); families[fam] = (families[fam] || 0) + 1; weights[cs.fontWeight] = (weights[cs.fontWeight] || 0) + 1; colors[cs.color] = (colors[cs.color] || 0) + 1 }
  const smallText = textEls.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).slice(0, 10).map((e) => ({ text: label(e), size: getComputedStyle(e).fontSize }))
  // 6. buttons: sizes, radii and backgrounds of visible buttons (consistency)
  const btns = interactive.filter((e) => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button' || (e.tagName === 'A' && getComputedStyle(e).display !== 'inline'))
  const btnHeights = {}, radii = {}, btnBg = {}
  for (const e of btns) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); btnHeights[Math.round(r.height)] = (btnHeights[Math.round(r.height)] || 0) + 1; radii[cs.borderRadius] = (radii[cs.borderRadius] || 0) + 1; const bg = cs.backgroundImage !== 'none' ? 'gradient' : cs.backgroundColor; btnBg[bg] = (btnBg[bg] || 0) + 1 }
  // 7. images
  const imgs = [...document.images]
  const brokenImages = imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src'))
  const noAlt = imgs.filter((i) => !i.hasAttribute('alt')).length
  const oversized = imgs.filter((i) => visible(i) && i.naturalWidth > 0 && i.naturalWidth > i.getBoundingClientRect().width * 2.5 * (window.devicePixelRatio || 1)).map((i) => ({ src: (i.getAttribute('src') || '').slice(-40), natural: i.naturalWidth, shown: Math.round(i.getBoundingClientRect().width) })).slice(0, 5)
  // 8. RTL and Arabic
  const arabic = /[؀-ۿ]/
  const ltrArabic = textEls.filter((e) => getComputedStyle(e).direction === 'ltr' && arabic.test(e.textContent) && !e.closest('[dir=ltr]')).slice(0, 10).map(label)
  const leftAligned = textEls.filter((e) => getComputedStyle(e).textAlign === 'left' && arabic.test(e.textContent)).slice(0, 10).map(label)
  // 9. structure
  const h1 = document.querySelectorAll('h1').length
  const headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map((h) => `${h.tagName}:${label(h)}`).slice(0, 25)
  return { vw, vh, pageHeight: document.documentElement.scrollHeight, dir: document.documentElement.dir, lang: document.documentElement.lang, title: document.title, docOverflowX, offscreen, clipped, covered, underSticky, tinyTargets, smallTargets, interactiveCount: interactive.length, sizes, minFont: Math.min(...Object.keys(sizes).map(Number)), smallText, families, weights, textColors: Object.keys(colors).length, colors, btnHeights, radii, btnBg, brokenImages, noAlt, oversized, ltrArabic, leftAligned, h1, headings }
}
