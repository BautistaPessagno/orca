import { ChildProcess, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'

import { AcpJsonRpcRequestError, openAcpJsonRpcConnection } from './acp-jsonrpc-connection'

function parseRequest(line: string): { raw: unknown; method?: string; id?: number } {
  const raw: unknown = JSON.parse(line)
  if (typeof raw !== 'object' || raw === null) {
    return { raw }
  }
  return {
    raw,
    ...('method' in raw && typeof raw.method === 'string' ? { method: raw.method } : {}),
    ...('id' in raw && typeof raw.id === 'number' ? { id: raw.id } : {})
  }
}

function fakeAcpChild(script?: { initialize?: 'ok' | 'error' }): {
  child: ChildProcessWithoutNullStreams & { stdin: PassThrough; stdout: PassThrough }
  requests: unknown[]
} {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const requests: unknown[] = []
  stdin.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim().length === 0) {
        continue
      }
      const message = parseRequest(line)
      requests.push(message.raw)
      if (message.method === 'initialize' && typeof message.id === 'number') {
        if (script?.initialize === 'error') {
          stdout.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32000, message: 'initialize failed' }
            })}\n`
          )
          continue
        }
        stdout.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: { protocolVersion: 1, authMethods: [] }
          })}\n`
        )
      }
    }
  })
  const stdio: ChildProcessWithoutNullStreams['stdio'] = [stdin, stdout, stderr, null, null]
  const child = Object.assign(new ChildProcess(), {
    stdin,
    stdout,
    stderr,
    stdio,
    kill: () => {
      child.emit('exit', 0, null)
      return true
    }
  })
  return { child, requests }
}

describe('ACP JSON-RPC connection', () => {
  it('initializes then answers a session/new request', async () => {
    const fake = fakeAcpChild()
    fake.child.stdin.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split('\n')) {
        if (line.trim().length === 0) {
          continue
        }
        const message = parseRequest(line)
        if (message.method === 'session/new' && typeof message.id === 'number') {
          fake.child.stdout.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: { sessionId: 'sess-1', configOptions: [] }
            })}\n`
          )
        }
      }
    })
    const connection = await openAcpJsonRpcConnection(
      { command: 'grok', args: ['agent', 'stdio'] },
      {},
      () => fake.child
    )
    expect(fake.requests[0]).toMatchObject({ method: 'initialize' })
    expect(connection.initialize).toMatchObject({ protocolVersion: 1 })
    const created = await connection.request('session/new', { cwd: '/repo', mcpServers: [] })
    expect(created).toEqual({ sessionId: 'sess-1', configOptions: [] })
    await connection.close()
  })

  it('fails create when initialize returns an error', async () => {
    const fake = fakeAcpChild({ initialize: 'error' })
    await expect(
      openAcpJsonRpcConnection({ command: 'missing', args: [] }, {}, () => fake.child)
    ).rejects.toBeInstanceOf(AcpJsonRpcRequestError)
  })

  it('rejects in-flight requests when stdin is closed while the child is alive', async () => {
    const fake = fakeAcpChild()
    const connection = await openAcpJsonRpcConnection(
      { command: 'grok', args: ['agent', 'stdio'] },
      {},
      () => fake.child
    )
    fake.child.stdin.destroy()
    await expect(
      connection.request('session/prompt', { sessionId: 'sess-1' }, { timeoutMs: 0 })
    ).rejects.toMatchObject({
      name: 'AcpJsonRpcRequestError',
      message: 'ACP session/prompt could not be written; stdin is closed'
    })
  })
})
