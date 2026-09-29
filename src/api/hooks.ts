import { useEffect, useState } from 'react'
import { nexus } from './client'
import type { SourceMode } from './types'

export function useNexusMode(): SourceMode {
  const [mode, setMode] = useState<SourceMode>(nexus.mode)
  useEffect(() => nexus.onModeChange(setMode), [])
  return mode
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 15000): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const result = await fetcher()
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    const timer = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, intervalMs])

  return { data, loading, error, refresh: () => setTick((t) => t + 1) }
}
