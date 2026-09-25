import { defineMethod } from '../core'
import { supportsStructuredSessions } from './structured-agent-session-gate'
import { CreateSupportParams } from './structured-agent-session-schemas'

export const STRUCTURED_AGENT_SESSION_CREATE_SUPPORT_METHOD = defineMethod({
  name: 'agentSession.createSupport',
  params: CreateSupportParams,
  handler: async (params, ctx) => {
    if (!supportsStructuredSessions(ctx)) {
      throw new Error('structured_agent_session_unsupported')
    }
    return {
      ...(await ctx.runtime.getStructuredAgentSessionCreateSupport(params.worktree, params.agent)),
      canSwitchProvider: true
    }
  }
})
