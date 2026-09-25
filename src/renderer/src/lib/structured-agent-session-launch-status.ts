import { useSyncExternalStore } from 'react'
import type { AcpStructuredAgent } from '../../../shared/acp-agent-recipes'
import {
  getStructuredAgentLaunchStatus,
  subscribeStructuredAgentLaunchStatus
} from './structured-agent-session-launch-registry'

export function useStructuredAgentLaunchStatus(
  worktreeId: string,
  agent: AcpStructuredAgent
): ReturnType<typeof getStructuredAgentLaunchStatus> {
  return useSyncExternalStore(
    subscribeStructuredAgentLaunchStatus,
    () => getStructuredAgentLaunchStatus(worktreeId, agent),
    () => 'idle'
  )
}
