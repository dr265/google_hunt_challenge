import { useState } from 'react'
import { motion } from 'framer-motion'
import { nexus } from '../api/client'
import { usePolling } from '../api/hooks'
import type { DecisionDocument } from '../api/types'
import { Card, Chip, PageFade, SectionTitle, SeverityChip, EmptyState } from '../components/ui'
import { Confidence } from '../components/CommandBar'
import { ShieldCheck, TriangleAlert } from 'lucide-react'

export function DecisionsPage() {
  const { data, loading } = usePolling<{ items: DecisionDocument[] }>(() => nexus.getDecisions(), 30000)
  const [selected, setSelected] = useState<DecisionDocument | null>(null)

  const decisions = data?.items ?? []

  return (
    <PageFade>
      <SectionTitle
        title="Decision Intelligence"
        subtitle="Every recommendation is grounded in recorded evidence with explicit confidence."
      />
      {loading ? (
        <p className="text-sm text-slate-500">Loading decisions…</p>
      ) : decisions.length === 0 ? (
        <EmptyState title="No decisions yet" hint="Run a command from the Command Center to generate one." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {decisions.map((d, i) => (
            <motion.div
              key={d.decision_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.4 }}
            >
              <DecisionCard decision={d} onOpen={() => setSelected(d)} />
            </motion.div>
          ))}
        </div>
      )}

      {selected && <DecisionDetail decision={selected} onClose={() => setSelected(null)} />}
    </PageFade>
  )
}

function DecisionCard({ decision: d, onOpen }: { decision: DecisionDocument; onOpen: () => void }) {
  return (
    <Card className="h-full cursor-pointer p-6 transition hover:border-nexus-accent/50" onClick={onOpen}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-md border border-nexus-accent/40 bg-nexus-accent/10 px-2 py-0.5 font-mono text-[10px] text-sky-300">
          {d.problem}
        </span>
        {d.approval_requirement ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            <TriangleAlert className="h-3 w-3" /> approval required
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> low risk
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-slate-200">{d.reason}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {d.relevant_systems.slice(0, 6).map((s) => (
          <Chip key={s} tone="accent">
            {s}
          </Chip>
        ))}
        {d.relevant_systems.length > 6 && <Chip>+{d.relevant_systems.length - 6}</Chip>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Confidence value={d.confidence} />
        <span className="text-[11px] text-slate-500">
          {d.conflicts.length} correlation{d.conflicts.length === 1 ? '' : 's'}
        </span>
      </div>
    </Card>
  )
}

function DecisionDetail({ decision: d, onClose }: { decision: DecisionDocument; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl overflow-y-auto border-l border-nexus-edge bg-nexus-panel p-7"
        initial={{ x: 80 }}
        animate={{ x: 0 }}
        exit={{ x: 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Decision record</p>
            <h2 className="mt-1 font-mono text-lg text-sky-300">{d.problem}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {new Date(d.timestamp).toLocaleString()} · confidence factors:{' '}
              {Object.entries(d.confidence_factors)
                .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
                .join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">
            ✕
          </button>
        </div>

        <Block title="Reasoning summary" body={d.reason} />
        <Block title="Expected impact" body={d.expected_impact} />

        {d.selected_action && (
          <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Recommended action</p>
            <p className="mt-1 font-mono text-sm text-white">{d.selected_action.kind}</p>
            <p className="mt-1 text-xs text-slate-400">
              {String(d.selected_action.payload.message ?? d.selected_action.payload.summary ?? '')}
            </p>
            <p className="mt-2 text-[11px] text-amber-300">
              {d.approval_requirement ? 'Pending independent human approval.' : 'Low-risk — may auto-execute locally.'}
            </p>
          </div>
        )}

        {d.available_options.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Options evaluated</p>
            <div className="space-y-2">
              {d.available_options.map((o) => (
                <div
                  key={String(o.option_id)}
                  className={`rounded-lg border p-3 text-xs ${
                    o.constraints_satisfied ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-200' : 'border-nexus-edge text-slate-400'
                  }`}
                >
                  {String(o.name ?? o.option_id)}
                  {'capacity' in o && <span className="ml-2 text-slate-500">cap {String(o.capacity)}</span>}
                  {'estimated_minutes' in o && <span className="ml-2 text-slate-500">{String(o.estimated_minutes)} min</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {d.conflicts.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Cross-system correlations</p>
            <div className="space-y-2">
              {d.conflicts.map((c) => (
                <div key={c.conflict_id} className="rounded-lg border border-nexus-edge bg-nexus-card/60 p-3">
                  <div className="flex items-center gap-2">
                    <SeverityChip severity={c.severity} />
                    <span className="font-mono text-[10px] text-slate-500">{c.kind}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.evidence.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Evidence ({d.evidence.length})
            </p>
            <div className="space-y-1.5">
              {d.evidence.slice(0, 12).map((e) => (
                <div key={e.evidence_id} className="flex items-center justify-between rounded-lg border border-nexus-edge bg-nexus-card/40 px-3 py-2">
                  <span className="truncate text-xs text-slate-300">{e.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-500">
                    {e.system}/{e.entity_type} {e.demo && <b className="text-amber-400">DEMO</b>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.risks.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Risks</p>
            <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
              {d.risks.slice(0, 8).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-xl border border-nexus-edge bg-nexus-card/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{body}</p>
    </div>
  )
}
