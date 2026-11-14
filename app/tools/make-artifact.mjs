// Packs the "artifact" build (npm run build:artifact) into one self-contained page for a
// claude.ai Artifact: the script and the stylesheet are inlined, and fonts are already
// data URIs inside the CSS. The viewer wraps the file in its own <html>/<head>/<body>,
// so this writes page content only. The logo stays a separate file published next to it.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'dist-artifact')
const index = readFileSync(join(dir, 'index.html'), 'utf8')

const pick = (pattern, what) => {
  const hit = index.match(pattern)
  if (!hit) throw new Error(`build output has no ${what}; did the artifact build run?`)
  return readFileSync(join(dir, hit[1]), 'utf8')
}
const script = pick(/<script[^>]+src="\.\/([^"]+\.js)"/, 'script')
const styles = pick(/<link[^>]+href="\.\/([^"]+\.css)"/, 'stylesheet')
for (const [name, text] of [['script', script], ['stylesheet', styles]]) {
  if (/url\(\.?\/?assets\//.test(text) || /["']\.\/assets\//.test(text)) throw new Error(`${name} still points at separate asset files`)
}

const FONT = "'Cairo Variable', 'Geist Variable', sans-serif"
const page = `<title>تطبيق طلبات خليها مشاوي</title>
<script>document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl'</script>
<style>${styles.replaceAll('</style', '<\\/style')}</style>
<style>
/* The viewer's own reset sets a system font on body and is not in a cascade layer, so restate the app's base here. */
:root { color-scheme: light; }
html, body { font-family: ${FONT}; font-size: 16px; line-height: 1.5; }
body { background: var(--background); color: var(--foreground); }
</style>
<div id="root"></div>
<script type="module">${script.replaceAll('</script', '<\\/script')}</script>
`
const out = join(dir, 'khaliha-mashawy-app.html')
writeFileSync(out, page)
console.log(`${out}  ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB`)
