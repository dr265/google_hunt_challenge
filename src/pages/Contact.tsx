import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'

/**
 * Mainframe-style contact hero — Inter font, blink-cursor typewriter headline,
 * mouse-scrubbed background video (desktop), multi-select service pills with a
 * springy acknowledgment banner. Adapted to NEXUS: "Let's Go" opens JARVIS.
 */
const SCRUB_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4'

const HEADLINE = "we'd love to\nhear from you!"
const SERVICES = ['JARVIS Voice', 'Campus AI', 'SRMAP Data', 'Other']

/** Typewriter: builds the string slice by slice after a start delay. */
function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    const timeout = setTimeout(() => {
      let i = 0
      interval = setInterval(() => {
        i += 1
        setDisplayed(text.slice(0, i))
        if (i >= text.length) {
          if (interval) clearInterval(interval)
          setDone(true)
        }
      }, speed)
    }, startDelay)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [text, speed, startDelay])

  return { displayed, done }
}

export default function ContactPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { displayed, done } = useTypewriter(HEADLINE)
  const [services, setServices] = useState<string[]>([])
  const prevXRef = useRef<number | null>(null)

  // Desktop mouse scrubbing (>=1024px), mobile autoplay — mirrors the spec hooks
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024 || !video.duration) return
      const prevX = prevXRef.current
      if (prevX !== null) {
        const delta = e.clientX - prevX
        const target = Math.min(
          video.duration,
          Math.max(0, video.currentTime + (delta / window.innerWidth) * 0.8 * video.duration),
        )
        video.currentTime = target
      }
      prevXRef.current = e.clientX
    }
    window.addEventListener('mousemove', onMove)
    if (window.innerWidth < 1024) {
      video.autoplay = true
      video.play().catch(() => {})
    }
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const toggle = (s: string) =>
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white font-sans text-neutral-900 antialiased lg:block lg:min-h-screen">
      {/* Background video — scrubbed by mouse on desktop */}
      <div className="pointer-events-none relative order-last aspect-square w-full overflow-hidden bg-neutral-50 lg:absolute lg:inset-0 lg:order-none lg:z-0 lg:aspect-auto lg:h-full lg:bg-transparent md:aspect-video">
        <video
          ref={videoRef}
          src={SCRUB_VIDEO}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover object-right lg:object-right-bottom"
        />
      </div>

      {/* Navbar */}
      <header className="fixed inset-x-0 top-0 z-10 flex flex-row items-center justify-between bg-transparent px-5 py-4 sm:px-8 sm:py-5">
        <button
          onClick={() => navigate('/')}
          className="flex select-none items-center gap-3"
          aria-label="Back to home"
        >
          <span className="text-[21px] font-medium tracking-tight text-black sm:text-[26px]">
            NEXUS&reg;
          </span>
          <span className="mb-1 select-none text-[25px] font-medium leading-none tracking-[-0.02em] text-black sm:text-[30px]">
            &#10033;
          </span>
        </button>
        <nav className="hidden items-center text-[23px] text-black md:flex">
          {[
            ['Command Center', '/command'],
            ['Campus', '/campus'],
            ['Agents', '/agents'],
            ['JARVIS', '/command'],
          ].map(([label, to], i) => (
            <span key={label}>
              {i > 0 && <span className="opacity-40">,&nbsp;</span>}
              <button onClick={() => navigate(to)} className="transition-opacity hover:opacity-60">
                {label}
              </button>
            </span>
          ))}
        </nav>
        <button
          onClick={() => navigate('/command')}
          className="hidden text-[23px] text-black underline underline-offset-2 transition-opacity hover:opacity-60 md:block"
        >
          Launch NEXUS
        </button>
      </header>

      {/* Content */}
      <div className="relative z-10 order-first flex w-full flex-col bg-white pb-8 lg:order-none lg:min-h-screen lg:bg-transparent">
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-12">
          {/* Typewriter headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="mb-8 w-full select-none whitespace-pre-wrap text-5xl font-normal leading-[1.08] tracking-tight text-black md:text-6xl lg:text-[76px]">
              {displayed}
              {!done && (
                <span className="animate-blink ml-[2px] inline-block h-[1.1em] w-[2px] bg-black align-middle" />
              )}
            </h1>
          </motion.div>

          {/* Secondary description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="mb-14 max-w-2xl text-lg font-normal leading-relaxed text-[#5A635A] md:text-xl">
              Whether you have questions, feedback, <br />
              drop us a message and we&apos;ll get back to you as soon as possible.
            </p>
          </motion.div>

          {/* Service pills */}
          <div>
            <h2 className="mb-2 text-2xl font-medium tracking-tight">What sort of service?</h2>
            <p className="mb-8 text-[#738273] opacity-85">Select all that apply</p>
            <div className="flex flex-wrap gap-3">
              {SERVICES.map((s) => {
                const active = services.includes(s)
                return (
                  <motion.button
                    key={s}
                    onClick={() => toggle(s)}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#1C2E1E] text-white shadow-md shadow-emerald-950/5'
                        : 'border border-[#F1F3F1] bg-white text-[#1C2E1E] hover:bg-[#F1F3F1]/55'
                    }`}
                  >
                    {s}
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <Check className="h-4 w-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )
              })}
            </div>

            {/* Contingent feedback banner */}
            <AnimatePresence mode="wait">
              {services.length === 0 ? (
                <motion.p
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 text-xs italic"
                >
                  Please click to select services above.
                </motion.p>
              ) : (
                <motion.div
                  key="banner"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  className="overflow-hidden"
                >
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-[#FAFBF9] px-5 py-4">
                    <p className="text-sm text-[#1C2E1E]">
                      Ready to inquire about: <span className="font-medium">{services.join(', ')}</span>
                    </p>
                    <button
                      onClick={() => navigate('/command')}
                      className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#4D6D47]"
                    >
                      Let&apos;s Go
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
