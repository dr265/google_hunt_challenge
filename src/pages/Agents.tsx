import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { nexus } from '../api/client'
import { usePolling } from '../api/hooks'
import type { AgentHealth, AgentMetadata } from '../api/types'
import { Card, Chip, PageFade, SectionTitle, StatusDot } from '../components/ui'

export function AgentsPage() {
  const agents = usePolling<{ agents: AgentMetadata[] }>(() => nexus.getAgents(), 30000)
  const health = usePolling<{ agents: AgentHealth[] }>(() => nexus.getAgentHealth(), 20000)

  const healthMap = useMemo(() => {
    const map = new Map<string, AgentHealth>()
    health.data?.agents.forEach((h) => map.set(h.agent_id, h))
    return map
  }, [health.data])

  return (
    <PageFade>
      <SectionTitle
        title="Agent Center"
        subtitle="Specialized domain agents coordinated by the NEXUS orchestrator."
      />
      <div className="mb-8">
        <AgentNetwork healthMap={healthMap} />
      </div>
      {agents.loading ? (
        <p className="text-sm text-slate-500">Loading agents…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(agents.data?.agents ?? []).map((agent, i) => {
            const h = healthMap.get(agent.agent_id)
            return (
              <motion.div
                key={agent.agent_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.4 }}
              >
                <Card className="h-full p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{agent.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{agent.domain}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <StatusDot status={h?.status ?? 'operational'} />
                      <span className={h?.status === 'degraded' ? 'text-amber-300' : 'text-emerald-300'}>
                        {h?.status ?? 'operational'}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Monitoring</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {agent.capabilities.slice(0, 3).join(' / ')}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Current activity:{' '}
                      {h && h.active_tasks > 0 ? (
                        <span className="text-sky-300">{h.active_tasks} task(s) running</span>
                      ) : (
                        'idle · listening'
                      )}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Tools authorized:</span>
                    <Chip>{agent.tools?.length ?? 0}</Chip>
                  </div>
                  {h?.last_error && (
                    <p className="mt-2 truncate text-[11px] text-rose-400">Last error: {h.last_error}</p>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </PageFade>
  )
}

function AgentNetwork({ healthMap }: { healthMap: Map<string, AgentHealth> }) {
  const [pulse, setPulse] = useState(0)

  const agents = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        return {
          x: 50 + 38 * Math.cos(angle),
          y: 50 + 38 * Math.sin(angle),
          label: i,
        }
      }),
    [],
  )

  useEffect(() => {
    const timer = setInterval(() => setPulse((p) => (p + 1) % 12), 700)
    return () => clearInterval(timer)
  }, [])

  return (
    <Card className="relative overflow-hidden p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Agent Network · Live activity</p>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <motion.span
            className="h-2 w-2 rounded-full bg-sky-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          NEXUS orchestrating
        </div>
      </div>
      <div className="relative mx-auto aspect-[16/7] w-full max-w-3xl">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 44" preserveAspectRatio="none">
          {agents.map((a, i) => (
            <line
              key={i}
              x1="50"
              y1="22"
              x2={a.x}
              y2={a.y * 0.44}
              stroke={i === pulse ? '#67e8f9' : '#1c2740'}
              strokeWidth={i === pulse ? '0.5' : '0.3'}
              strokeDasharray="3 2"
              style={{ transition: 'stroke 0.3s' }}
            />
          ))}
        </svg>
        {/* Central hub */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-sky-500/90 to-blue-700/90 shadow-[0_0_36px_rgba(79,141,255,0.45)]"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-center">
              <p className="text-[13px] font-bold tracking-tight text-white">NEXUS</p>
              <p className="text-[8px] uppercase tracking-widest text-sky-200">orchestrator</p>
            </div>
          </motion.div>
          <motion.span
            className="absolute inset-0 rounded-full border border-sky-400/40"
            animate={{ scale: [1, 2], opacity: [0.7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        {/* Agent nodes */}
        {agents.map((a, i) => {
          const names = ['academic', 'transport', 'events', 'facilities', 'security', 'health', 'it', 'maintenance', 'parking', 'energy', 'attendance', 'comm']
          const h = healthMap.get(`${names[i]}-agent`)
          const degraded = h?.status === 'degraded'
          return (
            <motion.div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${a.x}%`, top: `${(a.y / 100) * 100}%` }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3 + (i % 4), repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
            >
              <div
                className={`grid h-9 w-9 place-items-center rounded-xl border text-[9px] font-semibold ${
                  degraded
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : i === pulse
                      ? 'border-sky-400/70 bg-sky-500/20 text-sky-200 shadow-[0_0_16px_rgba(103,232,249,0.4)]'
                      : 'border-nexus-edge bg-nexus-card text-slate-400'
                }`}
              >
                {names[i].slice(0, 3).toUpperCase()}
              </div>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}
