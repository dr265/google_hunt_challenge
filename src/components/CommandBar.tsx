import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { nexus } from '../api/client'
import type { CommandResponse, Interpretation } from '../api/types'
import { NexusOrb, Waveform } from './Orb'
import { Card, Chip, SeverityChip } from './ui'
import { CornerDownLeft, Radio, Sparkles } from 'lucide-react'

const SUGGESTIONS = [
  "What's happening across campus?",
  'Find an available classroom for 3 PM.',
  'Why is the transport system delayed?',
  'Show today\u2019s important incidents.',
  'Which systems currently need attention?',
  'Is the library open?',
]

type Phase = 'idle' | 'interpreting' | 'consulting' | 'deciding' | 'done' | 'error'

const PIPELINE_STAGES = [
  { key: 'interpreting', label: 'NEXUS Orchestrator interpreting intent' },
  { key: 'consulting', label: 'Domain agents consulted' },
  { key: 'deciding', label: 'Decision Engine generating recommendation' },
]

export function CommandBar() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null)
  const [result, setResult] = useState<CommandResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error'

  /** Read the answer aloud — NEXUS always speaks its reply. */
  const speak = (text: string) => {
    if (!text || !('speechSynthesis' in window)) return
    try {
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.03
      u.pitch = 0.88
      const voices = synth.getVoices()
      const v =
        voices.find((x) => /Google UK English Male|Daniel|Microsoft Guy/i.test(x.name)) ||
        voices.find((x) => x.lang.startsWith('en'))
      if (v) u.voice = v
      synth.resume()
      synth.speak(u)
    } catch { /* noop */ }
  }

  const submit = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    // Unlock audio inside the user gesture so the reply can speak afterwards
    try { window.speechSynthesis?.resume() } catch { /* noop */ }
    setQuery(trimmed)
    setError(null)
    setResult(null)
    setInterpretation(null)
    setChecked([])
    setPhase('interpreting')

    const timer = setInterval(() => {
      setChecked((prev) => {
        if (prev.length < 4) return [...prev, 'x']
        return prev
      })
    }, 450)

    try {
      const { interpretation: interp, response } = await nexus.ask(trimmed)
      setInterpretation(interp)
      // Stagger pipeline visualization before showing the answer
      setPhase('consulting')
      await sleep(700)
      setPhase('deciding')
      await sleep(600)
      setResult(response)
      setPhase('done')
      speak(response.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'NEXUS could not process this request.')
      setPhase('error')
    } finally {
      clearInterval(timer)
    }
  }

  const consulted = result?.agents_consulted ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Central orb + input */}
      <Card className="relative overflow-hidden p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(600px 200px at 50% -60px, rgba(79,141,255,0.16), transparent 70%)',
          }}
        />
        <div className="relative flex flex-col items-center gap-5">
          <NexusOrb size={84} active={busy} />
          <Waveform active={busy} />
          <p className="text-sm text-slate-400">
            {phase === 'idle' && 'Ask NEXUS anything about campus operations'}
            {phase === 'interpreting' && 'NEXUS is analyzing your request\u2026'}
            {phase === 'consulting' && 'Consulting domain agents\u2026'}
            {phase === 'deciding' && 'Decision Engine evaluating evidence\u2026'}
            {phase === 'done' && 'Response ready'}
            {phase === 'error' && 'Something went wrong'}
          </p>

          <form
            className="flex w-full max-w-2xl items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit(query)
            }}
          >
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-nexus-edge bg-nexus-panel/90 px-5 py-4 focus-within:border-nexus-accent/60 transition-colors">
              <Sparkles className="h-5 w-5 shrink-0 text-sky-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. What's happening across campus?"
                className="w-full bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !query.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:opacity-40"
              >
                Run
                <CornerDownLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>

          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                disabled={busy}
                className="rounded-full border border-nexus-edge bg-nexus-panel/60 px-3.5 py-1.5 text-xs text-slate-300 transition hover:border-nexus-accent/50 hover:text-white disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Intelligence pipeline */}
      <AnimatePresence>
        {busy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Intelligence Pipeline
              </p>
              <div className="flex flex-col gap-3">
                {PIPELINE_STAGES.map((stage, i) => {
                  const order = ['interpreting', 'consulting', 'deciding']
                  const currentIndex = order.indexOf(phase)
                  const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending'
                  return (
                    <div key={stage.key} className="flex items-center gap-3 text-sm">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${
                          state === 'done'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                            : state === 'active'
                              ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                              : 'border-nexus-edge text-slate-600'
                        }`}
                      >
                        {state === 'done' ? '\u2713' : i + 1}
                      </span>
                      <span className={state === 'pending' ? 'text-slate-600' : 'text-slate-200'}>
                        {stage.label}
                      </span>
                      {state === 'active' && (
                        <motion.span
                          className="h-1.5 w-1.5 rounded-full bg-sky-400"
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              {checked.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Transport Agent', 'Events Agent', 'Academic Agent', 'Facilities Agent']
                    .slice(0, checked.length)
                    .map((agent) => (
                      <motion.span
                        key={agent}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
                      >
                        \u2713 {agent} checked
                      </motion.span>
                    ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answer */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-5"
          >
            <Card className="p-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Sparkles className="h-4.5 w-4.5 text-sky-400" /> Answer
                </h3>
                <div className="flex items-center gap-2">
                  <Chip tone="accent">{result.status === 'completed' ? 'Completed' : 'Degraded coverage'}</Chip>
                  <Confidence value={result.decision.confidence} />
                </div>
              </div>
              <TypeOut text={result.summary} className="text-[15px] leading-relaxed text-slate-200" />
              {interpretation && interpretation.command && (
                <p className="mt-4 text-xs text-slate-500">
                  Mapped workflow: <span className="font-mono text-sky-300">{interpretation.command}</span>
                </p>
              )}
            </Card>

            {(result.decision.conflicts.length > 0 || consulted.length > 0) && (
              <div className="grid gap-5 lg:grid-cols-2">
                {consulted.length > 0 && (
                  <Card className="p-6">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Systems Consulted
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.systems_consulted.map((s) => (
                        <Chip key={s} tone="accent">
                          {s}
                        </Chip>
                      ))}
                    </div>
                    <h4 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Agents Engaged ({consulted.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {consulted.map((a) => (
                        <Chip key={a}>{a}</Chip>
                      ))}
                    </div>
                  </Card>
                )}
                {result.decision.conflicts.length > 0 && (
                  <Card className="p-6">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Cross-System Correlations ({result.decision.conflicts.length})
                    </h4>
                    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                      {result.decision.conflicts.map((c) => (
                        <div key={c.conflict_id} className="rounded-xl border border-nexus-edge bg-nexus-panel/60 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <SeverityChip severity={c.severity} />
                            <span className="font-mono text-[10px] text-slate-500">{c.kind}</span>
                          </div>
                          <p className="text-xs text-slate-300">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {result.decision.available_options.length > 0 && (
              <Card className="p-6">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Evidence-Based Options
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.decision.available_options.map((opt) => {
                    const feasible = (opt as { constraints_satisfied?: boolean }).constraints_satisfied
                    return (
                      <div
                        key={String(opt.option_id)}
                        className={`rounded-xl border p-4 ${
                          feasible ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-nexus-edge bg-nexus-panel/50 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{String(opt.name ?? opt.option_id)}</p>
                          {feasible ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                              Feasible
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Rejected
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          {'capacity' in opt && <span>Capacity: {String(opt.capacity)}</span>}
                          {'estimated_minutes' in opt && <span>ETA: {String(opt.estimated_minutes)} min</span>}
                          {'distance_m' in opt && opt.distance_m != null && <span>{String(opt.distance_m)} m</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {(result.decision.selected_action || result.risks.length > 0) && (
              <div className="grid gap-5 lg:grid-cols-2">
                {result.decision.selected_action && (
                  <Card className="border-sky-500/30 p-6">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-400">
                      <Radio className="h-3.5 w-3.5" /> Recommended Action
                    </h4>
                    <p className="font-mono text-sm text-white">{result.decision.selected_action.kind}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {String(result.decision.selected_action.payload.message ?? result.decision.selected_action.payload.summary ?? '')}
                    </p>
                    {result.required_approval && (
                      <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                        Human approval required before execution.
                      </p>
                    )}
                  </Card>
                )}
                {result.risks.length > 0 && (
                  <Card className="p-6">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Risks</h4>
                    <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
                      {result.risks.slice(0, 6).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}

            {result.decision.evidence.length > 0 && (
              <Card className="p-6">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Evidence ({result.decision.evidence.length})
                </h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {result.decision.evidence.slice(0, 8).map((e) => (
                    <div key={e.evidence_id} className="rounded-lg border border-nexus-edge bg-nexus-panel/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-slate-200">{e.name}</p>
                        {e.demo && <span className="shrink-0 text-[9px] font-bold uppercase text-amber-400">demo</span>}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">
                        {e.system} / {e.entity_type}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <Card className="border-rose-500/40 bg-rose-950/20 p-5">
          <p className="text-sm text-rose-300">{error}</p>
          <p className="mt-1 text-xs text-rose-400/70">
            If the NEXUS backend is offline, enable Demo Mode from the header to explore the full interface.
          </p>
        </Card>
      )}
    </div>
  )
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const tone = pct >= 80 ? 'text-emerald-300' : pct >= 60 ? 'text-amber-300' : 'text-rose-300'
  return (
    <div className="flex items-center gap-2" title={`Source availability x freshness x agreement`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-nexus-edge">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className={`text-xs font-semibold ${tone}`}>{pct}%</span>
    </div>
  )
}

function TypeOut({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown('')
    let i = 0
    const step = Math.max(1, Math.round(text.length / 120))
    const timer = setInterval(() => {
      i += step
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(timer)
    }, 12)
    return () => clearInterval(timer)
  }, [text])
  return (
    <p className={className}>
      {shown}
      {shown.length < text.length && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-sky-400 align-middle" />}
    </p>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
