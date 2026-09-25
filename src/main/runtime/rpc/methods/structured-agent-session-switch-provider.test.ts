// `agentSession.switchProvider` and ACP create intents at the wire boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeAgentSessionPayloadFingerprint } from '../../../../shared/agent-session-mutation-envelope'
import {
  call,
  clearStructuredHostStub,
  envelope,
  hostCalls,
  installStructuredHostStub,
  runtimeCalls,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

beforeEach(() => {
  installStructuredHostStub()
})

afterEach(() => {
  clearStructuredHostStub()
})

describe('agentSession.switchProvider', () => {
  it('switches provider on the attached session and republishes the tab agent', async () => {
    hostCalls.listSessionTabs
      .mockReturnValueOnce([{ sessionId: SESSION, workspaceId: 'workspace-1', agent: 'grok' }])
      .mockReturnValue([{ sessionId: SESSION, workspaceId: 'workspace-1', agent: 'claude' }])
    const fields = { agent: 'claude' as const, model: 'sonnet' }
    const response = await call(
      'agentSession.switchProvider',
      {
        envelope: envelope({
          payloadFingerprint: computeAgentSessionPayloadFingerprint({
            method: 'agentSession.switchProvider',
            sessionId: SESSION,
            fields
          })
        }),
        ...fields
      },
      STRUCTURED_CLIENT
    )
    expect(response).toMatchObject({
      ok: true,
      result: { ok: true, value: { agent: 'claude', provider: 'claude' } }
    })
    expect(hostCalls.switchProvider).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agent: 'claude',
        provider: 'claude',
        model: 'sonnet'
      })
    )
    expect(runtimeCalls.publishStructuredAgentSessionTab).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, agent: 'claude', activate: true })
    )
  })

  it('restamps the switch envelope with the account home the host actually resolved', async () => {
    hostCalls.listSessionTabs
      .mockReturnValueOnce([{ sessionId: SESSION, workspaceId: 'workspace-1', agent: 'grok' }])
      .mockReturnValue([{ sessionId: SESSION, workspaceId: 'workspace-1', agent: 'claude' }])
    const fields = { agent: 'claude' as const, model: 'sonnet' }
    await call(
      'agentSession.switchProvider',
      {
        envelope: envelope({
          payloadFingerprint: computeAgentSessionPayloadFingerprint({
            method: 'agentSession.switchProvider',
            sessionId: SESSION,
            fields
          })
        }),
        ...fields
      },
      STRUCTURED_CLIENT
    )
    expect(hostCalls.switchProvider.mock.calls[0]?.[1]?.envelope.payloadFingerprint).toBe(
      computeAgentSessionPayloadFingerprint({
        method: 'agentSession.switchProvider',
        sessionId: SESSION,
        fields: {
          ...fields,
          provider: 'claude',
          accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/host/.claude' }
        }
      })
    )
  })

  it('refuses a switch whose declared intent fingerprint does not match its params', async () => {
    const response = await call(
      'agentSession.switchProvider',
      { envelope: envelope(), agent: 'claude', model: 'sonnet' },
      STRUCTURED_CLIENT
    )
    expect(response).toMatchObject({ ok: true, result: { ok: false } })
    expect(hostCalls.switchProvider).not.toHaveBeenCalled()
  })

  it('reports an unknown outcome when the tab cannot be published after a committed switch', async () => {
    hostCalls.listSessionTabs
      .mockReturnValueOnce([{ sessionId: SESSION, workspaceId: 'workspace-1', agent: 'grok' }])
      .mockReturnValue([{ sessionId: SESSION, workspaceId: 'workspace-1', agent: 'claude' }])
    const fields = { agent: 'claude' as const, model: 'sonnet' }
    const response = await call(
      'agentSession.switchProvider',
      {
        envelope: envelope({
          payloadFingerprint: computeAgentSessionPayloadFingerprint({
            method: 'agentSession.switchProvider',
            sessionId: SESSION,
            fields
          })
        }),
        ...fields
      },
      STRUCTURED_CLIENT,
      {
        publishStructuredAgentSessionTab: vi.fn(async () => {
          throw new Error('snapshot write failed')
        })
      }
    )
    expect(response).toMatchObject({
      ok: true,
      result: { ok: false, refusal: { code: 'agent_session_operation_unknown' } }
    })
  })

  it('keeps current provider metadata when replaying an earlier switch', async () => {
    hostCalls.switchProvider.mockResolvedValueOnce({
      ok: true,
      replayed: true,
      value: { agent: 'claude', provider: 'claude' }
    })
    hostCalls.listSessionTabs.mockReturnValue([
      { sessionId: SESSION, workspaceId: 'workspace-1', agent: 'grok' }
    ])
    const fields = { agent: 'claude' as const, model: 'sonnet' }
    await call(
      'agentSession.switchProvider',
      {
        envelope: envelope({
          payloadFingerprint: computeAgentSessionPayloadFingerprint({
            method: 'agentSession.switchProvider',
            sessionId: SESSION,
            fields
          })
        }),
        ...fields
      },
      STRUCTURED_CLIENT
    )
    expect(runtimeCalls.publishStructuredAgentSessionTab).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'grok', activate: false })
    )
  })
})

describe('ACP create intents', () => {
  const rejects = async (method: string, params: unknown): Promise<void> => {
    const response = await call(method, params, STRUCTURED_CLIENT)
    expect(response).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
  }

  it('accepts ACP create intents and still rejects unknown agents', async () => {
    const fields = { worktree: 'id:workspace-1', agent: 'grok' as const }
    const created = await call(
      'agentSession.create',
      {
        envelope: envelope({
          expectedRuntimeFence: null,
          payloadFingerprint: computeAgentSessionPayloadFingerprint({
            method: 'agentSession.create',
            sessionId: SESSION,
            fields
          })
        }),
        ...fields
      },
      STRUCTURED_CLIENT
    )
    expect(created).toMatchObject({ ok: true })
    expect(runtimeCalls.publishStructuredAgentSessionTab).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'grok', activate: true })
    )
    await rejects('agentSession.createSupport', {
      worktree: 'id:workspace-1',
      agent: 'gemini'
    })
  })
})
