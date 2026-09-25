import { useCallback, type MutableRefObject } from 'react'
import type { SessionOptionDescriptor } from '../../../../shared/native-chat-session-options'
import type { StructuredAgentSessionOptionState } from '../../../../shared/structured-agent-session-options'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

export function useStructuredAgentSessionProviderSwitch(args: {
  mutate: StructuredAgentSessionMutate
  optionSnapshot: SessionOptionDescriptor[]
  transportEnabled: boolean
  updateOptionState: (
    update: (current: StructuredAgentSessionOptionState) => StructuredAgentSessionOptionState
  ) => void
  pendingOptionRef: MutableRefObject<string | null>
  optionStateRef: MutableRefObject<StructuredAgentSessionOptionState>
  activeOptionRecordRef: MutableRefObject<StructuredAgentSessionOptionState['record']>
}): (cross: { agent: string; modelId: string }, value: string) => Promise<boolean> {
  const {
    mutate,
    optionSnapshot,
    transportEnabled,
    updateOptionState,
    pendingOptionRef,
    optionStateRef,
    activeOptionRecordRef
  } = args
  // A model from another provider replaces the provider in place; the host carries the history.
  return useCallback(
    async (cross: { agent: string; modelId: string }, value: string): Promise<boolean> => {
      const selected = optionSnapshot.find((option) => option.id === 'model')
      if (
        !transportEnabled ||
        pendingOptionRef.current !== null ||
        selected?.kind.type !== 'select' ||
        !selected.kind.choices.some((choice) => choice.value === value && !choice.disabled)
      ) {
        return false
      }
      const targetRecord = optionStateRef.current.record
      pendingOptionRef.current = 'model'
      updateOptionState((current) => ({ ...current, pendingId: 'model' }))
      try {
        const switched = await mutate(
          'agentSession.switchProvider',
          'agentSession.switchProvider',
          { agent: cross.agent, model: cross.modelId }
        )
        return Boolean(switched)
      } finally {
        if (activeOptionRecordRef.current === targetRecord) {
          pendingOptionRef.current = null
          updateOptionState((current) =>
            current.record === targetRecord && current.pendingId === 'model'
              ? { ...current, pendingId: null }
              : current
          )
        }
      }
    },
    [
      activeOptionRecordRef,
      mutate,
      optionSnapshot,
      optionStateRef,
      pendingOptionRef,
      transportEnabled,
      updateOptionState
    ]
  )
}
