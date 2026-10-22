import { diffArrays } from 'diff'

export type ToolId = 'json' | 'scanner' | 'snippets' | 'diff' | 'regex' | 'deobfuscator' | 'http'
export type Snippet = {
  id: string
  title: string
  language: string
  tags: string[]
  code: string
  favorite: boolean
  updatedAt: number
  example?: boolean
}

export function normalizeSnippets(value: unknown): Snippet[] | null {
  if (!Array.isArray(value)) return null
  if (value.some((item) => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.language !== 'string' || typeof item.code !== 'string' || !Array.isArray(item.tags))) return null
  return value.map((item) => ({
    id: item.id,
    title: item.title,
    language: item.language,
    tags: item.tags.map(String),
    code: item.code,
    favorite: Boolean(item.favorite),
    updatedAt: Number(item.updatedAt) || Date.now(),
    ...(item.example === true ? { example: true } : {}),
  }))
}

export function parseSnippetImport(json: string, createId: () => string = () => crypto.randomUUID()): Snippet[] {
  const value: unknown = JSON.parse(json)
  if (!Array.isArray(value) || value.some((item) => !item || typeof item.title !== 'string' || typeof item.code !== 'string' || typeof item.language !== 'string')) {
    throw new Error('Expected a JSON array of snippets with title, language, and code.')
  }
  return value.map((item) => ({
    id: createId(),
    title: item.title,
    language: item.language,
    code: item.code,
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    favorite: Boolean(item.favorite),
    updatedAt: Date.now(),
  }))
}

export function upsertSnippet(snippets: Snippet[], snippet: Snippet): Snippet[] {
  return snippets.some((item) => item.id === snippet.id)
    ? snippets.map((item) => item.id === snippet.id ? snippet : item)
    : [snippet, ...snippets]
}

export function removeSnippet(snippets: Snippet[], id: string): Snippet[] {
  return snippets.filter((item) => item.id !== id)
}

export const TOOL_INFO: Record<ToolId, { title: string; description: string; short: string }> = {
  json: { title: 'JSON Toolkit', description: 'Format, validate, and reshape JSON.', short: 'Read and clean JSON' },
  scanner: { title: 'Secret Scanner', description: 'Spot credentials before they leave your machine.', short: 'Find exposed credentials' },
  snippets: { title: 'Snippet Vault', description: 'Keep useful code close at hand.', short: 'Your reusable code' },
  diff: { title: 'Code Diff', description: 'Compare versions, line by line.', short: 'Compare two versions' },
  regex: { title: 'Regex Tester', description: 'Test patterns against real text.', short: 'Explore a pattern' },
  deobfuscator: { title: 'Deobfuscator', description: 'Decode common text encodings without running code.', short: 'Decode encoded text' },
  http: { title: 'HTTP Inspector', description: 'Look up status codes and inspect headers.', short: 'Inspect HTTP details' },
}

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'json', label: TOOL_INFO.json.title },
  { id: 'scanner', label: TOOL_INFO.scanner.title },
  { id: 'snippets', label: TOOL_INFO.snippets.title },
  { id: 'diff', label: TOOL_INFO.diff.title },
  { id: 'regex', label: TOOL_INFO.regex.title },
  { id: 'deobfuscator', label: TOOL_INFO.deobfuscator.title },
  { id: 'http', label: TOOL_INFO.http.title },
  { id: 'settings', label: 'Settings' },
] as const

export const EXAMPLE_SNIPPETS: Snippet[] = [
  { id: 'example-fetch', title: 'Fetch with timeout', language: 'TypeScript', tags: ['http', 'async'], code: "const controller = new AbortController()\nconst timeout = setTimeout(() => controller.abort(), 5000)\n\ntry {\n  const response = await fetch('/api/items', { signal: controller.signal })\n  if (!response.ok) throw new Error(`HTTP ${response.status}`)\n  return await response.json()\n} finally {\n  clearTimeout(timeout)\n}", favorite: true, updatedAt: 1720000000000, example: true },
  { id: 'example-group', title: 'Group an array', language: 'JavaScript', tags: ['arrays'], code: "const groupBy = (items, key) =>\n  items.reduce((groups, item) => {\n    const group = item[key]\n    ;(groups[group] ??= []).push(item)\n    return groups\n  }, {})", favorite: false, updatedAt: 1719900000000, example: true },
  { id: 'example-sql', title: 'Parameterized query', language: 'SQL', tags: ['database', 'safety'], code: 'SELECT id, email\nFROM users\nWHERE status = $1\nORDER BY created_at DESC\nLIMIT $2;', favorite: false, updatedAt: 1719800000000, example: true },
]

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]))
  }
  return value
}

export function transformJson(input: string, mode: 'format' | 'minify', sortKeys = false): string {
  const parsed: unknown = JSON.parse(input)
  return JSON.stringify(sortKeys ? sortJson(parsed) : parsed, null, mode === 'format' ? 2 : undefined)
}

