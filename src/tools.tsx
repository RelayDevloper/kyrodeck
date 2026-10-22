import { useMemo, useState } from 'react'
import {
  Binary, Braces, Check, Code2, Copy, Download, FileCode2, FileDiff, Fingerprint,
  Globe2, Plus, RotateCcw, Search, ShieldAlert, Trash2, Upload, X,
} from 'lucide-react'
import {
  COMMON_HEADERS, compareText, parseHeaders, parseSnippetImport, removeSnippet, scanSecrets,
  SECURITY_HEADERS, STATUS_CODES, testRegex, TOOL_INFO, transformJson, replaceRegex, decodeObfuscatedText,
  type DecodeOperation,
  upsertSnippet, type DiffRow, type Snippet, type ToolId,
} from './lib'

const SAMPLE_JSON = '{\n  "name": "KyroDeck",\n  "tools": ["inspect", "debug"],\n  "private": true,\n  "version": 1\n}'
const TOOL_ICONS = { json: Braces, scanner: ShieldAlert, snippets: FileCode2, diff: FileDiff, regex: Fingerprint, deobfuscator: Binary, http: Globe2 }

function downloadText(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

async function copyText(text: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(text)
    notify('Copied to clipboard')
  } catch {
    notify('Clipboard access is unavailable in this browser')
  }
}

function ToolHeading({ tool, eyebrow }: { tool: ToolId; eyebrow: string }) {
  const Icon = TOOL_ICONS[tool]
  return <div className="page-heading"><div className="eyebrow"><Icon size={14} />{eyebrow}</div><h1>{TOOL_INFO[tool].title}</h1><p>{TOOL_INFO[tool].description}</p></div>
}

function EditorPanel({ title, value, onChange, placeholder, language, rows = 16, label }: {
  title: string; value: string; onChange: (value: string) => void; placeholder: string; language?: string; rows?: number; label: string
}) {
  return <section className="editor-panel"><div className="editor-bar"><span><span className="editor-dot" />{title}</span><small>{language ?? 'PLAIN TEXT'}</small></div><textarea aria-label={label} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} /></section>
}

export default function ToolPages({ tool, snippets, onSnippetsChange, notify }: {
  tool: ToolId
  snippets: Snippet[]
  onSnippetsChange: (snippets: Snippet[]) => void
  notify: (message: string) => void
}) {
  return <div className="tool-page">
    {tool === 'json' && <JsonToolkit notify={notify} />}
    {tool === 'scanner' && <SecretScanner notify={notify} />}
    {tool === 'snippets' && <SnippetVault snippets={snippets} onChange={onSnippetsChange} notify={notify} />}
    {tool === 'diff' && <CodeDiff notify={notify} />}
    {tool === 'regex' && <RegexTester notify={notify} />}
    {tool === 'deobfuscator' && <Deobfuscator notify={notify} />}
    {tool === 'http' && <HttpInspector notify={notify} />}
  </div>
}

function JsonToolkit({ notify }: { notify: (message: string) => void }) {
  const [input, setInput] = useState(SAMPLE_JSON)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [sortKeys, setSortKeys] = useState(false)
  const [message, setMessage] = useState('')
  const run = (compact: boolean) => {
    try {
      setOutput(transformJson(input, compact ? 'minify' : 'format', sortKeys))
      setError('')
      setMessage(compact ? 'JSON minified successfully.' : 'Valid JSON. Output is ready.')
    } catch (caught) {
      setOutput('')
      setMessage('')
      setError(caught instanceof Error ? caught.message.replace(/^JSON\.parse:\s*/, '') : 'Could not parse this JSON.')
    }
  }
  return <>
    <ToolHeading tool="json" eyebrow="DATA UTILITIES" />
    <div className="tool-toolbar">
      <div className="toolbar-actions"><button className="button button-primary" onClick={() => run(false)}><Braces size={15} />Format</button><button className="button button-secondary" onClick={() => run(true)}>Minify</button><button className="button button-secondary" onClick={() => run(false)}>Validate</button></div>
      <label className="check-control"><input type="checkbox" checked={sortKeys} onChange={(event) => setSortKeys(event.target.checked)} /><span>Sort object keys</span></label>
    </div>
    {(error || message) && <div className={`feedback-bar ${error ? 'feedback-error' : 'feedback-success'}`} role="status">{error ? <><X size={15} /><span><strong>Invalid JSON</strong> · {error}</span></> : <><Check size={15} /><span>{message}</span></>}</div>}
    <div className="two-editor-grid">
      <EditorPanel title="Input" label="JSON input" value={input} onChange={(value) => { setInput(value); setError(''); setMessage('') }} placeholder="Paste or type JSON here..." language="JSON" />
      <EditorPanel title="Output" label="JSON output" value={output} onChange={setOutput} placeholder="Your formatted result will appear here..." language="JSON" />
    </div>
    <div className="tool-footer"><div className="footer-left"><button className="button button-quiet" onClick={() => { setInput(''); setOutput(''); setError(''); setMessage('') }}><Trash2 size={14} />Clear</button><button className="button button-quiet" onClick={() => { setInput(output); setOutput(input); setError(''); setMessage('') }} disabled={!output}><RotateCcw size={14} />Swap</button><button className="button button-quiet" onClick={() => { setInput(SAMPLE_JSON); setOutput(''); setError(''); setMessage('') }}>Load example</button></div><div className="footer-left"><button className="button button-secondary" onClick={() => copyText(output, notify)} disabled={!output}><Copy size={14} />Copy output</button><button className="button button-secondary" onClick={() => downloadText('formatted.json', output, 'application/json')} disabled={!output}><Download size={14} />Download</button></div></div>
    <div className="tool-note"><LockIcon />JSON is parsed and transformed locally in your browser. Nothing is uploaded.</div>
  </>
}

