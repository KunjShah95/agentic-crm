/**
 * Agents module — Phase 2 stub.
 *
 * Phase 1 ships no AI features, but this module defines the call signature
 * Phase 2 will implement. The activity logging interface (lib/actions/activities)
 * already accepts `source: 'manual' | 'agent'` so agents can write the same rows.
 */

export type AgentType =
  | "outreach"
  | "research"
  | "scheduler"
  | "qualifier"
  | "summarizer"

export type AgentPayload = Record<string, unknown>

export type AgentResult = {
  status: "noop" | "completed"
  type: AgentType
  workspaceId: string
  output: unknown
}

/**
 * Phase 2 replaces the internals without changing this signature.
 */
export async function runAgent(
  type: AgentType,
  workspaceId: string,
  payload: AgentPayload = {}
): Promise<AgentResult> {
  console.log(`[agents] stub run of "${type}" for workspace ${workspaceId}`, payload)
  return {
    status: "noop",
    type,
    workspaceId,
    output: { note: "Agent execution is not available in Phase 1." },
  }
}
