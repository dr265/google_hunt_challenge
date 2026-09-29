import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSignIn, useUser } from '@clerk/clerk-react'
import { Card, PageFade } from '../components/ui'
import { Radio } from 'lucide-react'

export function LoginPage() {
  const { isLoaded, signIn } = useSignIn()
  const { user, isSignedIn } = useUser()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  // Sign in with Google through Clerk, then register the session with the backend.
  const googleSignIn = async () => {
    if (!isLoaded) return
    setBusy(true)
    setError(null)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/login',
        redirectUrlComplete: '/',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setBusy(false)
    }
  }

  // After the OAuth redirect, Clerk restores the session here → go to the app.
  useEffect(() => {
    if (isSignedIn && user) navigate('/', { replace: true })
  }, [isSignedIn, user, navigate])

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <PageFade className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-blue-950/50">
            <Radio className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Sign in to NEXUS</h1>
            <p className="mt-1 text-xs text-slate-500">Campus Intelligence Command Center</p>
          </div>
        </div>
        <Card className="p-6">
          <p className="mb-4 text-center text-xs text-slate-400">
            Authentication is handled by Clerk. Sign in with your Google account to
            continue to the campus command center.
          </p>
          {error && (
            <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <button
            onClick={googleSignIn}
            disabled={!isLoaded || busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3 text-sm font-semibold text-slate-800 shadow transition hover:bg-slate-100 disabled:opacity-50"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.4 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
              <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.7-6c-2.1 1.4-4.8 2.3-7.5 2.3-6.3 0-11.6-3.9-13.5-9.4l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
            </svg>
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
          >
            Continue in Demo Mode →
          </button>
        </Card>
      </PageFade>
    </div>
  )
}
