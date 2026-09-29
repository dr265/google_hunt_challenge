// Central API client for the NEXUS backend (campus nexus hub.py).
// All endpoints map 1:1 to routes that actually exist in the backend.
// When the backend is unreachable the client falls back to clearly-labeled demo data.

import type {
  AgentHealth,
  AgentMetadata,
  CampusStatus,
  CommandInfo,
  DecisionDocument,
  CommandResponse,
  EventMetadata,
  Interpretation,
  Page,
  SourceMode,
  SystemRow,
  TokenPair,
} from './types'
import {
  DEMO_AGENTS,
  DEMO_COMMANDS,
  DEMO_DECISIONS,
  DEMO_EVENTS,
  DEMO_HEALTH,
  DEMO_STATUS,
  DEMO_SYSTEMS,
  demoCommandResponse,
  nextDemoActivity,
} from '../data/demo'

const BASE = (import.meta.env.VITE_API_BASE as string) || '/api'
const TIMEOUT_MS = 20_000

const ACCESS_KEY = 'nexus.access_token'
const REFRESH_KEY = 'nexus.refresh_token'
const EMAIL_KEY = 'nexus.user_email'
const NAME_KEY = 'nexus.user_name'

export type ModeListener = (mode: SourceMode) => void

class NexusClient {
  mode: SourceMode = 'demo'
  private listeners = new Set<ModeListener>()
  private unavailable = false

  onModeChange(listener: ModeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setMode(mode: SourceMode) {
    if (this.mode !== mode) {
      this.mode = mode
      this.listeners.forEach((l) => l(mode))
    }
  }

  getToken(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken())
  }

  getUserEmail(): string | null {
    return localStorage.getItem(EMAIL_KEY)
  }

  getUser(): { email: string; name: string } | null {
    const email = localStorage.getItem(EMAIL_KEY)
    if (!email) return null
    return { email, name: localStorage.getItem(NAME_KEY) ?? 'Operator' }
  }

