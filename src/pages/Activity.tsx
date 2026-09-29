import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { nexus } from '../api/client'
import type { EventMetadata } from '../api/types'
import { Card, PageFade, SectionTitle } from '../components/ui'
import { DEMO_EVENTS } from '../data/demo'

type FeedItem = {
  id: string
  time: string
  source: string
  text: string
  origin: 'live' | 'simulated'
}

const KIND_COLORS: Record<string, string> = {
  agent: 'border-sky-500/40 bg-sky-500/5',
  nexus: 'border-violet-500/40 bg-violet-500/5',
  decision: 'border-emerald-500/40 bg-emerald-500/5',
  alert: 'border-rose-500/40 bg-rose-500/5',
}

export function ActivityPage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [streamConnected, setStreamConnected] = useState(false)
  const seeded = useRef(false)

  // Seed with the latest backend events (or demo events).
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    nexus
      .getEvents(0, 12)
      .then((page) => {
        const mapped = page.items.map((e: EventMetadata) => ({
          id: e.event_id,
          time: new Date(e.created_at).toLocaleTimeString('en-GB', { hour12: false }),
          source: `${e.source}-agent`,
          text: e.event_type.replaceAll('_', ' ').toLowerCase(),
          origin: nexus.mode === 'live' ? ('live' as const) : ('simulated' as const),
        }))
        setItems(mapped)
      })
      .catch(() => {
        setItems(
          DEMO_EVENTS.map((e) => ({
            id: e.event_id,
            time: new Date(e.created_at).toLocaleTimeString('en-GB', { hour12: false }),
            source: `${e.source}-agent`,
            text: e.event_type.replaceAll('_', ' ').toLowerCase(),
            origin: 'simulated' as const,
          })),
        )
      })
  }, [])

  // Simulated agent activity ticker (clearly labeled as simulation).
  useEffect(() => {
    const timer = setInterval(() => {
      const item = nexus.demoActivity()
      setItems((prev) =>
        [
          {
            id: `sim-${item.id}-${Date.now()}`,
            time: item.time,
            source: item.source,
            text: item.text,
            origin: 'simulated' as const,
          },
          ...prev,
        ].slice(0, 60),
      )
    }, 3200)
    return () => clearInterval(timer)
  }, [])

  // Try the real backend WebSocket event stream.
  useEffect(() => {
    if (!nexus.isAuthenticated()) return
    const close = nexus.streamEvents(
      (event) => {
        if ('type' in event && event.type === 'heartbeat') return
        const e = event as EventMetadata
        setItems((prev) =>
          [
            {
              id: e.event_id,
              time: new Date(e.created_at).toLocaleTimeString('en-GB', { hour12: false }),
              source: `${e.source}-agent`,
              text: `${e.event_type.replaceAll('_', ' ').toLowerCase()} (${e.status})`,
              origin: 'live' as const,
            },
            ...prev,
          ].slice(0, 60),
        )
      },
      setStreamConnected,
    )
    return close
  }, [])

  return (
    <PageFade>
      <SectionTitle
        title="Live Activity"
        subtitle="Correlated agent events streaming through the NEXUS event bus."
        right={
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                streamConnected
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-nexus-edge bg-nexus-panel text-slate-400'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${streamConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {streamConnected ? 'WebSocket stream live' : 'Stream idle'}
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              Simulation active
            </span>
          </div>
        }
      />

      <Card className="p-2">
        <div className="max-h-[70vh] overflow-y-auto">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`mb-1.5 flex items-center gap-3 rounded-xl border px-4 py-3 ${KIND_COLORS[guessKind(item.source)]}`}
              >
                <span className="font-mono text-[11px] text-slate-500">{item.time}</span>
                <span className="w-40 shrink-0 truncate font-mono text-[11px] text-sky-300">{item.source}</span>
                <span className="flex-1 text-[13px] text-slate-200">{item.text}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    item.origin === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {item.origin}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Waiting for activity…</p>}
        </div>
      </Card>
    </PageFade>
  )
}

function guessKind(source: string): string {
  if (source === 'nexus') return 'nexus'
  if (source === 'decision-engine') return 'decision'
  if (source.includes('security') || source.includes('emergency') || source.includes('it') || source.includes('maintenance') || source.includes('energy')) return 'alert'
  return 'agent'
}