function LockIcon() { return <span className="note-lock">⌑</span> }

function SecretScanner({ notify }: { notify: (message: string) => void }) {
  const [source, setSource] = useState('')
  const [findings, setFindings] = useState<ReturnType<typeof scanSecrets>>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [scanned, setScanned] = useState(false)
  const visible = findings.filter((item) => !dismissed.includes(item.id))
  return <>
    <ToolHeading tool="scanner" eyebrow="PRIVACY CHECK" />
    <div className="scanner-callout"><ShieldAlert size={17} /><div><strong>Runs entirely in this tab</strong><span>Scanned content is never saved or uploaded.</span></div><span className="local-badge">LOCAL ONLY</span></div>
    <EditorPanel title="Code to scan" label="Code to scan for secrets" value={source} onChange={setSource} placeholder={'Paste code, a config file, or a commit diff...\n\nTry the example to see what gets detected.'} language="SOURCE CODE" rows={12} />
    <div className="tool-footer"><div className="footer-left"><button className="button button-primary" onClick={() => { setFindings(scanSecrets(source)); setDismissed([]); setScanned(true) }}><ShieldAlert size={15} />Scan for secrets</button><button className="button button-quiet" onClick={() => { setSource(''); setFindings([]); setDismissed([]); setScanned(false) }}><Trash2 size={14} />Clear</button></div><button className="button button-quiet" onClick={() => setSource('const api_key = "sk_test_1234567890abcdef"\nconst password = "example-password"\n// AWS example: AKIAIOSFODNN7EXAMPLE\n-----BEGIN PRIVATE KEY-----')} >Load example</button></div>
    {scanned && <section className="findings-section"><div className="findings-heading"><div><h2>{visible.length ? `${visible.length} finding${visible.length === 1 ? '' : 's'} detected` : 'No active findings'}</h2><p>{visible.length ? 'Review these values before committing or sharing this code.' : 'No supported patterns were found in this scan.'}</p></div><span className={`finding-count ${visible.length ? 'has-findings' : ''}`}>{visible.length}</span></div>
      {visible.length ? <div className="finding-list">{visible.map((finding) => <article className="finding-row" key={finding.id}><span className="finding-symbol"><ShieldAlert size={17} /></span><div className="finding-copy"><strong>{finding.type}</strong><span>Line {finding.line}</span><code>{finding.preview}</code></div><button className="icon-button" aria-label={`Dismiss ${finding.type} on line ${finding.line}`} onClick={() => { setDismissed((current) => [...current, finding.id]); notify('Finding dismissed') }}><X size={16} /></button></article>)}</div> : <div className="clean-state"><Check size={19} /><span>Nothing to review right now.</span></div>}
    </section>}
    <div className="tool-note"><ShieldAlert size={15} /><span>Pattern-based checks can miss secrets or flag test values. Review the source manually; this is not a substitute for a dedicated secret-management workflow.</span></div>
  </>
}

