import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { nexus } from '../api/client'
import { useNexusMode } from '../api/hooks'
import { ModeBadge } from './ui'
import { Activity, Bot, Gauge, LayoutGrid, LogIn, LogOut, Radio, ShieldAlert, TriangleAlert } from 'lucide-react'

const LINKS = [
  { to: '/command', label: 'Command Center', icon: Gauge, end: true },
  { to: '/campus', label: 'Campus', icon: LayoutGrid },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/decisions', label: 'Decisions', icon: ShieldAlert },
  { to: '/incidents', label: 'Incidents', icon: TriangleAlert },
  { to: '/activity', label: 'Activity', icon: Activity },
]

export function Layout() {
  const mode = useNexusMode()
  const [authed, setAuthed] = useState(nexus.isAuthenticated())
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-nexus-edge/60 bg-nexus-panel/80 backdrop-blur-xl lg:flex">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-6 pb-6 pt-7 text-left"
          aria-label="Back to landing page"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-blue-950/50">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-white">NEXUS AI</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Campus Intelligence</p>
          </div>
        </button>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
                  isActive
                    ? 'border border-nexus-accent/30 bg-nexus-accent/10 text-white'
                    : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-nexus-edge/60 p-4">
          <ModeBadge />
          {authed ? (
            <button
              onClick={() => {
                nexus.logout()
                setAuthed(false)
                navigate(0)
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-nexus-edge px-3 py-2 text-xs text-slate-400 transition hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-sky-500 to-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:brightness-110"
            >
              <LogIn className="h-3.5 w-3.5" /> Connect Backend
            </button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-nexus-edge/60 bg-nexus-bg/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <p className="text-sm font-semibold text-white">NEXUS AI</p>
        <ModeBadge />
      </div>

      <main className="w-full flex-1 px-5 pb-16 pt-20 sm:px-8 lg:ml-60 lg:max-w-[1400px] lg:pt-9">
        <Outlet />
      </main>
    </div>
  )
}
