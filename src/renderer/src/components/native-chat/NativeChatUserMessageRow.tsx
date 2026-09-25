import { useState, type Ref } from 'react'
import { Goal } from 'lucide-react'
import CommentMarkdown, {
  type CommentMarkdownLinkClickHandler
} from '@/components/sidebar/CommentMarkdown'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { isAgentSessionContinuationPrompt } from '@/lib/agent-session-continuation'
import type { NativeChatBlock, NativeChatMessage } from '../../../../shared/native-chat-types'
import type { RuntimeFileOperationArgs } from '@/runtime/runtime-file-client'
import { NativeChatCodeBlock } from './NativeChatCodeBlock'
import { NativeChatMessageTimestamp } from './NativeChatMessageTimestamp'
import { NativeChatImageAttachments } from './NativeChatTranscriptChrome'

export function NativeChatUserMessageRow({
  rowRef,
  message,
  markdown,
  prose,
  onLinkClick,
  allowFileUriLinks = false,
  deliveryFailed = false,
  runtimeContext
}: {
  rowRef: Ref<HTMLDivElement>
  message: NativeChatMessage
  markdown: string
  prose: NativeChatBlock[]
  onLinkClick?: CommentMarkdownLinkClickHandler
  allowFileUriLinks?: boolean
  deliveryFailed?: boolean
  runtimeContext?: RuntimeFileOperationArgs | null
}): React.JSX.Element {
  return (
    <div ref={rowRef} className="group relative flex flex-col items-end gap-0.5">
      {isAgentSessionContinuationPrompt(markdown) ? (
        <ContinuationPromptCard
          markdown={markdown}
          prose={prose}
          onLinkClick={onLinkClick}
          allowFileUriLinks={allowFileUriLinks}
          runtimeContext={runtimeContext}
        />
      ) : (
        // User turns get a distinct muted fill so the prompt reads apart from the assistant's copy.
        <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-muted px-3.5 py-2.5 text-sm text-foreground">
          <UserPromptBody
            markdown={markdown}
            prose={prose}
            onLinkClick={onLinkClick}
            allowFileUriLinks={allowFileUriLinks}
            runtimeContext={runtimeContext}
          />
        </div>
      )}
      {message.sentAs === 'goal' ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Goal className="size-3" aria-hidden />
          <span>{translate('components.native-chat.goal.sentAsGoal', 'Sent as goal')}</span>
        </div>
      ) : null}
      <NativeChatMessageTimestamp
        timestamp={message.timestamp}
        focusable
        className="select-none transition-opacity can-hover:pointer-events-none can-hover:opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100"
      />
      {deliveryFailed ? (
        <div className="max-w-[85%] text-[11px] text-destructive/80">
          {translate(
            'components.native-chat.launchPromptNotDelivered',
            'Not delivered — check the terminal'
          )}
        </div>
      ) : null}
    </div>
  )
}

function ContinuationPromptCard({
  markdown,
  prose,
  onLinkClick,
  allowFileUriLinks,
  runtimeContext
}: {
  markdown: string
  prose: NativeChatBlock[]
  onLinkClick?: CommentMarkdownLinkClickHandler
  allowFileUriLinks?: boolean
  runtimeContext?: RuntimeFileOperationArgs | null
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const summary = translate(
    'components.native-chat.continuationPrompt.summary',
    'Continue from prior session'
  )
  return (
    <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-muted">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className={cn('transition-transform', open && 'rotate-90')}>
          ›
        </span>
        <span className="min-w-0 truncate">{summary}</span>
      </button>
      {open ? (
        <div className="px-3.5 pb-2.5 text-sm text-foreground">
          <UserPromptBody
            markdown={markdown}
            prose={prose}
            onLinkClick={onLinkClick}
            allowFileUriLinks={allowFileUriLinks}
            runtimeContext={runtimeContext}
          />
        </div>
      ) : null}
    </div>
  )
}

function UserPromptBody({
  markdown,
  prose,
  onLinkClick,
  allowFileUriLinks,
  runtimeContext
}: {
  markdown: string
  prose: NativeChatBlock[]
  onLinkClick?: CommentMarkdownLinkClickHandler
  allowFileUriLinks?: boolean
  runtimeContext?: RuntimeFileOperationArgs | null
}): React.JSX.Element {
  return (
    <>
      <NativeChatImageAttachments
        blocks={prose}
        runtimeContext={runtimeContext}
        enablePreview={runtimeContext !== undefined}
      />
      {markdown ? (
        <CommentMarkdown
          content={markdown}
          variant="document"
          className="text-sm"
          renderCodeBlock={NativeChatCodeBlock}
          onLinkClick={onLinkClick}
          allowFileUriLinks={allowFileUriLinks}
        />
      ) : null}
    </>
  )
}
