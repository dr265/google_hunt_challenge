// Types mirroring the real NEXUS backend (campus nexus hub.py) schemas.
// Field names match the backend's Pydantic models exactly.

export type SourceMode = 'live' | 'demo'

export interface Evidence {
  evidence_id: string
  entity_id: string
  system: string
  entity_type: string
  name: string
  classification?: string
  observed_at: string
  received_at?: string
  data: Record<string, unknown>
  demo: boolean
}

export interface Conflict {
  conflict_id: string
  kind: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  systems: string[]
  evidence_ids: string[]
  classification?: string
}

export interface ActionProposal {
  kind: 'send_notification' | 'create_maintenance_request' | 'escalate_incident'
  payload: Record<string, unknown>
}

export interface DecisionDocument {
  decision_id: string
  problem: string
  requester_id: string
  context: {
    parameters?: Record<string, unknown>
    source_status?: Record<string, string>
    contradictions?: unknown[]
    preferred_option?: string | null
  }
  relevant_systems: string[]
  agents_consulted: string[]
  evidence: Evidence[]
  constraints: string[]
  available_options: Array<Record<string, unknown>>
  selected_action: ActionProposal | null
  reason: string
  confidence: number
  confidence_factors: Record<string, number>
  risks: string[]
  assumptions: string[]
  expected_impact: string
  approval_requirement: boolean
  conflicts: Conflict[]
  timestamp: string
}

export interface CommandResponse {
  request_id: string
  correlation_id: string
  status: 'completed' | 'degraded'
  summary: string
  decision: DecisionDocument
  systems_consulted: string[]
  agents_consulted: string[]
  evidence: Evidence[]
  risks: string[]
  assumptions: string[]
  required_approval: boolean
  actions_taken: Array<Record<string, unknown>>
  next_steps: string[]
  emergency: Record<string, unknown> | null
}

export interface SystemRow {
  id: string
  name: string
  status: string
  last_seen: string | null
  demo: boolean
}

export interface AgentMetadata {
  agent_id: string
  name: string
  description: string
  domain: string
  capabilities: string[]
  tools: string[]
  permissions: string[]
  event_subscriptions: string[]
  input_schema?: unknown
  output_schema?: unknown
}

export interface AgentHealth {
  agent_id: string
  status: 'operational' | 'degraded' | string
  active_tasks: number
  last_heartbeat?: string | null
  last_error?: string | null
}

export interface Interpretation {
  classification: string
  command: string | null
  candidates: string[]
  requires_clarification: boolean
  execution_performed: boolean
  next_step: string
}

export interface CommandInfo {
  command: string
  domains: string[]
  available_to_principal: boolean
}

export interface EventMetadata {
  sequence: number
  event_id: string
  source: string
  event_type: string
  correlation_id: string
  created_at: string
  status: string
  attempts: number
  last_error: string | null
}

export interface CampusStatus {
  timestamp: string
  active_workflows: number
  pending_approvals: number
  open_incidents: number
  dead_letters: number
}

export interface Page<T> {
  items: T[]
  offset: number
  limit: number
  has_more: boolean
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}
