import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { nexus } from '../api/client'
import { usePolling } from '../api/hooks'
import type { SystemRow } from '../api/types'
import { Card, PageFade, SectionTitle, StatusDot } from '../components/ui'
import { DEMO_CROSS_SYSTEM_SCENARIOS } from '../data/demo'
import { X } from 'lucide-react'

const SYSTEM_META: Record<string, { emoji: string; metric: string }> = {
  academic: { emoji: '📚', metric: 'CS301 exam tomorrow 10:00' },
  attendance: { emoji: '📊', metric: 'CS301 at 68% (min 75%)' },
  transport: { emoji: '🚌', metric: 'Main Gate +35 min delay' },
  events: { emoji: '🎪', metric: 'Innovation Fair · 220 attendees' },
  sports: { emoji: '🏆', metric: 'Indoor briefing in A101' },
  hostel: { emoji: '🏠', metric: 'H2-204 over capacity' },
  mess: { emoji: '🍽️', metric: 'Lunch demand 600 · 520 meals' },
  health: { emoji: '🏥', metric: 'Duty doctor: 2 overlapping visits' },
  communication: { emoji: '📢', metric: 'Local outbox adapter ready' },
  finance: { emoji: '💳', metric: 'Sample ledger: ₹5,000 due' },
  facilities: { emoji: '🏛️', metric: 'A101 restricted (electrical)' },
  library: { emoji: '📖', metric: '2/5 copies available' },
  security: { emoji: '🔐', metric: 'Access alarm · Building A' },
  parking: { emoji: '🅿️', metric: 'Fair parking 75/100' },
  energy: { emoji: '⚡', metric: '280 kW vs 200 kW threshold' },
  it: { emoji: '🌐', metric: 'Switch outage · 45 devices' },
  maintenance: { emoji: '🛠️', metric: '6 SLA-breached complaints' },
  inventory: { emoji: '📦', metric: 'Switch spares below reorder' },
  emergency: { emoji: '🚨', metric: 'Exercise drill recorded' },
  environment: { emoji: '🌤️', metric: '31°C · rain 30%' },
  visitor: { emoji: '🪪', metric: '1 visit pending approval' },
  sanitation: { emoji: '🧹', metric: 'Post-event cleaning planned' },
  welfare: { emoji: '🤝', metric: '1 open support case' },
  research: { emoji: '🔬', metric: 'GPU workstation available' },
}

export function CampusPage() {
  const { data, loading } = usePolling<{ systems: SystemRow[] }>(() => nexus.getSystems(), 25000)
  const [selected, setSelected] = useState<SystemRow | null>(null)
  const systems = data?.systems ?? []

  return (
    <PageFade>
      <SectionTitle title="Campus Overview" subtitle="Every independent campus system, unified in one view." />

      {loading ? (
        <p className="text-sm text-slate-500">Loading systems…</p>
      ) : systems.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">No systems reported by the backend.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {systems.map((system, i) => {
            const meta = SYSTEM_META[system.id] ?? { emoji: '🔷', metric: 'Monitoring' }
            return (
              <motion.button
                key={system.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.4 }}
                onClick={() => setSelected(system)}
                className="group text-left"
              >
                <Card className="h-full p-5 transition group-hover:border-nexus-accent/50 group-hover:shadow-[0_0_24px_rgba(79,141,255,0.12)]">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{meta.emoji}</span>
                    <StatusDot status={system.status} />
                  </div>
                  <p className="mt-3 font-medium text-white">{system.name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-400">{meta.metric}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        system.status === 'available'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : system.status === 'degraded'
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {system.status}
                    </span>
                    <span className="text-[10px] text-slate-500">{system.id}-agent</span>
                  </div>
                </Card>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Schematic map */}
      <div className="mt-10">
        <SectionTitle title="Schematic Campus Map" subtitle="Buildings, incidents and congestion at a glance." />
        <CampusMap />
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="h-full w-full max-w-md overflow-y-auto border-l border-nexus-edge bg-nexus-panel p-6"
              initial={{ x: 80 }}
              animate={{ x: 0 }}
              exit={{ x: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-3xl">{SYSTEM_META[selected.id]?.emoji ?? '🔷'}</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{selected.name}</h2>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <StatusDot status={selected.status} /> status: {selected.status}
                    {selected.demo && <span className="font-bold uppercase text-amber-400">demo data</span>}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-nexus-edge bg-nexus-card/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Current activity</p>
                <p className="mt-1 text-sm text-slate-200">{SYSTEM_META[selected.id]?.metric ?? 'Monitoring'}</p>
              </div>

              <div className="mt-4 rounded-xl border border-nexus-edge bg-nexus-card/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Connected agent</p>
                <p className="mt-1 font-mono text-sm text-sky-300">{selected.id}-agent</p>
              </div>

              {DEMO_CROSS_SYSTEM_SCENARIOS.some((s) => s.chain.some((c) => c.system === selected.id)) && (
                <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Cross-system links</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                    {DEMO_CROSS_SYSTEM_SCENARIOS.filter((s) => s.chain.some((c) => c.system === selected.id)).map((s) => (
                      <li key={s.id}>→ {s.title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageFade>
  )
}

function CampusMap() {
  const features = [
    { label: 'Engineering A', x: '22%', y: '30%', kind: 'incident' as const, detail: 'Correlated incident: power + network + security' },
    { label: 'Learning B', x: '68%', y: '22%', kind: 'ok' as const, detail: 'Seminar Hall B201 available' },
    { label: 'Main Gate', x: '12%', y: '72%', kind: 'congestion' as const, detail: 'Route delayed 35 min (Innovation Fair)' },
    { label: 'Innovation Fair', x: '45%', y: '55%', kind: 'event' as const, detail: '220 attendees · A101' },
    { label: 'Parking', x: '30%', y: '78%', kind: 'congestion' as const, detail: '75/100 occupancy' },
    { label: 'Library', x: '80%', y: '62%', kind: 'ok' as const, detail: 'Open · 2/5 copies available' },
  ]
  const colors = {
    incident: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
    congestion: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    event: 'border-violet-500/50 bg-violet-500/10 text-violet-300',
    ok: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  }

  return (
    <Card className="relative h-[380px] overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2740" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <line x1="12%" y1="72%" x2="45%" y2="55%" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
        <line x1="45%" y1="55%" x2="22%" y2="30%" stroke="#f87171" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
        <line x1="68%" y1="22%" x2="80%" y2="62%" stroke="#34d399" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
      </svg>
      {features.map((f) => (
        <motion.div
          key={f.label}
          className="group absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: f.x, top: f.y }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.06 }}
        >
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md ${colors[f.kind]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {f.label}
          </div>
          <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 w-48 -translate-x-1/2 rounded-lg border border-nexus-edge bg-nexus-panel p-2.5 text-[11px] text-slate-300 opacity-0 shadow-xl transition group-hover:opacity-100">
            {f.detail}
          </div>
        </motion.div>
      ))}
      <div className="absolute bottom-3 right-4 flex gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-rose-400" /> incident</span>
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-400" /> congestion</span>
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-400" /> event</span>
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> normal</span>
      </div>
    </Card>
  )
}
