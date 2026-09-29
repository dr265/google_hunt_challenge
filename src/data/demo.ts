// Demo data mirroring the backend's seed_demo synthetic dataset.
// Everything here corresponds to records the real backend seeds with demo=True,
// names prefixed "[DEMO]". Used only when the live backend is unreachable.

import type { AgentHealth, CampusStatus, CommandInfo, CommandResponse, DecisionDocument, EventMetadata, SystemRow } from '../api/types'

export const DEMO_SYSTEMS: SystemRow[] = [
  { id: 'academic', name: 'Academic', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'attendance', name: 'Attendance', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'transport', name: 'Transport', status: 'degraded', last_seen: new Date().toISOString(), demo: true },
  { id: 'events', name: 'Events', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'sports', name: 'Sports', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'hostel', name: 'Hostel', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'mess', name: 'Mess', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'health', name: 'Health Center', status: 'degraded', last_seen: new Date().toISOString(), demo: true },
  { id: 'communication', name: 'Communication', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'finance', name: 'Finance', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'facilities', name: 'Facilities', status: 'degraded', last_seen: new Date().toISOString(), demo: true },
  { id: 'library', name: 'Library', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'security', name: 'Security', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'parking', name: 'Parking', status: 'available', last_seen: new Date().toISOString(), demo: true },
  { id: 'energy', name: 'Energy', status: 'degraded', last_seen: new Date().toISOString(), demo: true },
  { id: 'it', name: 'IT / Network', status: 'degraded', last_seen: new Date().toISOString(), demo: true },
  { id: 'maintenance', name: 'Maintenance', status: 'available', last_seen: new Date().toISOString(), demo: true },
]

const domains = DEMO_SYSTEMS.map((s) => s.id)

