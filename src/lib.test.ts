import { describe, expect, it } from 'vitest'
import {
  compareText, normalizeSnippets, parseHeaders, parseSnippetImport, removeSnippet,
  decodeObfuscatedText, replaceRegex, scanSecrets, sortJson, STATUS_CODES, testRegex, transformJson, upsertSnippet,
  writeLocal, readLocal,
} from './lib'

const snippet = { id: 'one', title: 'One', language: 'TypeScript', tags: ['test'], code: 'return 1', favorite: false, updatedAt: 1 }

describe('JSON toolkit operations', () => {
  it('formats, minifies, and recursively sorts JSON keys', () => {
    expect(transformJson('{"z":1,"a":{"y":2,"b":3}}', 'format', true)).toBe(JSON.stringify({ a: { b: 3, y: 2 }, z: 1 }, null, 2))
    expect(transformJson('{"a": 1}', 'minify')).toBe('{"a":1}')
  })

  it('rejects invalid JSON for the UI to display', () => {
    expect(() => transformJson('{bad', 'format')).toThrow()
  })
})

describe('Snippet vault operations', () => {
  it('creates, updates, and removes snippets', () => {
    expect(upsertSnippet([], snippet)).toEqual([snippet])
    expect(upsertSnippet([snippet], { ...snippet, title: 'Updated' })).toEqual([{ ...snippet, title: 'Updated' }])
    expect(removeSnippet([snippet], snippet.id)).toEqual([])
  })

  it('imports valid snippets with fresh ids and rejects malformed data', () => {
    expect(parseSnippetImport('[{"title":"Saved","language":"JS","code":"x","tags":["one"]}]', () => 'new-id')).toEqual([
      { id: 'new-id', title: 'Saved', language: 'JS', code: 'x', tags: ['one'], favorite: false, updatedAt: expect.any(Number) },
    ])
    expect(() => parseSnippetImport('{')).toThrow()
    expect(() => parseSnippetImport('[{"title":"missing code"}]')).toThrow(/title, language, and code/)
    expect(normalizeSnippets([{ ...snippet, tags: ['tag', 2] }])?.[0].tags).toEqual(['tag', '2'])
    expect(normalizeSnippets([{ title: 'bad storage value' }])).toBeNull()
  })

  it('handles unavailable browser storage without throwing', () => {
    expect(readLocal('missing-key', 'fallback')).toBe('fallback')
    expect(writeLocal('missing-key', { value: 1 })).toBe(false)
  })
})

describe('Secret scanner', () => {
  it('finds representative credentials, masks previews, and reports source lines', () => {
    const source = 'const password = "super-secret-password"\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz123\nconst aws = "AKIAIOSFODNN7EXAMPLE"'
    const findings = scanSecrets(source)
    expect(findings.map(({ type, line }) => [type, line])).toEqual([
      ['Password assignment', 1],
      ['Bearer token', 2],
      ['AWS access key', 3],
    ])
    expect(findings.every((finding) => !finding.preview.includes(finding.value))).toBe(true)
    expect(findings[0].preview).toContain('••')
  })

  it('detects private-key headers and API keys', () => {
    const findings = scanSecrets('-----BEGIN RSA PRIVATE KEY-----\napi_key = "abcdef0123456789abcdef"')
    expect(findings.map((finding) => finding.type)).toEqual(['Private key', 'Generic API key'])
  })
})

describe('Code diff', () => {
  it('identifies unchanged, added, and removed lines', () => {
    expect(compareText('before\nkeep\nremove', 'before\nkeep\nadd')).toEqual([
      { left: 'before', right: 'before', type: 'same' },
      { left: 'keep', right: 'keep', type: 'same' },
      { left: 'remove', right: 'add', type: 'changed' },
    ])
  })

  it('can ignore leading and trailing whitespace', () => {
    expect(compareText('  same  ', 'same', true)).toEqual([{ left: '  same  ', right: 'same', type: 'same' }])
    expect(compareText('left', 'right')[0].type).toBe('changed')
  })
})

describe('Regex tester', () => {
  it('returns match values, indexes, and capture groups', () => {
    expect(testRegex('(dev)@(example\\.com)', 'i', 'dev@example.com')).toEqual([
      { value: 'dev@example.com', index: 0, groups: ['dev', 'example.com'], namedGroups: {} },
    ])
    expect(testRegex('(?<user>\\w+)', '', 'ada')[0].namedGroups).toEqual({ user: 'ada' })
    expect(replaceRegex('(dev)@(example\\.com)', 'g', 'dev@example.com', '$1@kyrodeck.dev')).toBe('dev@kyrodeck.dev')
  })

  it('respects global matching, reports invalid patterns, and advances past empty matches', () => {
    expect(() => testRegex('[', '', 'text')).toThrow()
    expect(testRegex('a', '', 'aaa')).toHaveLength(1)
    expect(testRegex('a', 'g', 'aaa')).toHaveLength(3)
    expect(testRegex('(?=a)', 'g', 'aaa')).toHaveLength(3)
  })
})

describe('Deobfuscator text decoding', () => {
  it('decodes selected layers without executing source code', () => {
    expect(decodeObfuscatedText('Hello%20%5Cu263A%26amp%3B', ['url', 'unicode', 'html'])).toEqual({
      output: 'Hello ☺&',
      steps: ['URL encoding decoded', 'Unicode escapes decoded', 'HTML entities decoded'],
    })
    expect(decodeObfuscatedText('eyJvayI6dHJ1ZX0=', ['base64']).output).toBe('{"ok":true}')
    expect(decodeObfuscatedText(String.raw`\uD83D\uDE00`, ['unicode']).output).toBe('😀')
    expect(decodeObfuscatedText(String.raw`\uD83D`, ['unicode']).output).toBe(String.raw`\uD83D`)
  })

  it('returns readable errors for malformed encodings', () => {
    expect(() => decodeObfuscatedText('%E0%A4%A', ['url'])).toThrow(/URL decoding failed/)
    expect(() => decodeObfuscatedText('%%%not-base64%%%', ['base64'])).toThrow(/Base64 decoding failed/)
  })
})

describe('HTTP inspector data', () => {
  it('parses status lines and repeated headers', () => {
    expect(parseHeaders('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Test: one\r\nX-Test: two')).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Test', value: 'one' },
      { name: 'X-Test', value: 'two' },
    ])
  })

  it('supports searching statuses by code and phrase in built-in data', () => {
    expect(STATUS_CODES.find(([code]) => String(code).includes('404'))?.[1]).toBe('Not Found')
    expect(STATUS_CODES.find(([, phrase]) => phrase.toLowerCase().includes('too many'))?.[0]).toBe(429)
  })
})

describe('JSON key sorter', () => {
  it('sorts keys recursively without changing array order', () => {
    expect(sortJson({ z: [{ b: 1, a: 2 }], a: true })).toEqual({ a: true, z: [{ a: 2, b: 1 }] })
  })
})
