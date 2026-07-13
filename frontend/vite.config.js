import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const backendPort = 8001
const backendOrigin = `http://127.0.0.1:${backendPort}`

function isLocalBackendTarget(target) {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1):8001\/?$/.test(target || '')
}

async function backendHealthOk() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 700)

  try {
    const response = await fetch(`${backendOrigin}/health/backend`, {
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))

    return response.ok && data?.status === 'ok'
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForBackendHealth(timeoutMs = 20_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await backendHealthOk()) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return false
}

function backendPython() {
  const candidates = process.platform === 'win32'
    ? [
        path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
        'python',
        'py',
      ]
    : [
        path.join(projectRoot, '.venv', 'bin', 'python'),
        'python3',
        'python',
      ]

  return candidates.find((candidate) => candidate.includes(path.sep) ? existsSync(candidate) : true)
}

function stopBackend(child) {
  if (!child?.pid || child.killed) return
  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  child.kill('SIGTERM')
}

function localBackendPlugin(proxyTarget) {
  return {
    name: 'debatehelp-local-backend',
    apply: 'serve',
    async configureServer(server) {
      if (!isLocalBackendTarget(proxyTarget)) return
      if (process.env.VITE_AUTO_START_BACKEND === 'false') return
      if (await backendHealthOk()) {
        server.config.logger.info('DebateHelp backend is healthy on http://localhost:8001')
        return
      }

      const python = backendPython()
      const child = spawn(
        python,
        ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(backendPort)],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
            CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      )

      server.config.logger.info('Starting DebateHelp backend on http://localhost:8001')

      child.stdout.on('data', (chunk) => {
        server.config.logger.info(`[backend] ${chunk.toString().trimEnd()}`)
      })
      child.stderr.on('data', (chunk) => {
        server.config.logger.warn(`[backend] ${chunk.toString().trimEnd()}`)
      })
      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          server.config.logger.error(`DebateHelp backend exited with code ${code}.`)
        }
      })

      server.httpServer?.once('close', () => stopBackend(child))
      process.once('SIGINT', () => stopBackend(child))
      process.once('SIGTERM', () => stopBackend(child))
      process.once('exit', () => stopBackend(child))

      if (await waitForBackendHealth()) {
        server.config.logger.info('DebateHelp backend ready on http://localhost:8001')
      } else {
        server.config.logger.warn(
          'DebateHelp backend did not pass /health/backend yet; check the backend logs above before using /api requests.',
        )
      }
    },
  }
}

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
      localBackendPlugin(proxyTarget),
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