export const DEMO_AGENTS = domains.map((domain) => ({
  agent_id: `${domain}-agent`,
  name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Agent`,
  description: `Campus domain specialist for ${domain}.`,
  domain,
  capabilities: [`${domain}.inspect`],
  tools: [`get_${domain}_status`],
}))

export const DEMO_HEALTH: AgentHealth[] = domains.map((domain, i) => ({
  agent_id: `${domain}-agent`,
  status: i % 6 === 5 ? 'degraded' : 'operational',
  active_tasks: i % 4 === 0 ? 1 : 0,
}))

export const DEMO_COMMANDS: CommandInfo[] = [
  'get_campus_status',
  'detect_cross_system_conflicts',
  'generate_campus_intelligence_report',
  'find_available_resources',
  'optimize_transport',
  'resolve_schedule_conflict',
  'check_attendance_eligibility',
  'coordinate_large_event',
  'investigate_incident',
  'prepare_emergency_response',
].map((command) => ({ command, domains: [], available_to_principal: true }))

export const DEMO_STATUS: CampusStatus = {
  timestamp: new Date().toISOString(),
  active_workflows: 2,
  pending_approvals: 1,
  open_incidents: 3,
  dead_letters: 0,
}

export const DEMO_EVENTS: EventMetadata[] = [
  { sequence: 1042, event_id: 'e1', source: 'transport', event_type: 'BUS_DELAY_DETECTED', correlation_id: 'c1', created_at: new Date(Date.now() - 62000).toISOString(), status: 'processed', attempts: 1, last_error: null },
  { sequence: 1043, event_id: 'e2', source: 'events', event_type: 'EVENT_CREATED', correlation_id: 'c1', created_at: new Date(Date.now() - 56000).toISOString(), status: 'processed', attempts: 1, last_error: null },
  { sequence: 1044, event_id: 'e3', source: 'security', event_type: 'SECURITY_INCIDENT_REPORTED', correlation_id: 'c2', created_at: new Date(Date.now() - 41000).toISOString(), status: 'processed', attempts: 1, last_error: null },
  { sequence: 1045, event_id: 'e4', source: 'maintenance', event_type: 'MAINTENANCE_FAILURE_DETECTED', correlation_id: 'c2', created_at: new Date(Date.now() - 30000).toISOString(), status: 'processed', attempts: 1, last_error: null },
  { sequence: 1046, event_id: 'e5', source: 'energy', event_type: 'ENERGY_ANOMALY_DETECTED', correlation_id: 'c3', created_at: new Date(Date.now() - 15000).toISOString(), status: 'pending', attempts: 0, last_error: null },
]

function ev(system: string, type: string, name: string, data: Record<string, unknown>): DecisionDocument['evidence'][number] {
  return {
    evidence_id: `demo-${system}-${type}-${name}`.replace(/\s+/g, '-').toLowerCase(),
    entity_id: `demo-${name}`.replace(/\s+/g, '-').toLowerCase(),
    system,
    entity_type: type,
    name: `[DEMO] ${name}`,
    classification: 'FACT',
    observed_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
    data,
    demo: true,
  }
}

export function demoCommandResponse(query: string): CommandResponse {
  const q = query.toLowerCase()
  const nowIso = new Date().toISOString()
  const tomorrow = new Date(Date.now() + 86400000)
  tomorrow.setHours(10, 0, 0, 0)
  const inTwoHours = new Date(tomorrow.getTime() + 2 * 3600000)

  if (q.includes('classroom') || q.includes('room') || q.includes('resource')) {
    return {
      request_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      status: 'completed',
      summary:
        'Evaluated 14 recorded observations across 7 agents. Seminar Hall B201 satisfies capacity (150 >= 80), equipment (projector) and access constraints. 2 alternative options were evaluated and rejected.',
      decision: {
        decision_id: crypto.randomUUID(),
        problem: 'find_available_resources',
        requester_id: 'demo',
        context: {
          parameters: { start: tomorrow.toISOString(), end: inTwoHours.toISOString(), capacity: 80 },
          source_status: { facilities: 'available', academic: 'available', events: 'available', transport: 'available', maintenance: 'available' },
          contradictions: [],
          preferred_option: 'room-b201',
        },
        relevant_systems: ['academic', 'events', 'facilities', 'maintenance', 'security', 'transport'],
        agents_consulted: ['academic-agent', 'events-agent', 'facilities-agent', 'maintenance-agent', 'security-agent', 'transport-agent'],
        evidence: [
          ev('facilities', 'room', 'Seminar Hall B201', { capacity: 150, equipment: ['projector', 'microphone', 'video_conference'], operational: true }),
          ev('facilities', 'room', 'Lecture Hall A101', { capacity: 100, operational: false, restriction: 'electrical-safety closure' }),
          ev('transport', 'route', 'East Gate Alternative', { duration_minutes: 18, delay_minutes: 0, operational: true }),
          ev('transport', 'route', 'Main Gate Route', { duration_minutes: 20, delay_minutes: 35, operational: true }),
        ],
        constraints: ['Respect source-specific authorization.', 'Do not use restricted, occupied, closed or unreachable resources.'],
        available_options: [
          { option_id: 'room-b201', classification: 'RECOMMENDATION', name: '[DEMO] Seminar Hall B201', capacity: 150, constraints_satisfied: true },
        ],
        selected_action: {
          kind: 'send_notification',
          payload: { audience: 'authorized-campus-operators', message: 'Seminar Hall B201 recommended as alternative venue.' },
        },
        reason: 'Lecture Hall A101 is under an active electrical-safety restriction. Seminar Hall B201 is operational, has capacity 150 >= 80, includes a projector, and is reachable via the East Gate route with no delay.',
        confidence: 0.86,
        confidence_factors: { source_availability: 1.0, freshness: 0.92, agreement: 1.0, rule_validation: 1.0 },
        risks: ['facilities: Lecture Hall A101 restricted (electrical maintenance).'],
        assumptions: ['Source observations are accurate within their stated timestamps.'],
        expected_impact: 'One evidence-grounded venue relocation recommendation.',
        approval_requirement: false,
        conflicts: [],
        timestamp: nowIso,
      },
      systems_consulted: ['academic', 'events', 'facilities', 'maintenance', 'security', 'transport'],
      agents_consulted: ['academic-agent', 'events-agent', 'facilities-agent', 'maintenance-agent', 'security-agent', 'transport-agent'],
      evidence: [],
      risks: [],
      assumptions: [],
      required_approval: false,
      actions_taken: [],
      next_steps: ['Confirm booking with Facilities.'],
      emergency: null,
    }
  }

  if (q.includes('transport') || q.includes('bus') || q.includes('exam') || q.includes('delay')) {
    return {
      request_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      status: 'degraded',
      summary:
        'Evaluated 9 recorded observations across 5 agents. Main Gate Route is delayed 35 min and serves the CS301 exam location. The East Gate Alternative arrives 22 min before the exam start.',
      decision: {
        decision_id: crypto.randomUUID(),
        problem: 'optimize_transport',
        requester_id: 'demo',
        context: {
          source_status: { transport: 'available', academic: 'available', events: 'available', environment: 'available' },
          contradictions: [],
          preferred_option: 'route-east',
        },
        relevant_systems: ['academic', 'events', 'transport'],
        agents_consulted: ['academic-agent', 'events-agent', 'transport-agent'],
        evidence: [
          ev('academic', 'exam', 'CS301 Examination', { start: tomorrow.toISOString(), room_id: 'room-a101' }),
          ev('transport', 'route', 'Main Gate Route', { delay_minutes: 35, duration_minutes: 20, operational: true }),
          ev('transport', 'route', 'East Gate Alternative', { delay_minutes: 0, duration_minutes: 18, operational: true }),
          ev('events', 'event', 'University Innovation Fair', { attendees: 220, congestion_expected: true }),
        ],
        constraints: [],
        available_options: [
          { option_id: 'route-east', classification: 'PREDICTION', name: '[DEMO] East Gate Alternative', estimated_minutes: 18, before_exam: true, constraints_satisfied: true },
          { option_id: 'route-main', classification: 'PREDICTION', name: '[DEMO] Main Gate Route', estimated_minutes: 55, before_exam: false, constraints_satisfied: false },
        ],
        selected_action: {
          kind: 'send_notification',
          payload: { audience: 'authorized-campus-operators', message: 'East Gate Alternative recommended for exam arrival.' },
        },
        reason: 'The Innovation Fair (220 attendees) is causing a 35-minute delay on the Main Gate Route, which serves the CS301 exam location. The East Gate Alternative (18 min, no delay) arrives before the exam deadline.',
        confidence: 0.79,
        confidence_factors: { source_availability: 0.75, freshness: 0.95, agreement: 1.0, rule_validation: 1.0 },
        risks: ['EXAM_TRANSPORT_DELAY: a delayed route serves the CS301 exam location.'],
        assumptions: ['Availability and ETA may change after the decision timestamp.'],
        expected_impact: 'Students routed via East Gate arrive ~37 min earlier.',
        approval_requirement: false,
        conflicts: [
          {
            conflict_id: 'demo-conflict-1',
            kind: 'EXAM_TRANSPORT_DELAY',
            severity: 'HIGH',
            description: 'A delayed route serves the location of [DEMO] CS301 Examination.',
            systems: ['academic', 'transport'],
            evidence_ids: [],
          },
        ],
        timestamp: nowIso,
      },
      systems_consulted: ['academic', 'events', 'transport'],
      agents_consulted: ['academic-agent', 'events-agent', 'transport-agent'],
      evidence: [],
      risks: [],
      assumptions: [],
      required_approval: false,
      actions_taken: [],
      next_steps: ['Dispatch shuttle advisory via Communication Agent.'],
      emergency: null,
    }
  }

  if (q.includes('emergency') || q.includes('incident') || q.includes('medical')) {
    return {
      request_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      status: 'completed',
      summary:
        'Evaluated 7 recorded observations across 6 agents. Engineering Building A shows simultaneous maintenance, network, security and energy signals. Critical escalation prepared; human approval required.',
      decision: {
        decision_id: crypto.randomUUID(),
        problem: 'prepare_emergency_response',
        requester_id: 'demo',
        context: { source_status: { maintenance: 'available', it: 'available', security: 'available', energy: 'available' }, contradictions: [], preferred_option: null },
        relevant_systems: ['emergency', 'energy', 'it', 'maintenance', 'security', 'transport'],
        agents_consulted: ['emergency-agent', 'energy-agent', 'it-agent', 'maintenance-agent', 'security-agent', 'transport-agent'],
        evidence: [
          ev('maintenance', 'maintenance', 'Repeated Engineering Power Complaints', { complaint_count: 6, sla_breached: true }),
          ev('it', 'network_incident', 'Engineering Network Switch Outage', { affected_devices: 45 }),
          ev('security', 'security_incident', 'Engineering Access Alarm', { severity: 'medium' }),
          ev('energy', 'energy_reading', 'Engineering Building Peak Load', { kw: 280, peak_threshold_kw: 200 }),
        ],
        constraints: [],
        available_options: [],
        selected_action: {
          kind: 'escalate_incident',
          payload: { severity: 'critical', summary: 'Correlated building incident at Engineering Building A.' },
        },
        reason: 'Engineering Building A has simultaneous signals from maintenance (6 SLA-breached complaints), IT (45 devices offline), security (active access alarm) and energy (280 kW peak vs 200 kW threshold, zero occupancy).',
        confidence: 0.83,
        confidence_factors: { source_availability: 1.0, freshness: 0.9, agreement: 1.0, rule_validation: 1.0 },
        risks: ['CORRELATED_BUILDING_INCIDENT at Engineering Building A.'],
        assumptions: ['Critical interventions always require authorized human review.'],
        expected_impact: 'Escalation record created locally; no field dispatch performed.',
        approval_requirement: true,
        conflicts: [
          {
            conflict_id: 'demo-conflict-2',
            kind: 'CORRELATED_BUILDING_INCIDENT',
            severity: 'HIGH',
            description: 'Building A has simultaneous signals from multiple systems.',
            systems: ['maintenance', 'it', 'security', 'energy'],
            evidence_ids: [],
          },
        ],
        timestamp: nowIso,
      },
      systems_consulted: ['emergency', 'energy', 'it', 'maintenance', 'security', 'transport'],
      agents_consulted: ['emergency-agent', 'energy-agent', 'it-agent', 'maintenance-agent', 'security-agent', 'transport-agent'],
      evidence: [],
      risks: [],
      assumptions: [],
      required_approval: true,
      actions_taken: [],
      next_steps: ['Authorized operator must review and approve escalation.'],
      emergency: { human_approval_required: true, escalation_level: 1 },
    }
  }

  if (q.includes('library')) {
    return {
      request_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      status: 'completed',
      summary: 'Evaluated 2 recorded observations across 1 agent. The library copy of Distributed Systems has 2 of 5 copies available.',
      decision: {
        decision_id: crypto.randomUUID(),
        problem: 'search_library',
        requester_id: 'demo',
        context: { source_status: { library: 'available' }, contradictions: [], preferred_option: null },
        relevant_systems: ['library'],
        agents_consulted: ['library-agent'],
        evidence: [ev('library', 'book', 'Distributed Systems', { available_copies: 2, total_copies: 5 })],
        constraints: [],
        available_options: [],
        selected_action: null,
        reason: '2 of 5 library copies of "Distributed Systems" are currently available. A reservation exists for the sample student, due in 7 days.',
        confidence: 0.94,
        confidence_factors: { source_availability: 1, freshness: 0.97, agreement: 1, rule_validation: 1 },
        risks: [],
        assumptions: [],
        expected_impact: 'Direct factual answer.',
        approval_requirement: false,
        conflicts: [],
        timestamp: nowIso,
      },
      systems_consulted: ['library'],
      agents_consulted: ['library-agent'],
      evidence: [],
      risks: [],
      assumptions: [],
      required_approval: false,
      actions_taken: [],
      next_steps: [],
      emergency: null,
    }
  }

  // Default: campus-wide status / "what's happening"
  return {
    request_id: crypto.randomUUID(),
    correlation_id: crypto.randomUUID(),
    status: 'degraded',
    summary:
      'Evaluated 31 recorded observations across 17 agents. Three cross-system situations require attention: the Innovation Fair is driving transport delay and parking pressure, Engineering Building A has correlated maintenance/IT/security signals, and CS301 attendance is below the eligibility threshold.',
    decision: {
      decision_id: crypto.randomUUID(),
      problem: 'get_campus_status',
      requester_id: 'demo',
      context: { source_status: {}, contradictions: [], preferred_option: null },
      relevant_systems: domains,
      agents_consulted: domains.map((d) => `${d}-agent`),
      evidence: [
        ev('events', 'event', 'University Innovation Fair', { attendees: 220, congestion_expected: true }),
        ev('transport', 'route', 'Main Gate Route', { delay_minutes: 35, operational: true }),
        ev('parking', 'parking', 'Innovation Fair Parking', { capacity: 100, occupancy: 75 }),
        ev('maintenance', 'maintenance', 'Repeated Engineering Power Complaints', { complaint_count: 6, sla_breached: true }),
        ev('it', 'network_incident', 'Engineering Network Switch Outage', { affected_devices: 45 }),
        ev('attendance', 'attendance', 'CS301 Attendance', { percentage: 68, minimum_percentage: 75 }),
        ev('energy', 'energy_reading', 'Engineering Building Peak Load', { kw: 280, peak_threshold_kw: 200 }),
      ],
      constraints: [],
      available_options: [],
      selected_action: {
        kind: 'send_notification',
        payload: { audience: 'authorized-campus-operators', message: 'Three cross-system situations require coordination.' },
      },
      reason: 'Innovation Fair (220 attendees) correlates with a 35-min Main Gate delay and 75/100 parking occupancy. Engineering Building A shows correlated maintenance, network, security and energy signals. CS301 attendance (68%) is below the 75% eligibility threshold.',
      confidence: 0.74,
      confidence_factors: { source_availability: 0.88, freshness: 0.91, agreement: 0.85, rule_validation: 1.0 },
      risks: [
        'EXAM_TRANSPORT_DELAY: a delayed route serves the CS301 exam location.',
        'EVENT_TRANSPORT_CAPACITY_MISMATCH: expected transport demand 150 exceeds available seats.',
        'CORRELATED_BUILDING_INCIDENT at Engineering Building A.',
      ],
      assumptions: ['Source observations are accurate within their stated timestamps.'],
      expected_impact: 'Campus-wide situational awareness for operators.',
      approval_requirement: false,
      conflicts: [
        { conflict_id: 'd1', kind: 'EVENT_TRANSPORT_CAPACITY_MISMATCH', severity: 'MEDIUM', description: 'Innovation Fair transport demand 150 exceeds 75 available shuttle seats.', systems: ['events', 'transport'], evidence_ids: [] },
        { conflict_id: 'd2', kind: 'EXAM_TRANSPORT_DELAY', severity: 'HIGH', description: 'A delayed route serves the CS301 exam location.', systems: ['academic', 'transport'], evidence_ids: [] },
        { conflict_id: 'd3', kind: 'CORRELATED_BUILDING_INCIDENT', severity: 'HIGH', description: 'Engineering Building A has simultaneous signals from multiple systems.', systems: ['maintenance', 'it', 'security', 'energy'], evidence_ids: [] },
        { conflict_id: 'd4', kind: 'ATTENDANCE_ELIGIBILITY_RISK', severity: 'MEDIUM', description: 'CS301 attendance 68% is below the 75% eligibility threshold.', systems: ['attendance', 'academic'], evidence_ids: [] },
        { conflict_id: 'd5', kind: 'VENUE_DOUBLE_BOOKING', severity: 'HIGH', description: 'CS301 Examination overlaps the University Innovation Fair in Lecture Hall A101.', systems: ['academic', 'events'], evidence_ids: [] },
        { conflict_id: 'd6', kind: 'CLINIC_OVERLOAD', severity: 'HIGH', description: 'Campus Duty Doctor has 2 simultaneous appointments.', systems: ['health'], evidence_ids: [] },
      ],
      timestamp: nowIso,
    },
    systems_consulted: domains,
    agents_consulted: domains.map((d) => `${d}-agent`),
    evidence: [],
    risks: [],
    assumptions: [],
    required_approval: false,
    actions_taken: [],
    next_steps: ['Run coordinate_large_event for the Innovation Fair.', 'Investigate Engineering Building A incident cluster.'],
    emergency: null,
  }
}

export const DEMO_DECISIONS: DecisionDocument[] = [
  demoCommandResponse('campus status').decision,
  demoCommandResponse('find classroom').decision,
  demoCommandResponse('transport delay').decision,
  demoCommandResponse('incident').decision,
]

export interface ActivityItem {
  id: number
  time: string
  source: string
  text: string
  kind: 'agent' | 'nexus' | 'decision' | 'alert'
}

const ACTIVITY_SEED: Array<Omit<ActivityItem, 'id' | 'time'>> = [
  { source: 'transport-agent', text: 'detected 35 min delay on Main Gate Route', kind: 'agent' },
  { source: 'events-agent', text: 'large crowd forming near Engineering Block A (Innovation Fair)', kind: 'agent' },
  { source: 'nexus', text: 'correlated transport + event signals', kind: 'nexus' },
  { source: 'decision-engine', text: 'generated alternative route recommendation', kind: 'decision' },
  { source: 'communication-agent', text: 'prepared campus notification', kind: 'agent' },
  { source: 'parking-agent', text: 'Innovation Fair parking at 75/100 occupancy', kind: 'agent' },
  { source: 'security-agent', text: 'access alarm active at Engineering Building A', kind: 'alert' },
  { source: 'it-agent', text: 'network switch outage affecting 45 devices in Building A', kind: 'alert' },
  { source: 'energy-agent', text: 'peak load 280 kW with zero occupancy — anomaly flagged', kind: 'alert' },
  { source: 'attendance-agent', text: 'CS301 attendance 68% below 75% threshold', kind: 'agent' },
  { source: 'nexus', text: 'cross-system conflict scan found 6 correlations', kind: 'nexus' },
  { source: 'maintenance-agent', text: '6th SLA-breached power complaint in Building A', kind: 'alert' },
]

let activityId = 0
export function nextDemoActivity(): ActivityItem {
  const base = ACTIVITY_SEED[activityId % ACTIVITY_SEED.length]
  activityId += 1
  const t = new Date()
  return {
    ...base,
    id: activityId,
    time: t.toLocaleTimeString('en-GB', { hour12: false }),
  }
}

export const DEMO_CROSS_SYSTEM_SCENARIOS = [
  {
    id: 'event-transport-security',
    title: 'Large Event → Transport + Parking + Security',
    trigger: 'University Innovation Fair detected (220 attendees)',
    chain: [
      { system: 'events', detail: 'Crowd of 220 expected, congestion predicted' },
      { system: 'transport', detail: 'Transport demand 150 vs 75 free shuttle seats' },
      { system: 'parking', detail: 'Parking demand 80 vs 25 free spaces' },
      { system: 'security', detail: 'Monitoring level raised near Block A' },
    ],
    outcome: 'Coordinate Large Event workflow recommends shuttle reinforcement and overflow parking.',
    command: 'coordinate_large_event',
  },
  {
    id: 'exam-transport',
    title: 'Exam at 10 AM → Route Delay + Arrival Risk',
    trigger: 'CS301 Examination at 10:00 tomorrow',
    chain: [
      { system: 'academic', detail: 'CS301 exam scheduled, room A101' },
      { system: 'transport', detail: 'Main Gate Route delayed 35 min' },
      { system: 'transport', detail: 'East Gate Alternative: 18 min, no delay' },
      { system: 'academic', detail: 'Arrival risk calculated: main route misses deadline' },
    ],
    outcome: 'Optimize Transport workflow recommends the East Gate Alternative (arrives 22 min early).',
    command: 'optimize_transport',
  },
  {
    id: 'maintenance-facilities',
    title: 'Building Maintenance → Classroom Unavailable',
    trigger: 'Electrical-safety closure of Engineering Building A',
    chain: [
      { system: 'maintenance', detail: '6 SLA-breached power complaints' },
      { system: 'facilities', detail: 'Lecture Hall A101 marked restricted' },
      { system: 'academic', detail: 'CS301 exam + seminar conflict detected in A101' },
      { system: 'facilities', detail: 'Seminar Hall B201 found: capacity 150, projector, reachable' },
    ],
    outcome: 'Find Available Resources workflow recommends relocating to Seminar Hall B201.',
    command: 'find_available_resources',
  },
]
