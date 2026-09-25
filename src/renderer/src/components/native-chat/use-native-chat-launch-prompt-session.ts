import { useMemo } from 'react'
import type { NativeChatMessage } from '../../../../shared/native-chat-types'
import type { NativeChatLaunchPrompt } from '@/lib/native-chat-launch-prompt'
import { launchPromptAsMessage } from './native-chat-pending'
import {
  applyCommandMarkerBoundaries,
  type NativeChatCommandMarker
} from './native-chat-command-marker'

/** The session with the unsent launch prompt appended and slash-command boundaries applied. */
export function useNativeChatLaunchPromptSession<T extends { messages: NativeChatMessage[] }>(
  session: T,
  paneLaunchPrompt: NativeChatLaunchPrompt | null,
  commandMarkers: readonly NativeChatCommandMarker[]
): { sessionAfterCommandBoundaries: T; failedLaunchPromptMessageIds: Set<string> | undefined } {
  const launchPromptMessage = useMemo(
    () => launchPromptAsMessage(paneLaunchPrompt, session.messages),
    [paneLaunchPrompt, session.messages]
  )
  const sessionWithLaunchPrompt = useMemo<T>(() => {
    if (!launchPromptMessage) {
      return session
    }
    return { ...session, messages: [...session.messages, launchPromptMessage] }
  }, [launchPromptMessage, session])

  const sessionAfterCommandBoundaries = useMemo<T>(() => {
    const messages = applyCommandMarkerBoundaries(sessionWithLaunchPrompt.messages, commandMarkers)
    return messages === sessionWithLaunchPrompt.messages
      ? sessionWithLaunchPrompt
      : { ...sessionWithLaunchPrompt, messages }
  }, [sessionWithLaunchPrompt, commandMarkers])
  const failedLaunchPromptMessageIds = useMemo(() => {
    const id = paneLaunchPrompt?.failed ? launchPromptMessage?.id : null
    if (!id || !sessionAfterCommandBoundaries.messages.some((message) => message.id === id)) {
      return undefined
    }
    return new Set([id])
  }, [paneLaunchPrompt?.failed, launchPromptMessage?.id, sessionAfterCommandBoundaries.messages])
  return { sessionAfterCommandBoundaries, failedLaunchPromptMessageIds }
}
