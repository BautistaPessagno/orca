import { cn } from '@/lib/utils'

/** The transcript's live-turn marker: a breathing orb with a pulsing halo. Purely
 *  decorative — every caller already announces the turn state, so an extra label
 *  here would double up on screen readers. Size it via `className`. */
export function NativeChatLoadingOrb({ className }: { className?: string }): React.JSX.Element {
  return <span aria-hidden="true" className={cn('native-chat-loading-orb size-2', className)} />
}