  logout() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EMAIL_KEY)
    localStorage.removeItem(NAME_KEY)
  }

  private async fetch<T>(path: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = this.getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        signal: controller.signal,
      })
      this.unavailable = false
      if (response.status === 401) {
        this.logout()
        throw new HttpError(401, 'Session expired. Please log in again.')
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new HttpError(response.status, (detail as { detail?: string }).detail ?? `Request failed (${response.status})`)
      }
      return (await response.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  private async tryLive<T>(path: string, init?: RequestInit, fallback?: () => T, timeout?: number): Promise<T> {
    if (!this.unavailable && fallback) {
      try {
        const result = await this.fetch<T>(path, init, timeout)
        this.setMode('live')
        return result
      } catch (error) {
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) throw error
        if (error instanceof HttpError && error.status < 500) throw error
        // Network / 5xx → backend unavailable → demo fallback
        this.unavailable = true
        this.setMode('demo')
        if (fallback) return fallback()
        throw error
      }
    }
    if (fallback) return fallback()
    return this.fetch<T>(path, init, timeout)
  }

  // ---- Auth ---------------------------------------------------------------

  async login(username: string, password: string): Promise<TokenPair> {
    const pair = await this.fetch<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    localStorage.setItem(ACCESS_KEY, pair.access_token)
    localStorage.setItem(REFRESH_KEY, pair.refresh_token)
    this.unavailable = false
    this.setMode('live')
    return pair
  }

  /** Exchange a Clerk (Google) identity for a NEXUS backend session token. */
  async loginWithClerk(email: string, name: string): Promise<{ access_token: string }> {
    const result = await this.fetch<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    })
    localStorage.setItem(ACCESS_KEY, result.access_token)
    localStorage.setItem(EMAIL_KEY, email)
    localStorage.setItem(NAME_KEY, name)
    this.unavailable = false
    this.setMode('live')
    return result
  }

  async checkBackend(): Promise<boolean> {
    try {
      await this.fetch<{ status: string }>('/health', {}, 4000)
      this.unavailable = false
      return true
    } catch {
      this.unavailable = true
      this.setMode('demo')
      return false
    }
  }

  // ---- Read endpoints (all exist in the backend) ---------------------------

  getSystems(): Promise<{ systems: SystemRow[] }> {
    return this.tryLive('/systems', {}, () => ({ systems: DEMO_SYSTEMS }))
  }

  getAgents(): Promise<{ agents: AgentMetadata[] }> {
    return this.tryLive('/agents', {}, () => ({ agents: DEMO_AGENTS as unknown as AgentMetadata[] }))
  }

  getAgentHealth(): Promise<{ timestamp: string; agents: AgentHealth[]; degraded_agents: string[]; active_tasks: number }> {
    return this.tryLive('/command-center/health', {}, () => ({
      timestamp: new Date().toISOString(),
      agents: DEMO_HEALTH,
      degraded_agents: DEMO_HEALTH.filter((a) => a.status === 'degraded').map((a) => a.agent_id),
      active_tasks: DEMO_HEALTH.reduce((sum, a) => sum + a.active_tasks, 0),
    }))
  }

  getCampusStatus(): Promise<CampusStatus> {
    return this.tryLive('/command-center/status', {}, () => DEMO_STATUS, 15_000)
  }

  getCommands(): Promise<{ commands: CommandInfo[] }> {
    return this.tryLive('/command-center/commands', {}, () => ({ commands: DEMO_COMMANDS }))
  }

  interpret(text: string): Promise<Interpretation> {
    return this.tryLive(
      '/command-center/interpret',
      { method: 'POST', body: JSON.stringify({ text }) },
      () => this.demoInterpret(text),
    )
  }

  runCommand(command: string, parameters: Record<string, unknown> = {}, authorizeLowRisk = false): Promise<CommandResponse> {
    const idempotency_key = `ui-${command}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return this.tryLive(
      '/command-center/commands',
      {
        method: 'POST',
        body: JSON.stringify({
          command,
          idempotency_key,
          parameters,
          authorize_low_risk_actions: authorizeLowRisk,
        }),
      },
      () => demoCommandResponse(command),
      30_000,
    )
  }

  ask(query: string): Promise<{ interpretation: Interpretation; response: CommandResponse }> {
    // JARVIS-style: interpret the natural-language query, then run the mapped command.
    return this.interpret(query).then(async (interpretation) => {
      const command = interpretation.command ?? 'get_campus_status'
      const response = await this.runCommand(command)
      return { interpretation, response }
    }).catch(async (error) => {
      if (this.mode === 'demo') {
        const response = demoCommandResponse(query)
        return {
          interpretation: this.demoInterpret(query),
          response,
        }
      }
      throw error
    })
  }

  getEvents(offset = 0, limit = 50): Promise<Page<EventMetadata>> {
    return this.tryLive(`/events?offset=${offset}&limit=${limit}`, {}, () => ({
      items: DEMO_EVENTS, offset, limit, has_more: false,
    }))
  }

  getDecisions(offset = 0, limit = 50): Promise<Page<DecisionDocument>> {
    return this.tryLive(`/decisions?offset=${offset}&limit=${limit}`, {}, () => ({
      items: DEMO_DECISIONS, offset, limit, has_more: false,
    }))
  }

  getIncidents(offset = 0, limit = 50): Promise<Page<Record<string, unknown>>> {
    return this.tryLive(`/incidents?offset=${offset}&limit=${limit}`, {}, () => ({
      items: this.demoIncidents(), offset, limit, has_more: false,
    }))
  }

  getActions(offset = 0, limit = 50): Promise<Page<Record<string, unknown>>> {
    return this.tryLive(`/actions?offset=${offset}&limit=${limit}`, {}, () => ({
      items: this.demoActions(), offset, limit, has_more: false,
    }))
  }

  executeAction(actionId: string): Promise<Record<string, unknown>> {
    return this.fetch(`/actions/${actionId}/execute`, { method: 'POST' })
  }

  // ---- NEXUS unified backend (JARVIS + live campus + SRMAP) ----------------

  /** JARVIS agent turn (CleanApis Gemini-flash with campus tools). */
  async jarvisAsk(query: string): Promise<{ answer: string; steps: Array<{ name: string; ok: boolean }>; model: string }> {
    return this.fetch('/ask', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }, 200_000)
  }

  getCampusLiveStatus(): Promise<{ summary: string; kpis: Record<string, number> }> {
    return this.fetch('/campus/status')
  }

  getCampusLiveSystems(): Promise<{ systems: Array<{ id: string; name: string; status: string; detail: string; load: number }> }> {
    return this.fetch('/campus/systems')
  }

  getCampusLiveAgents(): Promise<{ agents: Array<{ id: string; name: string; role: string; status: string; active_tasks: number }> }> {
    return this.fetch('/campus/agents')
  }

  getCampusLiveEvents(): Promise<{ events: Array<{ id: string; agent_id: string; kind: string; summary: string; severity: string; ts: number }> }> {
    return this.fetch('/campus/events')
  }

  getCampusLiveDecisions(): Promise<{ decisions: Array<{ id: string; title: string; confidence: number; status: string; rationale: string; evidence: string[]; risks: string[]; ts: number }> }> {
    return this.fetch('/campus/decisions')
  }

  getCampusLiveIncidents(): Promise<{ incidents: Array<{ id: string; severity: string; status: string; summary: string; agent: string; ts: number }> }> {
    return this.fetch('/campus/incidents')
  }

  getSrmapFacts(limit = 60): Promise<{ facts: Array<Record<string, string>>; pages_scraped: number; scraped_at: string | null; status: string; url: string }> {
    return this.fetch(`/srmap/facts?limit=${limit}`)
  }

  refreshSrmap(): Promise<{ pages_scraped: number; facts: number; status: string; scraped_at: string }> {
    return this.fetch('/srmap/refresh', { method: 'POST' }, 300_000)
  }

  streamEvents(
    onEvent: (event: EventMetadata | { type: 'heartbeat'; timestamp: string; after_sequence: number }) => void,
    onStateChange: (connected: boolean) => void,
  ): () => void {
    let ws: WebSocket | null = null
    let closed = false

    const connect = () => {
      if (closed) return
      const token = this.getToken()
      if (!token) {
        onStateChange(false)
        return
      }
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/api/events/stream`)
      ws.onopen = () => {
        onStateChange(true)
        ws?.send(JSON.stringify({ access_token: token, after_sequence: 0 }))
      }
      ws.onmessage = (message) => {
        try {
          onEvent(JSON.parse(message.data))
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        onStateChange(false)
        if (!closed) setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      closed = true
      ws?.close()
    }
  }

  demoActivity() {
    return nextDemoActivity()
  }

  private demoInterpret(text: string): Interpretation {
    const normalized = text.toLowerCase()
    const patterns: Array<[string, string[]]> = [
      ['prepare_emergency_response', ['emergency', 'evacuation', 'medical emergency']],
      ['find_available_resources', ['alternative location', 'available classroom', 'free room', 'relocate event', 'classroom']],
      ['optimize_transport', ['bus delay', 'alternate route', 'transport', 'exam route', 'bus', 'delay']],
      ['check_attendance_eligibility', ['attendance', 'eligibility']],
      ['investigate_incident', ['network failure', 'building incident', 'incident', 'repeated maintenance']],
      ['coordinate_large_event', ['large event', 'event crowd', 'parking demand', 'event']],
      ['resolve_schedule_conflict', ['schedule conflict', 'double booking', 'venue conflict']],
      ['get_campus_status', ['campus status', 'what is happening', 'happening', 'attention', 'alerts']],
      ['search_library', ['library', 'book']],
    ]
    const scores = patterns.map(([command, phrases]) => ({
      command,
      score: phrases.filter((p) => normalized.includes(p)).length,
    }))
    const best = Math.max(...scores.map((s) => s.score), 0)
    const candidates = scores.filter((s) => s.score === best && s.score > 0).map((s) => s.command)
    const command = candidates[0] ?? null
    return {
      classification: 'INFERENCE',
      command,
      candidates,
      requires_clarification: candidates.length !== 1,
      execution_performed: false,
      next_step: command
        ? `Running ${command} workflow.`
        : 'No specific workflow matched; running a campus-wide status scan.',
    }
  }

  private demoIncidents(): Array<Record<string, unknown>> {
    return [
      { id: 'inc-1', requester_id: 'security-agent', severity: 'high', summary: 'Access alarm active at Engineering Building A during Innovation Fair.', status: 'open', created_at: new Date(Date.now() - 25 * 60000).toISOString() },
      { id: 'inc-2', requester_id: 'maintenance-agent', severity: 'high', summary: 'Correlated building incident: power + network + security at Building A.', status: 'investigating', created_at: new Date(Date.now() - 48 * 60000).toISOString() },
      { id: 'inc-3', requester_id: 'emergency-agent', severity: 'critical', summary: 'Synthetic medical response exercise (escalation pending human approval).', status: 'open', created_at: new Date(Date.now() - 12 * 60000).toISOString() },
    ]
  }

  private demoActions(): Array<Record<string, unknown>> {
    return [
      { id: 'act-1', kind: 'send_notification', risk: 'LOW', status: 'executed', created_at: new Date(Date.now() - 9 * 60000).toISOString(), payload: { audience: 'authorized-campus-operators', message: 'East Gate Alternative recommended for exam arrival.' }, result: { delivery: 'recorded_locally_not_delivered' } },
      { id: 'act-2', kind: 'create_maintenance_request', risk: 'MEDIUM', status: 'pending_approval', created_at: new Date(Date.now() - 20 * 60000).toISOString(), payload: { building_id: 'building-a', description: 'Investigate repeated power complaints (6, SLA breached).' }, result: null },
      { id: 'act-3', kind: 'escalate_incident', risk: 'CRITICAL', status: 'pending_approval', created_at: new Date(Date.now() - 12 * 60000).toISOString(), payload: { severity: 'critical', summary: 'Correlated building incident at Engineering Building A.' }, result: null },
    ]
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const nexus = new NexusClient()
