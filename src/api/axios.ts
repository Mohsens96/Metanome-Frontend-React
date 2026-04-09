import axios from 'axios'

const pickEnv = (key: string): string | undefined => {
  const metaValue = (import.meta.env as any)?.[key]
  if (metaValue) return metaValue as string
  if (typeof process !== 'undefined' && (process as any)?.env) {
    const procValue = (process as any).env[key]
    if (procValue) return procValue as string
  }
  return undefined
}

const resolveBaseURL = (): string => {
  const explicit = pickEnv('VITE_API_URL')
  if (explicit) {
    return explicit.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const host = window.location.hostname || 'localhost'
    const port = pickEnv('VITE_API_PORT') || '5172'
    const portSegment = port ? `:${port}` : ''
    return `${protocol}//${host}${portSegment}`
  }

  return 'http://localhost:5172'
}

const baseURL = resolveBaseURL()

// Do NOT set a global Content-Type so axios/browser can auto-detect (e.g. add multipart boundary for FormData)
export const api = axios.create({
  baseURL: `${baseURL.replace(/\/$/, '')}/api`,
  withCredentials: false, // set true if backend uses session cookies
})

// Interceptors for adding auth tokens and centralized error handling
api.interceptors.request.use((config) => {
  const token = (window as any).__ENV__?.API_TOKEN || import.meta.env.VITE_API_TOKEN
  if (token) {
    config.headers = config.headers || {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // global error handling (could be replaced with toast notifications)
    console.error('API error', err)
    return Promise.reject(err)
  }
)

export default api
