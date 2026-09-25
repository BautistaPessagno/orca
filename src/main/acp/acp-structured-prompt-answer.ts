import { parseAgentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import {
  AgentSessionPromptUnavailableError,
  type StructuredAgentSessionAdapter
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { AcpJsonRpcConnection } from './acp-jsonrpc-connection'
import { acpPromptReply, type AcpPendingPrompt } from './acp-session-events'

type AcpPromptSession = {
  connection: Pick<AcpJsonRpcConnection, 'respond'>
  pendingPermissions: Map<string, AcpPendingPrompt>
}

/** Claims the pending ACP request, commits the journal while holding it, then replies. */
export async function answerAcpStructuredPrompt(
  sessions: ReadonlyMap<string, AcpPromptSession>,
  input: Parameters<StructuredAgentSessionAdapter['answerPrompt']>[0]
): Promise<void> {
  const session = sessions.get(input.sessionId)
  const identity = parseAgentJournalItemKey(input.itemId)
  const pendingKey = identity?.provider === 'legacy' ? identity.recordId : input.itemId
  const pending = session?.pendingPermissions.get(pendingKey)
  if (!session || !pending) {
    throw new AgentSessionPromptUnavailableError(input.itemId)
  }
  // Deleting is the claim: a concurrent answer or cancel finds nothing to commit.
  session.pendingPermissions.delete(pendingKey)
  try {
    await input.commit()
  } catch (error) {
    if (sessions.get(input.sessionId) === session) {
      session.pendingPermissions.set(pendingKey, pending)
    }
    throw error
  }
  if (sessions.get(input.sessionId) !== session) {
    throw new AgentSessionPromptUnavailableError(input.itemId)
  }
  session.connection.respond(pending.id, acpPromptReply(pending, pendingKey, input.optionId))
}
