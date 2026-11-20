import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Starts the two Arabic font files with the page instead of after the stylesheet is read, so names
 * are drawn in Amiri from the first frame and the menu cards do not move when it arrives (CLS).
 * Skipped for the Artifact build, whose fonts are already inside the page.
 */
function preloadFonts(): Plugin {
  const wanted = /(?:amiri-arabic-700-normal|cairo-arabic-wght-normal)-[\w-]+\.woff2$/
  let base = '/'
  return {
    name: 'km-preload-fonts',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        return Object.keys(ctx.bundle ?? {})
          .filter((file) => wanted.test(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: base + file, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

/**
 * Writes 404.html next to index.html: Cloudflare Pages answers an unknown address with it and a
 * 404 status (see public/_redirects). It is the same app, which then shows its own not-found page.
 */
function notFoundPage(): Plugin {
  let outDir = 'dist'
  return {
    name: 'km-404-page',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle() {
      copyFileSync(`${outDir}/index.html`, `${outDir}/404.html`)
    },
  }
}

/** Menu photos are named after items in Arabic; their built copies get plain names that any host serves. */
function assetName(asset: { originalFileNames?: readonly string[] }): string {
  return asset.originalFileNames?.some((f) => f.includes('menu-images/')) ? 'assets/menu-[hash][extname]' : 'assets/[name]-[hash][extname]'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'artifact' ? [] : [preloadFonts(), notFoundPage()])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The Artifact preview must stay one file, so it keeps the staff screens in the main bundle.
  // Fonts and the logo are inlined; menu photos stay separate files published next to the page,
  // or 141 photos would push the single page past the Artifact size limit.
  build:
    mode === 'artifact'
      ? {
          rolldownOptions: { output: { codeSplitting: false, assetFileNames: assetName } },
          assetsInlineLimit: (file: string) => !file.includes('/menu-images/'),
        }
      : { rolldownOptions: { output: { assetFileNames: assetName } } },
}))