function SnippetVault({ snippets, onChange, notify }: { snippets: Snippet[]; onChange: (snippets: Snippet[]) => void; notify: (message: string) => void }) {
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('All languages')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [editing, setEditing] = useState<Snippet | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ title: '', language: 'TypeScript', tags: '', code: '' })
  const languages = [...new Set(snippets.map((item) => item.language))].sort()
  const visible = snippets.filter((item) => {
    const matchesSearch = `${item.title} ${item.language} ${item.tags.join(' ')} ${item.code}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (language === 'All languages' || item.language === language) && (!favoritesOnly || item.favorite)
  }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
  const openNew = () => { setForm({ title: '', language: 'TypeScript', tags: '', code: '' }); setEditing(null); setIsNew(true) }
  const openEdit = (snippet: Snippet) => { setEditing(snippet); setIsNew(false); setForm({ title: snippet.title, language: snippet.language, tags: snippet.tags.join(', '), code: snippet.code }) }
  const save = () => {
    if (!form.title.trim() || !form.code.trim()) return
    const saved: Snippet = { id: editing?.id ?? crypto.randomUUID(), title: form.title.trim(), language: form.language.trim() || 'Plain text', tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), code: form.code, favorite: editing?.favorite ?? false, updatedAt: Date.now() }
    onChange(upsertSnippet(snippets, saved))
    setIsNew(false); setEditing(null); notify(editing ? 'Snippet updated' : 'Snippet saved')
  }
  const remove = (snippet: Snippet) => {
    if (!window.confirm(`Delete “${snippet.title}”?`)) return
    onChange(removeSnippet(snippets, snippet.id)); notify('Snippet deleted')
  }
  const exportSnippets = () => downloadText('kyrodeck-snippets.json', JSON.stringify(snippets, null, 2), 'application/json')
  const importSnippets = async (file?: File) => {
    if (!file) return
    try {
      const imported = parseSnippetImport(await file.text())
      onChange([...imported, ...snippets]); notify(`${imported.length} snippet${imported.length === 1 ? '' : 's'} imported`)
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not import that file') }
  }
  return <>
    <div className="page-heading heading-with-action"><div><div className="eyebrow"><FileCode2 size={14} />PERSONAL LIBRARY</div><h1>Snippet Vault</h1><p>Small pieces of code, ready when you need them.</p></div><button className="button button-primary" onClick={openNew}><Plus size={16} />New snippet</button></div>
    <div className="vault-toolbar"><label className="vault-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search snippets..." aria-label="Search snippets" /></label><select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Filter by language"><option>All languages</option>{languages.map((item) => <option key={item}>{item}</option>)}</select><button className={`button button-secondary favorite-filter ${favoritesOnly ? 'active' : ''}`} onClick={() => setFavoritesOnly(!favoritesOnly)}><span>★</span>Favorites</button><label className="button button-quiet file-button"><Upload size={14} />Import<input type="file" accept="application/json,.json" onChange={(event) => importSnippets(event.target.files?.[0])} /></label><button className="button button-quiet" onClick={exportSnippets}><Download size={14} />Export</button></div>
    {visible.length ? <div className="vault-grid">{visible.map((snippet) => <article className="vault-card" key={snippet.id}><div className="vault-card-head"><span className="language-badge">{snippet.language}</span><div className="vault-card-actions"><button className={`icon-button ${snippet.favorite ? 'favorite-active' : ''}`} aria-label={snippet.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => onChange(snippets.map((item) => item.id === snippet.id ? { ...item, favorite: !item.favorite } : item))}>★</button><button className="icon-button" aria-label="Edit snippet" onClick={() => openEdit(snippet)}><Code2 size={15} /></button><button className="icon-button danger-icon" aria-label="Delete snippet" onClick={() => remove(snippet)}><Trash2 size={15} /></button></div></div><button className="vault-card-title" onClick={() => openEdit(snippet)}>{snippet.title}</button><div className="tag-list">{snippet.tags.map((tag) => <span key={tag}>{tag}</span>)}{snippet.example && <span className="example-tag">example</span>}</div><pre className="snippet-code"><code>{snippet.code}</code></pre><div className="vault-card-footer"><small>{snippet.example ? 'Example snippet' : `Updated ${new Date(snippet.updatedAt).toLocaleDateString()}`}</small><button className="copy-link" onClick={() => copyText(snippet.code, notify)}><Copy size={14} />Copy</button></div></article>)}</div> : <div className="empty-vault"><FileCode2 size={25} /><strong>{search || favoritesOnly || language !== 'All languages' ? 'No snippets match those filters' : 'Your vault is empty'}</strong><span>{search || favoritesOnly || language !== 'All languages' ? 'Try changing your search or filters.' : 'Save a useful piece of code to get started.'}</span>{!search && <button className="button button-primary" onClick={openNew}><Plus size={15} />Create a snippet</button>}</div>}
    {(isNew || editing) && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setIsNew(false); setEditing(null) } }}><section className="snippet-dialog" role="dialog" aria-modal="true" aria-labelledby="snippet-dialog-title"><div className="dialog-head"><div><div className="eyebrow">SNIPPET DETAILS</div><h2 id="snippet-dialog-title">{editing ? 'Edit snippet' : 'New snippet'}</h2></div><button className="icon-button" aria-label="Close editor" onClick={() => { setIsNew(false); setEditing(null) }}><X size={18} /></button></div><label className="form-field">Title<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Fetch with timeout" /></label><div className="form-two-columns"><label className="form-field">Language<input value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} placeholder="TypeScript" /></label><label className="form-field">Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="http, utility" /></label></div><label className="form-field">Code<textarea className="dialog-code" spellCheck={false} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Paste your snippet..." /></label><div className="dialog-actions"><button className="button button-quiet" onClick={() => { setIsNew(false); setEditing(null) }}>Cancel</button><button className="button button-primary" disabled={!form.title.trim() || !form.code.trim()} onClick={save}>{editing ? 'Save changes' : 'Save snippet'}</button></div></section></div>}
  </>
}

function CodeDiff({ notify }: { notify: (message: string) => void }) {
  const [left, setLeft] = useState('function greet(name) {\n  return `Hello, ${name}!`\n}\n\nconsole.log(greet("Ada"))')
  const [right, setRight] = useState('function greet(name, formal = false) {\n  const greeting = formal ? "Good day" : "Hello"\n  return `${greeting}, ${name}.`\n}\n\nconsole.log(greet("Ada", true))')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [view, setView] = useState<'split' | 'unified'>('split')
  const tooLarge = left.length + right.length > 500_000
  const rows = useMemo(() => tooLarge ? [] : compareText(left, right, ignoreWhitespace), [left, right, ignoreWhitespace, tooLarge])
  const changes = rows.filter((row) => row.type !== 'same').length
  const unifiedText = rows.flatMap((row) => row.type === 'changed'
    ? [`-${row.left}`, `+${row.right}`]
    : [`${row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' '}${row.type === 'added' ? row.right : row.left}`]).join('\n')
  return <>
    <ToolHeading tool="diff" eyebrow="COMPARE TEXT" />
    <div className="tool-toolbar"><div className="segmented"><button className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}>Side by side</button><button className={view === 'unified' ? 'active' : ''} onClick={() => setView('unified')}>Unified</button></div><label className="check-control"><input type="checkbox" checked={ignoreWhitespace} onChange={(event) => setIgnoreWhitespace(event.target.checked)} /><span>Ignore whitespace</span></label></div>
    {tooLarge ? <div className="feedback-bar feedback-error"><X size={15} /><span>These inputs exceed the 500 KB comparison limit. Reduce their size to compare locally.</span></div> : <>
      {view === 'split' ? <div className="diff-inputs"><EditorPanel title="Original" label="Original text" value={left} onChange={setLeft} placeholder="Paste the original version..." language="TEXT" rows={11} /><EditorPanel title="Changed" label="Changed text" value={right} onChange={setRight} placeholder="Paste the changed version..." language="TEXT" rows={11} /></div> : <div className="diff-unified-editor"><EditorPanel title="Original" label="Original text" value={left} onChange={setLeft} placeholder="Paste the original version..." language="TEXT" rows={7} /><EditorPanel title="Changed" label="Changed text" value={right} onChange={setRight} placeholder="Paste the changed version..." language="TEXT" rows={7} /></div>}
      <div className="diff-result-head"><div><strong>Comparison</strong><span>{changes} changed {changes === 1 ? 'line' : 'lines'}</span></div><div className="footer-left"><button className="button button-quiet" onClick={() => { setLeft(''); setRight('') }}><Trash2 size={14} />Clear</button><button className="button button-secondary" disabled={!left && !right} onClick={() => copyText(unifiedText, notify)}><Copy size={14} />Copy diff</button><button className="button button-secondary" disabled={!left && !right} onClick={() => downloadText('comparison.diff', unifiedText)}><Download size={14} />Export</button></div></div>
      <div className={`diff-result ${view === 'unified' ? 'unified-result' : ''}`} aria-label="Diff comparison">{view === 'split' ? <SplitDiff rows={rows} /> : <div className="unified-lines">{rows.flatMap((row, index) => row.type === 'changed'
        ? [<div key={`${index}-removed`} className="diff-line diff-removed"><span>-</span><code>{row.left || ' '}</code></div>, <div key={`${index}-added`} className="diff-line diff-added"><span>+</span><code>{row.right || ' '}</code></div>]
        : [<div key={index} className={`diff-line diff-${row.type}`}><span>{row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' '}</span><code>{row.type === 'added' ? row.right : row.left || ' '}</code></div>])}</div>}</div>
      <div className="tool-note">Comparison runs in your browser. Inputs over 500 KB are capped to keep the workspace responsive.</div>
    </>}
  </>
}

function SplitDiff({ rows }: { rows: DiffRow[] }) {
  const leftNumbers = rows.map((row) => row.type !== 'added')
  const rightNumbers = rows.map((row) => row.type !== 'removed')
  let leftLine = 0
  let rightLine = 0
  return <div className="split-diff"><div className="diff-column"><div className="diff-column-title">Original</div>{rows.map((row, index) => { if (leftNumbers[index]) leftLine++; const type = row.type === 'changed' ? 'removed' : row.type; return <div key={index} className={`diff-line diff-${type}`}><span>{leftNumbers[index] ? leftLine : ''}</span><code>{row.left || ' '}</code></div> })}</div><div className="diff-column"><div className="diff-column-title">Changed</div>{rows.map((row, index) => { if (rightNumbers[index]) rightLine++; const type = row.type === 'changed' ? 'added' : row.type; return <div key={index} className={`diff-line diff-${type}`}><span>{rightNumbers[index] ? rightLine : ''}</span><code>{row.right || ' '}</code></div> })}</div></div>
}

const REGEX_EXAMPLES = [
  { label: 'Email address', pattern: '([\\w.+-]+)@([\\w.-]+\\.[A-Za-z]{2,})', flags: 'gi', text: 'Contact dev@example.com or support@kyrodeck.dev for help.' },
  { label: 'URLs', pattern: 'https?://[^\\s]+', flags: 'gi', text: 'Docs: https://developer.mozilla.org and https://vite.dev/guide' },
  { label: 'Hex colors', pattern: '#[0-9a-fA-F]{3,8}\\b', flags: 'gi', text: 'Colors: #202A36, #3978D4, and #fff.' },
  { label: 'IPv4 address', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g', text: 'Local: 127.0.0.1\nGateway: 192.168.1.1' },
  { label: 'Named captures', pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})', flags: 'g', text: 'Release dates: 2026-10-22 and 2027-01-05.' },
  { label: 'Whitespace', pattern: '\\s+', flags: 'g', text: 'Trim   repeated\tspaces\nand newlines.' },
]

const COMMON_REGEX_FLAGS = ['g', 'i', 'm', 's', 'u', 'y']

function RegexTester({ notify }: { notify: (message: string) => void }) {
  const [pattern, setPattern] = useState(REGEX_EXAMPLES[0].pattern)
  const [flags, setFlags] = useState(REGEX_EXAMPLES[0].flags)
  const [text, setText] = useState(REGEX_EXAMPLES[0].text)
  const [example, setExample] = useState('Email address')
  const [replacement, setReplacement] = useState('')
  const result = useMemo(() => {
    try { return { matches: testRegex(pattern, flags, text), error: '' } }
    catch (error) { return { matches: [], error: error instanceof Error ? error.message : 'Invalid regular expression.' } }
  }, [pattern, flags, text])
  const highlighted = useMemo(() => {
    if (!result.matches.length) return [{ value: text, matched: false }]
    const pieces: Array<{ value: string; matched: boolean }> = []
    let cursor = 0
    for (const match of result.matches) {
      if (match.index > cursor) pieces.push({ value: text.slice(cursor, match.index), matched: false })
      if (match.value) pieces.push({ value: match.value, matched: true })
      cursor = match.index + match.value.length
    }
    if (cursor < text.length) pieces.push({ value: text.slice(cursor), matched: false })
    return pieces
  }, [result.matches, text])
  const replacementOutput = useMemo(() => {
    try { return { value: replaceRegex(pattern, flags, text, replacement), error: '' } }
    catch (error) { return { value: '', error: error instanceof Error ? error.message : 'Could not build replacement preview.' } }
  }, [pattern, flags, text, replacement])
  const chooseExample = (label: string) => {
    const selected = REGEX_EXAMPLES.find((item) => item.label === label)
    if (!selected) return
    setExample(label)
    setPattern(selected.pattern)
    setFlags(selected.flags)
    setText(selected.text)
  }
  const toggleFlag = (flag: string, checked: boolean) => {
    setFlags((current) => [...new Set(checked ? `${current}${flag}` : current.replace(flag, ''))].sort((a, b) => COMMON_REGEX_FLAGS.indexOf(a) - COMMON_REGEX_FLAGS.indexOf(b)).join(''))
  }
  const lineColumn = (index: number) => {
    const lines = text.slice(0, index).split('\n')
    return { line: lines.length, column: lines[lines.length - 1].length + 1 }
  }
  return <>
    <ToolHeading tool="regex" eyebrow="PATTERN PLAYGROUND" />
    <div className="regex-toolbar"><label className="form-field regex-pattern">Regular expression<div className="regex-input"><span>/</span><input value={pattern} onChange={(event) => setPattern(event.target.value)} aria-label="Regular expression pattern" /><span>/</span><input className="regex-flags" value={flags} onChange={(event) => setFlags(event.target.value)} aria-label="Regular expression flags" maxLength={8} /></div></label><label className="form-field regex-example">Examples<select value={example} onChange={(event) => chooseExample(event.target.value)}>{REGEX_EXAMPLES.map((item) => <option key={item.label}>{item.label}</option>)}</select></label></div>
    <div className="regex-options"><span>Flags</span>{COMMON_REGEX_FLAGS.map((flag) => <label key={flag}><input type="checkbox" checked={flags.includes(flag)} onChange={(event) => toggleFlag(flag, event.target.checked)} /><code>{flag}</code></label>)}<span className="regex-flag-help">g all · i case · m lines · s dotAll · u unicode · y sticky</span></div>
    {result.error && <div className="feedback-bar feedback-error" role="alert"><X size={15} /><span>{result.error}</span></div>}
    <div className="regex-workspace"><EditorPanel title="Test string" label="Text to test against the regular expression" value={text} onChange={setText} placeholder="Enter text to test..." language="TEXT" rows={14} /><section className="match-preview"><div className="editor-bar"><span><span className="editor-dot" />Highlighted matches</span><span className="match-total">{result.matches.length}{result.matches.length === 500 ? '+' : ''} MATCHES</span></div><div className="highlighted-text" aria-label="Text with matches highlighted">{highlighted.map((piece, index) => piece.matched ? <mark key={index}>{piece.value}</mark> : <span key={index}>{piece.value}</span>)}{!text && <span className="placeholder-text">Matching text will appear here...</span>}</div></section></div>
    <div className="regex-controls"><label className="regex-replacement-label">Replace matches<input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Replacement text; supports $1 and $&" aria-label="Replacement text" /></label><button className="button button-secondary" onClick={() => copyText(replacementOutput.value, notify)} disabled={Boolean(result.error || replacementOutput.error)}><Copy size={14} />Copy preview</button><button className="button button-quiet" onClick={() => { setText(''); setReplacement('') }}><Trash2 size={14} />Clear text</button></div>
    {(replacementOutput.error || replacement) && <section className="replacement-preview"><div className="editor-bar"><span>Replacement preview</span><small>NOT EXECUTED</small></div>{replacementOutput.error ? <div className="feedback-bar feedback-error"><X size={15} /><span>{replacementOutput.error}</span></div> : <pre>{replacementOutput.value || 'No replacement output.'}</pre>}</section>}
    <section className="match-details"><div className="findings-heading"><div><h2>Matches</h2><p>{result.matches.length ? 'Matched values, positions, and capture groups.' : 'No matches in the current text.'}</p></div><span className="finding-count">{result.matches.length}{result.matches.length === 500 ? '+' : ''}</span></div>{result.matches.slice(0, 100).map((match, index) => { const position = lineColumn(match.index); return <div className="match-row" key={`${match.index}-${index}`}><span>{index + 1}</span><code>{match.value || '(empty match)'}</code><small>line {position.line}, col {position.column} · index {match.index}</small>{(match.groups.length > 0 || Object.keys(match.namedGroups).length > 0) && <div className="capture-list">{match.groups.map((group, groupIndex) => <span key={`group-${groupIndex}`}>${groupIndex + 1}: <code>{group ?? '(undefined)'}</code></span>)}{Object.entries(match.namedGroups).map(([name, value]) => <span key={name}>{name}: <code>{value ?? '(undefined)'}</code></span>)}</div>}</div>})}{result.matches.length > 100 && <p className="muted-copy">Showing the first 100 of {result.matches.length} matches.</p>}</section>
    <div className="tool-note"><Fingerprint size={15} /><span>Supports JavaScript regular-expression syntax. Replacement tokens like $1 and $& are supported. Patterns can be expensive on certain inputs, especially nested repetition; avoid testing untrusted patterns on very large text.</span></div>
  </>
}

function Deobfuscator({ notify }: { notify: (message: string) => void }) {
  const [input, setInput] = useState('Hello%20%5Cu263A%26amp%3B')
  const [output, setOutput] = useState('')
  const [operations, setOperations] = useState<DecodeOperation[]>(['url', 'unicode', 'html'])
  const [error, setError] = useState('')
  const [steps, setSteps] = useState<string[]>([])
  const choices: Array<{ id: DecodeOperation; label: string; detail: string }> = [
    { id: 'base64', label: 'Base64', detail: 'UTF-8 text and URL-safe alphabet' },
    { id: 'url', label: 'URL encoding', detail: 'Percent-encoding and plus spaces' },
    { id: 'unicode', label: 'Unicode escapes', detail: String.raw`\uXXXX, \u{...}, and \xNN` },
    { id: 'html', label: 'HTML entities', detail: 'Common named and numeric entities' },
  ]
  const decode = () => {
    try {
      const orderedOperations = choices.filter((choice) => operations.includes(choice.id)).map((choice) => choice.id)
      const result = decodeObfuscatedText(input, orderedOperations)
      setOutput(result.output)
      setSteps(result.steps)
      setError('')
    } catch (caught) {
      setOutput('')
      setSteps([])
      setError(caught instanceof Error ? caught.message : 'Could not decode this input.')
    }
  }
  const toggleOperation = (operation: DecodeOperation) => setOperations((current) => current.includes(operation) ? current.filter((item) => item !== operation) : [...current, operation])
  return <>
    <ToolHeading tool="deobfuscator" eyebrow="TEXT DECODING" />
    <div className="tool-note"><LockIcon /><span>Decode common text encodings in a chosen order. This tool does not execute JavaScript, evaluate code, or contact a server.</span></div>
    <section className="decode-options"><div className="findings-heading"><div><h2>Decoding steps</h2><p>Steps run in the order shown below.</p></div></div><div className="decode-choice-list">{choices.map((choice) => <label key={choice.id}><input type="checkbox" checked={operations.includes(choice.id)} onChange={() => toggleOperation(choice.id)} /><span><strong>{choice.label}</strong><small>{choice.detail}</small></span></label>)}</div></section>
    {error && <div className="feedback-bar feedback-error" role="alert"><X size={15} /><span>{error}</span></div>}
    {steps.length > 0 && <div className="feedback-bar feedback-success" role="status"><Check size={15} /><span>Applied: {steps.join(' → ')}</span></div>}
    <div className="two-editor-grid"><EditorPanel title="Encoded input" label="Text to decode" value={input} onChange={(value) => { setInput(value); setError('') }} placeholder="Paste encoded text..." language="TEXT" rows={14} /><EditorPanel title="Decoded output" label="Decoded text" value={output} onChange={setOutput} placeholder="Decoded output appears here..." language="TEXT" rows={14} /></div>
    <div className="tool-footer"><div className="footer-left"><button className="button button-primary" onClick={decode}><Binary size={15} />Decode selected</button><button className="button button-quiet" onClick={() => { setInput(''); setOutput(''); setError(''); setSteps([]) }}><Trash2 size={14} />Clear</button><button className="button button-quiet" onClick={() => { setInput('Hello%20%5Cu263A%26amp%3B'); setOutput(''); setError(''); setSteps([]) }}>Load example</button><button className="button button-quiet" onClick={() => { setInput(output); setOutput(''); setError(''); setSteps([]) }} disabled={!output}><RotateCcw size={14} />Use output as input</button></div><div className="footer-left"><button className="button button-secondary" onClick={() => copyText(output, notify)} disabled={!output}><Copy size={14} />Copy output</button><button className="button button-secondary" onClick={() => downloadText('decoded.txt', output)} disabled={!output}><Download size={14} />Download</button></div></div>
  </>
}

function HttpInspector({ notify }: { notify: (message: string) => void }) {
  const [statusQuery, setStatusQuery] = useState('')
  const [raw, setRaw] = useState('HTTP/1.1 200 OK\nContent-Type: application/json; charset=utf-8\nCache-Control: no-store\nX-Content-Type-Options: nosniff\nContent-Security-Policy: default-src \'self\'\nX-Request-ID: req_8d91f')
  const [tab, setTab] = useState<'headers' | 'reference'>('headers')
  const headers = useMemo(() => parseHeaders(raw), [raw])
  const headerNames = new Set(headers.map((header) => header.name.toLowerCase()))
  const security = SECURITY_HEADERS.map(([name, description]) => ({ name, description, present: headerNames.has(name) }))
  const statuses = STATUS_CODES.filter(([code, phrase]) => `${code} ${phrase}`.toLowerCase().includes(statusQuery.toLowerCase()))
  const summary = `${headers.length} parsed header${headers.length === 1 ? '' : 's'}\nSecurity headers present: ${security.filter((item) => item.present).length}/${security.length}\nMissing: ${security.filter((item) => !item.present).map((item) => item.name).join(', ') || 'None'}`
  return <>
    <ToolHeading tool="http" eyebrow="HTTP REFERENCE" />
    <div className="http-tabs segmented"><button className={tab === 'headers' ? 'active' : ''} onClick={() => setTab('headers')}>Header inspector</button><button className={tab === 'reference' ? 'active' : ''} onClick={() => setTab('reference')}>Status reference</button></div>
    {tab === 'headers' ? <>
      <div className="http-input-layout"><EditorPanel title="Raw headers" label="Paste raw HTTP headers" value={raw} onChange={setRaw} placeholder={'HTTP/1.1 200 OK\nContent-Type: application/json\n...'} language="HTTP HEADERS" rows={10} /><section className="header-analysis"><div className="analysis-heading"><span><ShieldAlert size={16} />Security headers</span><span className="basic-badge">BASIC GUIDANCE</span></div><div className="security-list">{security.map((item) => <div key={item.name} className="security-row"><span className={`security-state ${item.present ? 'present' : 'missing'}`}>{item.present ? <Check size={13} /> : <X size={13} />}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><em>{item.present ? 'Present' : 'Missing'}</em></div>)}</div></section></div>
      <div className="table-heading"><div><h2>Parsed headers</h2><span>{headers.length} {headers.length === 1 ? 'header' : 'headers'}</span></div><button className="button button-secondary" onClick={() => copyText(summary, notify)}><Copy size={14} />Copy summary</button></div>
      {headers.length ? <div className="header-table-wrap"><table className="header-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>{headers.map((header, index) => <tr key={`${header.name}-${index}`}><td>{header.name}</td><td>{header.value || <span className="muted-copy">Empty value</span>}</td></tr>)}</tbody></table></div> : <div className="empty-table">No headers found. Paste raw headers using a name: value format.</div>}
      <div className="tool-note warning-note"><ShieldAlert size={15} /><span>Security-header checks are basic guidance, not a complete security audit. Header parsing runs locally; no HTTP requests are made.</span></div>
    </> : <>
      <label className="status-search"><Search size={16} /><input value={statusQuery} onChange={(event) => setStatusQuery(event.target.value)} placeholder="Search by code or phrase..." aria-label="Search HTTP status codes" /></label>
      <div className="status-results">{statuses.map(([code, phrase, explanation]) => <article className="status-row" key={code}><strong className={`status-code status-${Math.floor(code / 100)}xx`}>{code}</strong><div><h3>{phrase}</h3><p>{explanation}</p></div><span className="status-class">{Math.floor(code / 100)}xx</span></article>)}{!statuses.length && <div className="empty-table">No status codes match “{statusQuery}”.</div>}</div>
      <section className="common-headers"><h2>Common headers</h2><p>Frequently used fields in HTTP requests and responses.</p><div className="common-header-list">{COMMON_HEADERS.map(([name, description]) => <div key={name}><code>{name}</code><span>{description}</span></div>)}</div></section>
    </>}
  </>
}
