import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { nexus } from '../api/client'
import { Card, Chip } from './ui'
import { Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react'

/**
 * NEXUS JARVIS Voice Console — browser-side JARVIS voice loop.
 *
 * Ported from the SARA Nexus Hub JARVIS page (sara-ai-platform/scratch/hub_original/
 * hub/sara-auto/page.tsx `speakJarvis`) plus the SARA autonomous-agent loop:
 *   mic capture (SpeechRecognition) → NEXUS backend /api/ask (CleanApis Gemini-flash
 *   agent with campus tools) → speech synthesis reply, with a live tool-call trace.
 */
type Step = { name: string; ok: boolean }

export function JarvisConsole() {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [muted, setMuted] = useState(false)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }
    const rec = new SR()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim()
      if (text) askJarvis(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    return () => {
      try { rec.abort() } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep voices warm: some browsers load them asynchronously, and an empty
  // voice list makes speech silently fail.
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => window.speechSynthesis.getVoices()
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Unlock the audio channel on the first user gesture (autoplay policies).
  const primeAudio = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.resume()
      const u = new SpeechSynthesisUtterance('')
      u.volume = 0
      window.speechSynthesis.speak(u)
    } catch { /* noop */ }
  }, [])

  /** JARVIS voice — ALWAYS speaks the answer (unless the operator muted it). */
  const speak = useCallback((text: string) => {
    if (muted || !('speechSynthesis' in window) || !text) return
    const say = () => {
      try {
        const synth = window.speechSynthesis
        synth.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.rate = 1.02
        u.pitch = 0.85
        u.volume = 1
        const voices = synth.getVoices()
        const preferred =
          voices.find((v) => /Google UK English Male|Daniel|Microsoft Guy/i.test(v.name)) ||
          voices.find((v) => /Google UK English|Google US English|Microsoft David|Samantha/i.test(v.name)) ||
          voices.find((v) => v.lang.startsWith('en'))
        if (preferred) u.voice = preferred
        u.onstart = () => setSpeaking(true)
        u.onend = () => setSpeaking(false)
        u.onerror = () => setSpeaking(false)
        synth.resume()
        synth.speak(u)
        // Chrome occasionally drops the very first utterance right after load.
        setTimeout(() => {
          if (!synth.speaking && !synth.pending) {
            try { synth.speak(u) } catch { /* noop */ }
          }
        }, 350)
      } catch {
        setSpeaking(false)
      }
    }
    say()
  }, [muted])

  const askJarvis = useCallback(async (text: string) => {
    if (!text.trim() || busy) return
    primeAudio()
    setQuery(text)
    setAnswer('')
    setSteps([])
    setError(null)
    setBusy(true)
    try {
      const result = await nexus.jarvisAsk(text)
      setAnswer(result.answer)
      setSteps(result.steps ?? [])
      speak(result.answer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'JARVIS is unreachable.'
      setError(
        msg.includes('Failed to fetch')
          ? 'Backend unreachable — start it with start.bat and try again.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }, [busy, speak])

  const toggleMic = () => {
    const rec = recognitionRef.current
    primeAudio()
    if (!rec) return
    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      try {
        window.speechSynthesis?.cancel()
      } catch { /* noop */ }
      rec.start()
      setListening(true)
    }
  }

  return (
    <Card className="p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300">
          <Sparkles className="h-4 w-4 text-cyan-400" /> JARVIS Voice Console
        </h3>
        <div className="flex items-center gap-2">
          <Chip tone={muted ? undefined : 'accent'}>{muted ? 'VOICE OFF' : 'VOICE ON'}</Chip>
          <button
            onClick={() => setMuted((m) => !m)}
            className="rounded-lg border border-nexus-edge p-2 text-slate-400 transition hover:text-white"
            title={muted ? 'Unmute JARVIS voice' : 'Mute JARVIS voice'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <motion.button
          onClick={toggleMic}
          disabled={!supported || busy}
          whileTap={{ scale: 0.95 }}
          className={`relative grid h-20 w-20 place-items-center rounded-full border transition ${
            listening
              ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-300'
              : 'border-nexus-edge bg-nexus-panel text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300'
          } disabled:opacity-40`}
          title={supported ? 'Tap to talk to JARVIS' : 'Voice input not supported in this browser'}
        >
          {listening && (
            <motion.span
              className="absolute inset-0 rounded-full border border-cyan-400/60"
              animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          {listening ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7 opacity-70" />}
        </motion.button>

        <p className="text-xs text-slate-500">
          {!supported && 'Voice input needs Chrome/Edge — you can still type below.'}
          {supported && !listening && !busy && 'Tap the orb and speak — JARVIS answers out loud.'}
          {listening && 'Listening… speak now'}
          {busy && 'JARVIS is thinking (LLM + campus tools)…'}
        </p>

        <form
          className="flex w-full max-w-xl items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            askJarvis(query)
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="…or type: what's happening across campus?"
            className="flex-1 rounded-xl border border-nexus-edge bg-nexus-bg px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-cyan-500/60"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="rounded-xl bg-gradient-to-b from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </div>

      {(steps.length > 0 || answer || error) && (
        <div className="mt-6 border-t border-nexus-edge/60 pt-5">
          {steps.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {steps.map((s, i) => (
                <span
                  key={i}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${
                    s.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {s.ok ? '✓' : '✗'} tool:{s.name}
                </span>
              ))}
            </div>
          )}
          {speaking && (
            <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-cyan-400">
              <Volume2 className="h-3.5 w-3.5" /> JARVIS speaking
            </p>
          )}
          {answer && (
            <p className="text-[15px] leading-relaxed text-slate-200">{answer}</p>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      )}
    </Card>
  )
}
