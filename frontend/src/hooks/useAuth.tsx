import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useGolf } from '@/store/golfStore'
import { BASE } from '@/lib/api'

interface AuthCtx {
  userId: string | null
  loading: boolean
  signIn: (jwt: string) => Promise<void>
  signOut: () => void
}

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthCtx>({
  userId: null,
  loading: true,
  signIn: async () => {},
  signOut: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const updateProfile = useGolf(s => s.updateProfile)
  const loadRounds = useGolf(s => s.loadRounds)

  const loadProfile = async () => {
    const token = localStorage.getItem('golf_jwt')
    if (!token) return
    try {
      const res = await fetch(`${BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        // JWT rejected server-side — clear it and force re-auth via AuthPage
        localStorage.removeItem('golf_jwt')
        setUserId(null)
        return
      }
      if (res.ok) {
        const data = await res.json()
        updateProfile({
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          username: data.username ?? '',
          hcp: Number(data.hcp) || 0,
          homeClub: data.home_club ?? 'Golf Club Minsk',
          city: data.city ?? 'Minsk, Belarus',
          defaultTee: (data.default_tee as import('@/lib/courses').TeeColor) ?? 'yellow',
        })
        await loadRounds()
      }
    } catch {}
  }

  const signIn = async (jwt: string) => {
    localStorage.setItem('golf_jwt', jwt)
    const payload = parseJwt(jwt)
    if (payload?.userId) {
      setUserId(payload.userId)
      await loadProfile()
    }
  }

  const signOut = () => {
    if (import.meta.env.DEV) return
    localStorage.removeItem('golf_jwt')
    localStorage.removeItem('golfminsk-store')
    useGolf.getState().resetStore()
    setUserId(null)
  }

  useEffect(() => {
    // Dev mode: skip auth entirely, auto-login with mock user
    if (import.meta.env.DEV) {
      updateProfile({ firstName: 'Timofey', lastName: '', initials: 'T', hcp: 13 })
      setUserId('dev')
      setLoading(false)
      return
    }

    // Opened as a Telegram Mini App: initData carries a signed Telegram
    // identity, so log in with it directly instead of sending the user
    // through the site's "Войти через Telegram" deep-link flow — that flow
    // is for the plain website, and inside Telegram it's redundant (you're
    // already there) and was leaving mini-app rounds/bookings tied to no
    // account. Wins over any stale localStorage token from a different device.
    const tgWebApp = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    if (tgWebApp?.initData) {
      const timeout = setTimeout(() => setLoading(false), 8000)
      fetch(`${BASE}/api/auth/telegram-webapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tgWebApp.initData }),
      })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then((data: { jwt: string }) => signIn(data.jwt))
        .catch(() => { localStorage.removeItem('golf_jwt'); setUserId(null) })
        .finally(() => { clearTimeout(timeout); setLoading(false) })
      return
    }

    const token = localStorage.getItem('golf_jwt')
    if (!token) {
      setLoading(false)
      return
    }
    const payload = parseJwt(token)
    if (!payload?.userId || (payload.exp && payload.exp * 1000 < Date.now())) {
      localStorage.removeItem('golf_jwt')
      setLoading(false)
      return
    }
    setUserId(payload.userId)
    // Timeout so a hanging network request doesn't keep the black loading screen forever
    const timeout = setTimeout(() => setLoading(false), 8000)
    loadProfile().finally(() => { clearTimeout(timeout); setLoading(false) })
  }, [])

  return (
    <AuthContext.Provider value={{ userId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
