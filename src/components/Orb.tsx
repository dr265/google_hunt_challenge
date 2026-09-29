import { motion } from 'framer-motion'

// JARVIS-style animated orb. Purely presentational.

export function NexusOrb({ size = 72, active = false }: { size?: number; active?: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {active && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full border border-sky-400/50"
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            className="absolute inset-0 rounded-full border border-cyan-300/40"
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
          />
        </>
      )}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, rgba(103,232,249,0.95), rgba(79,141,255,0.75) 45%, rgba(14,20,36,0.9) 80%)',
          boxShadow: active
            ? '0 0 30px rgba(79,141,255,0.55), inset 0 0 18px rgba(103,232,249,0.5)'
            : '0 0 14px rgba(79,141,255,0.25), inset 0 0 12px rgba(103,232,249,0.25)',
        }}
        animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 1.4, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-[26%] w-[26%] rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
      </div>
    </div>
  )
}

export function Waveform({ active, bars = 18 }: { active: boolean; bars?: number }) {
  return (
    <div className="flex h-6 items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-sky-500 to-cyan-300"
          style={{
            height: '100%',
            transformOrigin: 'center',
            animation: active ? `nexus-wave ${0.6 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite` : 'none',
            transform: active ? undefined : 'scaleY(0.25)',
            opacity: active ? 1 : 0.35,
          }}
        />
      ))}
    </div>
  )
}
