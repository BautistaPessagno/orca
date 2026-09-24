import { translate } from '@/i18n/i18n'
import { NativeChatLoadingOrb } from './NativeChatLoadingOrb'

export function NativeChatTypingIndicatorRow(): React.JSX.Element {
  return (
    <div
      className="flex items-center justify-start"
      aria-label={translate('components.native-chat.status.responding', 'Agent is responding')}
      aria-live="polite"
    >
      <div className="flex h-8 items-center text-muted-foreground">
        <NativeChatLoadingOrb className="size-2.5" />
      </div>
    </div>
  )
}
