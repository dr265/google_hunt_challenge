import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

/**
 * Vesper.ai-style premium landing — pure black, liquid-glass nav pills,
 * hero background video, bottom-centered copy, stats footer.
 * Adapted to NEXUS: CTAs enter the Command Center / JARVIS experience.
 */
const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4'
// If the primary asset ever fails, fall back to the human-portrait reel so the
// hero background is NEVER blank.
const HERO_VIDEO_FALLBACK =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4'

const NAV = [
  { label: 'Command Center', href: '/command', cls: 'appear appear--scale', d: '0.16s' },
  { label: 'Campus', href: '/campus', cls: 'appear appear--soft', d: '0.28s' },
  { label: 'Agents', href: '/agents', cls: 'appear appear--scale', d: '0.40s' },
  { label: 'JARVIS Voice', href: '/command#jarvis', cls: 'appear appear--soft', d: '0.52s' },
]

const STATS = [
  { label: '6 campus systems unified', icon: <DualPillIcon /> },
  { label: 'Real-time decisions with 91% confidence', icon: <DownloadIcon /> },
  { label: 'SRMAP live knowledge via AI scraper', icon: <AvatarsIcon /> },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [videoSrc, setVideoSrc] = useState(HERO_VIDEO)

  // Desktop mouse scrubbing (>=1024px): horizontal movement scrubs the hero video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let prevX: number | null = null

    const onMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024 || !video.duration) return
      if (prevX !== null) {
        const delta = e.clientX - prevX
        const target = Math.min(
          video.duration,
          Math.max(0, video.currentTime + (delta / window.innerWidth) * 0.8 * video.duration),
        )
        video.currentTime = target
      }
      prevX = e.clientX
    }
    window.addEventListener('mousemove', onMove)

    // Paint a real frame immediately: with preload+no autoplay the very first
    // frame can render black, which made the hero background look empty.
    const paint = () => {
      try {
        if (video.duration) {
          const t = Math.min(video.duration * 0.35, 4)
          if (Math.abs(video.currentTime - t) > 0.2) video.currentTime = t
        }
        // Always keep it playing so the background is visibly alive; mouse
        // movement still scrubs it (currentTime jumps while playing).
        video.play().catch(() => {})
      } catch { /* noop */ }
    }
    video.addEventListener('loadedmetadata', paint)
    video.addEventListener('seeked', paint, { once: true })
    const t1 = setTimeout(paint, 800)
    const t2 = setTimeout(paint, 2200)
    return () => {
      window.removeEventListener('mousemove', onMove)
      video.removeEventListener('loadedmetadata', paint)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [videoSrc])

  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  // Safety net for autoplay-blocking browsers: start the reel on the first
  // interaction so the hero background is never a black frame.
  useEffect(() => {
    const kick = () => {
      const v = videoRef.current
      if (v && v.paused) v.play().catch(() => {})
    }
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'mousemove', 'scroll', 'keydown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, kick, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, kick))
  }, [])

  return (
    <div className="vesper-root min-h-screen bg-black text-white antialiased overflow-x-hidden">
      {/* Hero background video (scrubbed on desktop) */}
      <div className="vesper-hero-photo pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoSrc((s) => (s === HERO_VIDEO ? HERO_VIDEO_FALLBACK : s))}
          className="h-full w-full object-cover object-right-bottom"
          style={{ filter: 'brightness(1.3) contrast(1.05) saturate(1.08)' }}
        />
        <div className="vesper-scrim absolute inset-0" />
      </div>

      {/* Full-screen mobile menu backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-2xl transition-opacity duration-300 md:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Header */}
      <header className="relative z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-5 sm:px-10">
        <button
          onClick={() => navigate('/')}
          className="vesper-appear inline-flex items-center gap-2.5 justify-self-start text-[15.5px] font-semibold tracking-tight"
          style={{ ['--d' as string]: '0.08s' }}
          aria-label="NEXUS AI"
        >
          <MarkSvg />
          <span>
            NEXUS<span className="font-normal opacity-80">.ai</span>
          </span>
        </button>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href.split('#')[0])}
              className={`vesper-pill vesper-appear ${item.cls}`}
              style={{ ['--d' as string]: item.d }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => navigate('/command')}
            className="vesper-btn vesper-btn-solid vesper-appear hidden md:inline-flex"
            style={{ ['--d' as string]: '0.34s' }}
          >
            Launch NEXUS
          </button>
          <button
            className={`vesper-burger vesper-appear ${menuOpen ? 'open' : ''}`}
            style={{ ['--d' as string]: '0.34s' }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobile menu links */}
      <div
        className={`fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 px-6 transition-opacity duration-300 md:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {NAV.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              setMenuOpen(false)
              navigate(item.href.split('#')[0])
            }}
            className="vesper-pill h-14 w-full max-w-xs text-[17px]"
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => {
            setMenuOpen(false)
            navigate('/command')
          }}
          className="vesper-btn vesper-btn-solid mt-3 h-14 w-full max-w-xs text-[15px]"
        >
          Launch NEXUS
        </button>
      </div>

      {/* Hero copy — bottom centered */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col items-end justify-end px-6 pb-24 pt-10">
        <div className="mx-auto flex w-full max-w-[860px] flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
            className="vesper-badge mb-5"
          >
            <StarSvg />
            Campus Intelligence Command Center
          </motion.div>

          <h1 className="text-[40px] font-medium leading-[1.12] tracking-[-0.045em] text-white md:text-[54px] lg:text-[64px]">
            <span className="block overflow-hidden">
              <motion.span
                className="block"
                initial={{ y: '40%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.42 }}
              >
                One AI layer over your{' '}
                <em className="font-serif italic text-[#9a9a9a]">entire campus</em>
              </motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span
                className="block"
                initial={{ y: '40%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.62 }}
              >
                working in minutes.
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.82 }}
            className="mt-4 max-w-[470px] text-[15.5px] leading-relaxed tracking-[-0.015em] text-[#9a9a9a]"
          >
            NEXUS connects academics, transport, security, hostels and utilities —
            JARVIS answers by voice, decisions arrive with evidence.
          </motion.p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <motion.button
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.96 }}
              onClick={() => navigate('/command')}
              className="vesper-btn vesper-btn-solid h-[46px] px-5"
            >
              Start for Free
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 1.1 }}
              onClick={() => navigate('/contact')}
              className="vesper-btn vesper-btn-ghost h-[46px] px-5"
            >
              Get in touch
            </motion.button>
          </div>
        </div>
      </main>

      {/* Stats footer */}
      <footer className="relative z-10 flex flex-col items-center justify-between gap-4 px-6 pb-8 text-[13.5px] tracking-[-0.015em] text-[#d8d8d8] sm:flex-row sm:px-10 lg:px-16">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 1.12 + i * 0.16 }}
            className="inline-flex items-center gap-3.5 whitespace-nowrap"
          >
            {s.icon}
            {s.label}
          </motion.div>
        ))}
      </footer>
    </div>
  )
}

/* ---------- inline SVG bits ---------- */

function MarkSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <g transform="rotate(-30 12 12)">
        <circle cx="7.3" cy="3.2" r="1.45" />
        <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
        <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
        <circle cx="16.7" cy="20.8" r="1.45" />
      </g>
    </svg>
  )
}

function StarSvg() {
  return (
    <svg width="17" height="19" viewBox="0 0 24 24" fill="white" aria-hidden className="drop-shadow-[0_0_3px_rgba(255,255,255,0.45)]">
      <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
    </svg>
  )
}

function DualPillIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="vg1" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#3a3a3a" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="vg2" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a3a3a" stopOpacity="0.38" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <rect x="3.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#vg1)" />
      <rect x="13.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#vg2)" />
      <rect x="9.2" y="10.9" width="5.6" height="2.2" rx="1.1" fill="#4a4a4a" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6.2" fill="#ffffff" />
      <path d="M12 7.1v7.4" stroke="#111" strokeWidth="1.85" strokeLinecap="round" />
      <path d="M8.15 12.35L12 16.2l3.85-3.85" stroke="#111" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function AvatarsIcon() {
  return (
    <svg width="38" height="21" viewBox="0 0 40 22" aria-hidden>
      <circle cx="10.2" cy="11" r="9.2" fill="#2b2b2b" />
      <ellipse cx="10.2" cy="12.1" rx="4.15" ry="3.7" fill="#f4f4f4" />
      <circle cx="8.9" cy="11.6" r="0.7" fill="#1a1a1a" />
      <circle cx="11.5" cy="11.6" r="0.7" fill="#1a1a1a" />
      <circle cx="20.2" cy="11" r="9.2" fill="#ffffff" />
      <circle cx="17.6" cy="9.6" r="1.7" fill="#111" />
      <circle cx="22.8" cy="9.6" r="1.7" fill="#111" />
      <path d="M17.8 14.4c1.4 1.5 3.4 1.5 4.8 0" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="30.2" cy="11" r="9.2" fill="#f26b1d" />
      <text x="30.2" y="15.1" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="12.5" fill="#fff" textAnchor="middle">e</text>
    </svg>
  )
}
