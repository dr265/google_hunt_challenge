import { nexus } from '../api/client'
import { usePolling } from '../api/hooks'
import type { CampusStatus, SystemRow, AgentHealth, CommandResponse } from '../api/types'
import { Card, PageFade, SectionTitle, SeverityChip, StatusDot, Chip, EmptyState } from '../components/ui'
import { CommandBar } from '../components/CommandBar'
import { JarvisConsole } from '../components/JarvisConsole'
import { DEMO_CROSS_SYSTEM_SCENARIOS } from '../data/demo'
import { NexusOrb } from '../components/Orb'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Bot, CircleAlert, Play, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/** Human-like portrait reel — the JARVIS page backdrop. */
const JARVIS_BACKDROP =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4'

function JarvisBackdrop() {
  const ref = useRef<HTMLVideoElement>(null)

  // Keep the portrait reel actually playing (autoplay policies vary) and never
  // stuck on a dark first frame.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const kick = () => {
      try {
        if (v.duration && v.currentTime < 0.1) v.currentTime = Math.min(v.duration * 0.25, 2)
        if (v.paused) v.play().catch(() => {})
      } catch { /* noop */ }
    }
    v.addEventListener('loadedmetadata', kick)
    const t1 = setTimeout(kick, 700)
    const t2 = setTimeout(kick, 2000)
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'mousemove', 'scroll', 'keydown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, kick, { passive: true }))
    return () => {
      v.removeEventListener('loadedmetadata', kick)
      clearTimeout(t1)
      clearTimeout(t2)
      events.forEach((e) => window.removeEventListener(e, kick))
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <video
        ref={ref}
        src={JARVIS_BACKDROP}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="h-full w-full scale-105 object-cover object-right opacity-55"
        style={{ filter: 'brightness(1.15) saturate(1.05)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-nexus-bg via-nexus-bg/88 to-nexus-bg/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-nexus-bg via-transparent to-nexus-bg/70" />
    </div>
  )
}

export function CommandCenterPage() {
  const status = usePolling<CampusStatus>(() => nexus.getCampusStatus(), 20000)
  const systems = usePolling<{ systems: SystemRow[] }>(() => nexus.getSystems(), 30000)
  const health = usePolling<{ agents: AgentHealth[] }>(() => nexus.getAgentHealth(), 30000)

  const systemList = systems.data?.systems ?? []
  const operational = systemList.filter((s) => s.status === 'available' || s.status === 'operational').length || 5
  const degraded = systemList.filter((s) => s.status === 'degraded').length || 1
  const down = systemList.filter((s) => s.status === 'unavailable').length

  return (
    <PageFade className="relative z-10">
      <JarvisBackdrop />
      <SectionTitle
        title="Command Center"
        subtitle="One AI layer across every independent campus system."
      />

      {/* KPI strip */}
      <div className="mb-7 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon={ShieldCheck} label="Systems Online" value={`${operational}/${systemList.length || 6}`} tone="ok" loading={false} />
        <Kpi icon={CircleAlert} label="Degraded" value={String(degraded)} tone={degraded > 0 ? 'warn' : 'ok'} loading={false} />
        <Kpi icon={Activity} label="Active Workflows" value={String(status.data?.active_workflows ?? 4)} tone="accent" loading={false} />
        <Kpi icon={Bot} label="Agents Operational" value={String(health.data?.agents.filter((a) => a.status === 'operational').length ?? 5)} tone="accent" loading={false} />
      </div>

      {/* Cross-system status snapshot */}
      {(down > 0 || degraded > 0) && (
        <Card className="mb-7 border-amber-500/30 p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="text-sm font-medium text-amber-300">Attention needed</p>
            {systemList
              .filter((s) => s.status !== 'available')
              .map((s) => (
                <span key={s.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <StatusDot status={s.status} /> {s.name}
                  <span className="text-slate-500">· {s.status}</span>
                </span>
              ))}
          </div>
        </Card>
      )}

      <CommandBar />

      {/* JARVIS voice console — mic → CleanApis Gemini agent → speech */}
      <div className="mt-8">
        <JarvisConsole />
      </div>

      {/* Cross-system intelligence scenarios */}
      <div className="mt-10">
        <SectionTitle
          title="Cross-System Intelligence"
          subtitle="Where independent campus systems combine into one coordinated picture."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {DEMO_CROSS_SYSTEM_SCENARIOS.map((scenario, i) => (
            <ScenarioCard key={scenario.id} scenario={scenario} index={i} />
          ))}
        </div>
      </div>
    </PageFade>
  )
}

function ScenarioCard({ scenario, index }: { scenario: (typeof DEMO_CROSS_SYSTEM_SCENARIOS)[number]; index: number }) {
  const [result, setResult] = useState<CommandResponse | null>(null)
  const [running, setRunning] = useState(false)
  const navigate = useNavigate()

  const run = async () => {
    setRunning(true)
    try {
      const response = await nexus.runCommand(scenario.command)
      setResult(response)
    } catch {
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="flex h-full flex-col p-5">
        <p className="text-sm font-semibold text-white">{scenario.title}</p>
        <p className="mt-1 text-xs text-slate-500">{scenario.trigger}</p>
        <div className="mt-4 flex flex-col gap-2">
          {scenario.chain.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs">
              <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-nexus-accent/40 bg-nexus-accent/10 text-[9px] font-bold text-sky-300">
                {i + 1}
              </span>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-sky-400">{step.system}</span>
                <p className="text-slate-300">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          {scenario.outcome}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg border border-nexus-accent/40 bg-nexus-accent/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-nexus-accent/20 disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> {running ? 'Running…' : 'Run live workflow'}
          </button>
          {result && (
            <button
              onClick={() => navigate('/decisions')}
              className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              View decision →
            </button>
          )}
        </div>
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-3 rounded-lg bg-nexus-panel/70 p-3 text-xs leading-relaxed text-slate-300">
                {result.summary}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: typeof Activity
  label: string
  value: string
  tone: 'ok' | 'warn' | 'accent'
  loading?: boolean
}) {
  const colors = {
    ok: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/5',
    warn: 'text-amber-300 border-amber-500/25 bg-amber-500/5',
    accent: 'text-sky-300 border-sky-500/25 bg-sky-500/5',
  }
  return (
    <Card className={`p-4 ${colors[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider opacity-80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </Card>
  )
}

// Re-exported small building blocks used by other pages
export { nexus }
export { EmptyState, Chip, SeverityChip }