export type SecretFinding = { id: string; type: string; line: number; preview: string; value: string }

export function scanSecrets(source: string): SecretFinding[] {
  const patterns: Array<[string, RegExp]> = [
    ['Private key', /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g],
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
    ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
    ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
    ['Bearer token', /\bBearer\s+([A-Za-z0-9._~+/-]{12,})/gi],
    ['JWT', /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g],
    ['API token', /\b(?:sk_(?:live|test)|sk-proj|rk_(?:live|test)|sk)-[A-Za-z0-9_-]{16,}\b/g],
    ['Generic API key', /\b(?:api[_-]?key|access[_-]?token)\s*[:=]\s*["']?([A-Za-z0-9_./+\-=]{12,})/gi],
    ['Password assignment', /\b(?:password|passwd|pwd)\s*[:=]\s*(?:["']([^"']{4,})["']|([^\s,;#]{4,}))/gi],
    ['Secret assignment', /\b(?:client[_-]?secret|secret[_-]?key|auth[_-]?token|token)\s*[:=]\s*["']?([A-Za-z0-9_./+\-=]{12,})/gi],
  ]
  const findings: SecretFinding[] = []
  for (const [type, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[0]
      const start = (match.index ?? 0) + (match[1] ? match[0].lastIndexOf(value) : 0)
      const line = source.slice(0, match.index ?? 0).split('\n').length
      const lineText = source.split('\n')[line - 1] ?? ''
      const masked = value.length <= 8 ? `${value.slice(0, 2)}••••` : `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`
      const preview = lineText.split(value).join(masked).trim().slice(0, 140)
      findings.push({ id: `${type}-${start}`, type, line, preview, value })
    }
  }
  return findings.sort((a, b) => a.line - b.line)
}

export type DiffRow = { left: string; right: string; type: 'same' | 'added' | 'removed' | 'changed' }

export function compareText(leftText: string, rightText: string, ignoreWhitespace = false): DiffRow[] {
  const leftLines = leftText.split('\n')
  const rightLines = rightText.split('\n')
  const changes = diffArrays(leftLines, rightLines, {
    comparator: ignoreWhitespace ? (left, right) => left.trim() === right.trim() : undefined,
  })
  const rows: DiffRow[] = []
  let removed: string[] = []
  let added: string[] = []
  let leftIndex = 0
  let rightIndex = 0
  const flush = () => {
    const paired = Math.min(removed.length, added.length)
    for (let index = 0; index < paired; index++) rows.push({ left: removed[index], right: added[index], type: 'changed' })
    for (let index = paired; index < removed.length; index++) rows.push({ left: removed[index], right: '', type: 'removed' })
    for (let index = paired; index < added.length; index++) rows.push({ left: '', right: added[index], type: 'added' })
    removed = []
    added = []
  }
  for (const part of changes) {
    if (part.added) {
      added.push(...part.value)
      rightIndex += part.value.length
    } else if (part.removed) {
      removed.push(...part.value)
      leftIndex += part.value.length
    }
    else {
      flush()
      for (let index = 0; index < part.value.length; index++) {
        rows.push({ left: leftLines[leftIndex++], right: rightLines[rightIndex++], type: 'same' })
      }
    }
  }
  flush()
  return rows
}

export type RegexMatch = { value: string; index: number; groups: Array<string | undefined>; namedGroups: Record<string, string | undefined> }

export function testRegex(pattern: string, flags: string, text: string): RegexMatch[] {
  const expression = new RegExp(pattern, [...new Set(flags)].join(''))
  const matches: RegexMatch[] = []
  while (matches.length < 500) {
    const match = expression.exec(text)
    if (match === null) break
    matches.push({ value: match[0], index: match.index, groups: match.slice(1), namedGroups: match.groups ?? {} })
    if (!expression.global) break
    if (!match[0]) expression.lastIndex++
  }
  return matches
}

export function replaceRegex(pattern: string, flags: string, text: string, replacement: string): string {
  return text.replace(new RegExp(pattern, flags), replacement)
}

export type DecodeOperation = 'base64' | 'url' | 'unicode' | 'html'

export function decodeObfuscatedText(input: string, operations: DecodeOperation[]): { output: string; steps: string[] } {
  let output = input
  const steps: string[] = []
  for (const operation of operations) {
    if (operation === 'base64') {
      try {
        const normalized = output.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
        const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
        output = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
        steps.push('Base64 decoded')
      } catch {
        throw new Error('Base64 decoding failed. Check that the input is valid Base64 text.')
      }
    } else if (operation === 'url') {
      try {
        output = decodeURIComponent(output.replace(/\+/g, '%20'))
        steps.push('URL encoding decoded')
      } catch {
        throw new Error('URL decoding failed. Check for incomplete or invalid percent-encoded characters.')
      }
    } else if (operation === 'unicode') {
      output = output.replace(/\\u([\da-f]{4})\\u([\da-f]{4})|\\u\{([\da-f]{1,6})\}|\\u([\da-f]{4})|\\x([\da-f]{2})/gi, (escape, first: string | undefined, second: string | undefined, codePoint: string | undefined, unicode: string | undefined, hex: string | undefined) => {
        if (first && second) {
          const high = Number.parseInt(first, 16)
          const low = Number.parseInt(second, 16)
          if (high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) {
            return String.fromCodePoint(0x10000 + ((high - 0xd800) << 10) + low - 0xdc00)
          }
          return escape
        }
        const value = Number.parseInt(codePoint ?? unicode ?? hex ?? '', 16)
        return value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : escape
      })
      steps.push('Unicode escapes decoded')
    } else {
      output = output.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, value: string) => {
        const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }
        if (value[0] !== '#') return named[value.toLowerCase()] ?? entity
        const codePoint = value[1].toLowerCase() === 'x' ? Number.parseInt(value.slice(2), 16) : Number.parseInt(value.slice(1), 10)
        return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity
      })
      steps.push('HTML entities decoded')
    }
  }
  return { output, steps }
}

export const STATUS_CODES = [
  [100, 'Continue', 'The server received the request headers; the client can continue.'],
  [101, 'Switching Protocols', 'The server is switching protocols as requested.'],
  [200, 'OK', 'The request succeeded.'],
  [201, 'Created', 'The request succeeded and created a resource.'],
  [202, 'Accepted', 'The request was accepted for processing, but processing is not complete.'],
  [204, 'No Content', 'The request succeeded; there is no response body.'],
  [301, 'Moved Permanently', 'The resource has a new permanent URL.'],
  [302, 'Found', 'The resource is temporarily available at another URL.'],
  [304, 'Not Modified', 'A cached representation can be reused.'],
  [307, 'Temporary Redirect', 'The request should be repeated at another URL without changing its method.'],
  [308, 'Permanent Redirect', 'The resource has a new URL; keep the request method.'],
  [400, 'Bad Request', 'The server cannot process the request because it is malformed.'],
  [401, 'Unauthorized', 'Authentication is required or has failed.'],
  [403, 'Forbidden', 'The server understood the request but refuses it.'],
  [404, 'Not Found', 'The requested resource could not be found.'],
  [405, 'Method Not Allowed', 'The method is not supported for this resource.'],
  [408, 'Request Timeout', 'The server timed out waiting for the request.'],
  [409, 'Conflict', 'The request conflicts with the current resource state.'],
  [410, 'Gone', 'The resource is no longer available.'],
  [413, 'Content Too Large', 'The request body exceeds the server limit.'],
  [415, 'Unsupported Media Type', 'The request format is not supported.'],
  [422, 'Unprocessable Content', 'The request is valid but cannot be processed.'],
  [429, 'Too Many Requests', 'The client sent too many requests in a given time.'],
  [500, 'Internal Server Error', 'The server encountered an unexpected condition.'],
  [501, 'Not Implemented', 'The server does not support the requested functionality.'],
  [502, 'Bad Gateway', 'The server received an invalid response from an upstream server.'],
  [503, 'Service Unavailable', 'The server is temporarily unable to handle the request.'],
  [504, 'Gateway Timeout', 'An upstream server did not respond in time.'],
] as const

export const COMMON_HEADERS = [
  ['Content-Type', 'The media type of the request or response body.'],
  ['Authorization', 'Credentials used to authenticate a request.'],
  ['Accept', 'Content types the client can process.'],
  ['Cache-Control', 'Caching directives for clients and intermediaries.'],
  ['User-Agent', 'Identifies the software making the request.'],
  ['Location', 'The URL used for redirects or newly created resources.'],
  ['Set-Cookie', 'Instructs a browser to store a cookie.'],
  ['X-Request-ID', 'A tracing identifier used to correlate requests.'],
] as const

export const SECURITY_HEADERS = [
  ['content-security-policy', 'Restricts which sources a browser may load.'],
  ['strict-transport-security', 'Requests HTTPS-only access for a period of time.'],
  ['x-content-type-options', 'Prevents MIME type sniffing when set to nosniff.'],
  ['x-frame-options', 'Controls whether a page may be embedded in a frame.'],
  ['referrer-policy', 'Controls how much referrer information is shared.'],
  ['permissions-policy', 'Controls access to selected browser features.'],
] as const

export function parseHeaders(raw: string): Array<{ name: string; value: string }> {
  const headers: Array<{ name: string; value: string }> = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || /^HTTP\/\d/i.test(line)) continue
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const name = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (name) headers.push({ name, value })
  }
  return headers
}
