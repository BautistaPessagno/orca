import type { AcpStructuredAgent } from '../../../shared/acp-agent-recipes'
import { getAgentCatalog } from '@/lib/agent-catalog'

export function structuredAgentLabel(agent: AcpStructuredAgent): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}
