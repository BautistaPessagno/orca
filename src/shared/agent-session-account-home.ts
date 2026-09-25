const AGENT_SESSION_ACCOUNT_HOME_VARIABLES = [
  'CLAUDE_CONFIG_DIR',
  'CODEX_HOME',
  'GROK_HOME',
  'CURSOR_CONFIG_DIR'
] as const
const MAX_PATH_LENGTH = 4096

/** Account root pinned at launch by the account selector, so a resume cannot drift to another login. */
export type AgentSessionAccountHome = {
  variable: (typeof AGENT_SESSION_ACCOUNT_HOME_VARIABLES)[number]
  /** Host-resolved absolute path in the execution host's own path syntax. */
  path: string
}

export function isAgentSessionAccountHome(value: unknown): value is AgentSessionAccountHome {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const home = value as Partial<AgentSessionAccountHome>
  return (
    AGENT_SESSION_ACCOUNT_HOME_VARIABLES.some((variable) => variable === home.variable) &&
    typeof home.path === 'string' &&
    home.path.length > 0 &&
    home.path.length <= MAX_PATH_LENGTH
  )
}
