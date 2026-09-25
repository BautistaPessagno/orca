// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionOptionDescriptor } from '../../../../shared/native-chat-session-options'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
      fallback
    )
}))
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: ({ agent }: { agent: string }) => <span data-agent={agent} />
}))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  )
}))

import { NativeChatModelPicker } from './NativeChatModelPicker'

afterEach(cleanup)

const descriptor: SessionOptionDescriptor = {
  id: 'model',
  category: 'model',
  label: 'Model',
  valueSource: 'applied',
  transport: 'catalog',
  settable: true,
  kind: {
    type: 'select',
    currentValue: 'claude:sonnet',
    choices: [
      { value: 'claude:sonnet', label: 'Sonnet', group: 'Claude' },
      { value: 'codex:gpt-5', label: 'GPT-5', group: 'Codex' }
    ]
  }
}

describe('NativeChatModelPicker', () => {
  it('labels other providers as continuing in a new session', async () => {
    render(
      <NativeChatModelPicker
        descriptor={descriptor}
        disabled={false}
        defaultOpen={false}
        onSelect={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Model Sonnet' }))
    await screen.findByRole('dialog')
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByText('Codex · continues in a new session')).toBeTruthy()
  })

  it('explains why the picker is disabled', () => {
    render(
      <NativeChatModelPicker
        descriptor={descriptor}
        disabled
        disabledReason="Finish or stop the current turn to change the model"
        defaultOpen={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByTestId('tooltip').textContent).toBe(
      'Finish or stop the current turn to change the model'
    )
  })
})
