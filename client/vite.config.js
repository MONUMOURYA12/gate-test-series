import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = process.env.VITE_SITE_URL || env.VITE_SITE_URL || process.env.RENDER_EXTERNAL_URL || ''
  if (siteUrl) {
    const url = new URL(siteUrl)
    if (url.origin !== siteUrl || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error('VITE_SITE_URL must be a complete web origin without a path or trailing slash.')
    }
  }
  return {
  define: siteUrl ? { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) } : {},
  plugins: [react(), {
    name: 'deployment-seo-origin',
    async writeBundle(options) {
      if (!siteUrl) return
      for (const name of ['robots.txt', 'sitemap.xml']) {
        const target = resolve(options.dir, name)
        const content = await readFile(target, 'utf8')
        await writeFile(target, content.replaceAll('https://your-domain.example', siteUrl))
      }
    },
  }],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/question-media": "http://127.0.0.1:5000",
    },
  },
  }
})
