import { motion } from 'framer-motion'
import { nexus } from '../api/client'
import { usePolling } from '../api/hooks'
import { Card, PageFade, SectionTitle, SeverityChip, EmptyState } from '../components/ui'

interface IncidentRow {
  id?: string
  severity?: string
  summary?: string
  status?: string
  requester_id?: string
  created_at?: string
}

const ESCALATION_CHAIN = [
  'Incident detected',
  'Security Agent',
  'Emergency Agent',
  'Health Agent',
  'Transport Agent',
  'Command Center',
]

export function IncidentsPage() {
  const { data, loading } = usePolling<{ items: IncidentRow[] }>(() => nexus.getIncidents(), 25000)
  const incidents = data?.items ?? []

  return (
    <PageFade>
      <SectionTitle
        title="Incident Center"
        subtitle="Active incidents with agent escalation chains and severity tracking."
      />

      {/* Escalation timeline (shown for the most serious context) */}
      <Card className="mb-8 p-6">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Critical escalation path · Engineering Building A (correlated incident)
        </p>
        <div className="flex flex-wrap items-center gap-y-4">
          {ESCALATION_CHAIN.map((step, i) => (
            <div key={step} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.15, duration: 0.35 }}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium ${
                  i === 0
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                    : i === ESCALATION_CHAIN.length - 1
                      ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                      : 'border-nexus-edge bg-nexus-card/70 text-slate-300'
                }`}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-current text-[9px] font-bold">
                  {i + 1}
                </span>
                {step}
              </motion.div>
              {i < ESCALATION_CHAIN.length - 1 && (
                <motion.div
                  className="mx-2 h-px w-8 bg-gradient-to-r from-rose-500/60 to-sky-500/60 sm:w-12"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.15 + 0.1, duration: 0.3 }}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading incidents…</p>
      ) : incidents.length === 0 ? (
        <EmptyState title="No open incidents" hint="The campus is operating normally." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {incidents.map((inc, i) => {
            const severity = (inc.severity ?? 'medium').toUpperCase()
            return (
              <motion.div
                key={inc.id ?? i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.4 }}
              >
                <Card
                  className={`p-6 ${
                    severity === 'CRITICAL' ? 'border-rose-500/50 shadow-[0_0_28px_rgba(248,113,113,0.12)]' : ''
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <SeverityChip severity={severity} />
                    <span className="rounded-md border border-nexus-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                      {inc.status ?? 'open'}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-500">
                      {inc.created_at ? new Date(inc.created_at).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{inc.summary}</p>
                  <p className="mt-3 font-mono text-[11px] text-slate-500">
                    handled by: {inc.requester_id ?? 'command-center'}
                  </p>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </PageFade>
  )
}
