import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { CommandCenterPage } from './pages/CommandCenter'
import { CampusPage } from './pages/Campus'
import { AgentsPage } from './pages/Agents'
import { DecisionsPage } from './pages/Decisions'
import { IncidentsPage } from './pages/Incidents'
import { ActivityPage } from './pages/Activity'
import { LoginPage } from './pages/Login'
import { nexus } from './api/client'

const LandingPage = lazy(() => import('./pages/Landing'))
const ContactPage = lazy(() => import('./pages/Contact'))

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

/** Bridges Clerk (Google sign-in) -> backend session token. */
function AuthBridge() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress ?? `${user.id}@clerk`
      const name = user.fullName ?? user.firstName ?? 'Operator'
      if (!nexus.isAuthenticated() || nexus.getUserEmail() !== email) {
        nexus.loginWithClerk(email, name).catch(() => {
          /* backend offline — app still runs, JARVIS will report it */
        })
      }
    } else {
      nexus.logout()
    }
  }, [isLoaded, isSignedIn, user])

  return null
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <AuthBridge />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lazy><LandingPage /></Lazy>} />
          <Route path="/contact" element={<Lazy><ContactPage /></Lazy>} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/command" element={<CommandCenterPage />} />
            <Route path="/campus" element={<CampusPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  )
}
