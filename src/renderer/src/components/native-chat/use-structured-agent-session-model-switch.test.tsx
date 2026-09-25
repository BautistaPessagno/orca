// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  operationId: vi.fn(),
  enqueueSettingsWrite: vi.fn()
}))
let fence = 3
let items: AgentJournalRenderItem[] = []
let submissions: AgentJournalSubmission[] = []

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))

vi.mock('./native-chat-session-option-settings-write', () => ({
  enqueueSessionOptionSettingsWrite: mocks.enqueueSettingsWrite
}))

vi.mock('./use-structured-agent-session-read', () => ({
  useStructuredAgentSessionRead: () => ({
    state: {
      fence,
      commands: undefined,
      items,
      submissions,
      status: 'ready',
      error: null,
      hasOlder: false,
      handoff: null
    },
    loadingOlder: false,
    loadOlder: vi.fn()
  })
}))

vi.mock('./use-structured-agent-session-outbox', () => ({
  structuredSessionOperationId: mocks.operationId,
  useStructuredAgentSessionOutbox: () => ({
    outbox: [],
    blockedClientMessageId: null,
    error: null,
    send: vi.fn(),
    retry: vi.fn()
  })
}))

import type {
  AgentJournalRenderItem,
  AgentJournalSubmission
} from '../../../../shared/agent-session-journal-types'
import { useStructuredAgentSession } from './use-structured-agent-session'

const LOCAL_TARGET = { kind: 'local' } as const

const OPTIONS = {
  models: [
    {
      id: 'gpt-live',
      label: 'GPT Live',
      isDefault: true,
      defaultEffort: 'medium',
      efforts: [
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]
    },
    {
      id: 'gpt-fast',
      label: 'GPT Fast',
      isDefault: false,
      defaultEffort: 'low',
      efforts: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' }
      ]
    }
  ],
  current: { model: 'gpt-live', effort: 'medium' }
}

describe('useStructuredAgentSession model and provider switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fence = 3
    submissions = []
    mocks.operationId
      .mockReset()
      .mockReturnValueOnce('operation-1')
      .mockReturnValueOnce('operation-2')
    mocks.call.mockImplementation((_target, method) =>
      method === 'agentSession.options' ? Promise.resolve(OPTIONS) : Promise.resolve(null)
    )
  })

  it('refreshes effort choices returned by the selected model', async () => {
    let selected = false
    mocks.call.mockImplementation((_target, method) => {
      if (method === 'agentSession.options') {
        return Promise.resolve(
          selected
            ? {
                models: [
                  {
                    id: 'gpt-fast',
                    label: 'GPT Fast',
                    isDefault: true,
                    efforts: [
                      { value: 'low', label: 'Low' },
                      { value: 'xhigh', label: 'Extra high' }
                    ]
                  }
                ],
                current: { model: 'gpt-fast', effort: 'xhigh' }
              }
            : OPTIONS
        )
      }
      selected = method === 'agentSession.setOption' || selected
      return Promise.resolve({
        ok: true,
        value: { key: 'model', value: 'gpt-fast', options: { model: 'gpt-fast', effort: 'xhigh' } }
      })
    })
    const { result } = renderHook(() =>
      useStructuredAgentSession({
        sessionId: 'session-1',
        target: LOCAL_TARGET,
        agent: 'codex',
        isVisible: true
      })
    )
    await waitFor(() => expect(result.current.optionSnapshot).toHaveLength(2))
    await act(async () => {
      await result.current.setStructuredOption('model', 'codex:gpt-fast')
    })
    expect(
      result.current.optionSnapshot.find((option) => option.id === 'effort')?.kind
    ).toMatchObject({
      currentValue: 'xhigh',
      choices: [
        { value: 'low', label: 'Low' },
        { value: 'xhigh', label: 'Extra high' }
      ]
    })
  })

  it('routes a cross-provider model pick to switchProvider', async () => {
    mocks.call.mockImplementation((_target, method) => {
      if (method === 'agentSession.options') {
        return Promise.resolve({
          models: [{ id: 'grok-4.6', label: 'Grok 4.6', isDefault: true, efforts: [] }],
          current: { model: 'grok-4.6' }
        })
      }
      if (method === 'agentSession.switchProvider') {
        return Promise.resolve({ ok: true, value: { agent: 'claude', provider: 'claude' } })
      }
      return Promise.resolve({ supported: true, canSwitchProvider: true })
    })
    const { result } = renderHook(() =>
      useStructuredAgentSession({
        sessionId: 'session-1',
        target: LOCAL_TARGET,
        agent: 'grok',
        isVisible: true,
        worktreeId: 'workspace-1'
      })
    )
    await waitFor(() =>
      expect(result.current.optionSnapshot.find((entry) => entry.id === 'model')).toBeTruthy()
    )
    await act(async () => {
      expect(await result.current.setStructuredOption('model', 'claude:sonnet')).toBe(true)
    })
    expect(
      mocks.call.mock.calls.some(([, method]) => method === 'agentSession.switchProvider')
    ).toBe(true)
  })

  it('retires a completed switch operation even when the stream advances the fence first', async () => {
    let reply!: (value: unknown) => void
    mocks.call.mockImplementation((_target, method) => {
      if (method === 'agentSession.options') {
        return Promise.resolve(OPTIONS)
      }
      if (method === 'agentSession.switchProvider') {
        return new Promise((resolve) => {
          reply = resolve
        })
      }
      return Promise.resolve({ supported: true, canSwitchProvider: true })
    })
    const { result, rerender } = renderHook(() =>
      useStructuredAgentSession({
        sessionId: 'session-1',
        target: LOCAL_TARGET,
        agent: 'codex',
        isVisible: true,
        worktreeId: 'workspace-1'
      })
    )
    await waitFor(() => expect(result.current.optionSnapshot).toHaveLength(2))
    let switching!: Promise<boolean>
    act(() => {
      switching = result.current.setStructuredOption('model', 'claude:sonnet')
    })
    fence = 4
    rerender()
    await act(async () => {
      reply({ ok: true, fence: 4, value: { agent: 'claude', provider: 'claude' } })
      expect(await switching).toBe(true)
    })
    await act(async () => {
      const next = result.current.setStructuredOption('model', 'claude:sonnet')
      reply({ ok: true, fence: 4, value: { agent: 'claude', provider: 'claude' } })
      await next
    })
    const calls = mocks.call.mock.calls.filter(
      ([, method]) => method === 'agentSession.switchProvider'
    )
    expect(calls.map(([, , params]) => params.envelope.clientOperationId)).toEqual([
      'operation-1',
      'operation-2'
    ])
  })

  it('leaves other providers disabled when the host does not advertise switching', async () => {
    mocks.call.mockImplementation((_target, method) =>
      Promise.resolve(method === 'agentSession.options' ? OPTIONS : { supported: true })
    )
    const { result } = renderHook(() =>
      useStructuredAgentSession({
        sessionId: 'session-1',
        target: LOCAL_TARGET,
        agent: 'codex',
        isVisible: true,
        worktreeId: 'workspace-1'
      })
    )
    await waitFor(() => expect(result.current.optionSnapshot).toHaveLength(2))
    await act(async () => {
      expect(await result.current.setStructuredOption('model', 'claude:sonnet')).toBe(false)
    })
    expect(
      mocks.call.mock.calls.some(([, method]) => method === 'agentSession.switchProvider')
    ).toBe(false)
  })
})
