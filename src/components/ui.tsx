import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useNexusMode } from '../api/hooks'

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-nexus-edge bg-nexus-card/70 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  )
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === 'available' || status === 'operational' || status === 'executed'
      ? 'bg-emerald-400'
      : status === 'degraded' || status === 'pending_approval' || status === 'investigating'
        ? 'bg-amber-400'
        : status === 'unavailable' || status === 'failed'
          ? 'bg-rose-400'
          : 'bg-sky-400'
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-40 animate-ping`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  )
}

export function ModeBadge() {
  const mode = useNexusMode()
  const live = mode === 'live'
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide uppercase ${
        live ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {live ? 'Live Backend' : 'Demo Data'}
    </div>
  )
}

const severityColors: Record<string, string> = {
  LOW: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  MEDIUM: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  HIGH: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  CRITICAL: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
}

export function SeverityChip({ severity }: { severity: string }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
        severityColors[severity] ?? 'border-nexus-edge text-slate-300'
      }`}
    >
      {severity}
    </span>
  )
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        tone === 'accent'
          ? 'border-nexus-accent/40 bg-nexus-accent/10 text-sky-300'
          : 'border-nexus-edge bg-nexus-panel/80 text-slate-300'
      }`}
    >
      {children}
    </span>
  )
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageFade({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}
