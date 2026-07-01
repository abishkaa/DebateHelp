import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredApiBaseUrl = env.VITE_API_BASE_URL
  const apiBaseUrl = configuredApiBaseUrl ?? (mode === 'production' ? '' : '/api')
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET
    ?? (/^https?:\/\//.test(configuredApiBaseUrl || '') ? configuredApiBaseUrl : 'http://localhost:8001')
  const apiOrigin = /^https?:\/\//.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : ''
  const stylePolicy = mode === 'production' ? "'self'" : "'self' 'unsafe-inline'"

  return {
    plugins: [
      react(),
      {
        name: 'debatehelp-security-policy',
        transformIndexHtml(html) {
          return html
            .replaceAll('__API_ORIGIN__', apiOrigin)
            .replaceAll('__STYLE_POLICY__', stylePolicy)
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
