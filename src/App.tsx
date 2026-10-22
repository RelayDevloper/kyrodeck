import { useEffect, useMemo, useState } from 'react'
import {
  Binary, Braces, Check, ChevronDown, Code2, Command, FileCode2, FileDiff, Fingerprint,
  Globe2, Heart, Home, LockKeyhole, Search, Settings, ShieldAlert, Sparkles,
  X,
} from 'lucide-react'
import ToolPages from './tools'
import kyrodeckLogo from './assets/kyrodeck-logo.png'
import { EXAMPLE_SNIPPETS, NAV_ITEMS, normalizeSnippets, parseSnippetImport, readLocal, TOOL_INFO, writeLocal, type Snippet, type ToolId } from './lib'

type PageId = typeof NAV_ITEMS[number]['id']
type Preferences = { theme: 'light' | 'dark'; favorites: ToolId[]; recent: ToolId[] }
const defaultPreferences: Preferences = { theme: 'light', favorites: ['json', 'snippets'], recent: [] }

const navIcons = {
  overview: Home,
  json: Braces,
  scanner: ShieldAlert,
  snippets: FileCode2,
  diff: FileDiff,
  regex: Fingerprint,
  deobfuscator: Binary,
  http: Globe2,
  settings: Settings,
}

const routeToTool: Partial<Record<PageId, ToolId>> = {
  json: 'json', scanner: 'scanner', snippets: 'snippets', diff: 'diff', regex: 'regex', deobfuscator: 'deobfuscator', http: 'http',
}

function readPreferences(): Preferences {
  const stored = readLocal<Partial<Preferences>>('kyrodeck.preferences', {})
  return {
    theme: stored.theme === 'dark' ? 'dark' : 'light',
    favorites: Array.isArray(stored.favorites) ? stored.favorites.filter((id): id is ToolId => id in TOOL_INFO) : defaultPreferences.favorites,
    recent: Array.isArray(stored.recent) ? stored.recent.filter((id): id is ToolId => id in TOOL_INFO) : [],
  }
}

function App() {
  const [page, setPage] = useState<PageId>('overview')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [preferences, setPreferences] = useState(readPreferences)
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    const saved = readLocal<unknown>('kyrodeck.snippets', EXAMPLE_SNIPPETS)
    return normalizeSnippets(saved) ?? EXAMPLE_SNIPPETS
  })
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
    if (!writeLocal('kyrodeck.preferences', preferences)) setStorageError(true)
  }, [preferences])

  useEffect(() => {
    if (!writeLocal('kyrodeck.snippets', snippets)) setStorageError(true)
  }, [snippets])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const filteredNav = useMemo(() => NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query])
  const activeTool = routeToTool[page]
  const navigate = (nextPage: PageId) => {
    setPage(nextPage)
    setQuery('')
    setSearchOpen(false)
    const tool = routeToTool[nextPage]
    if (tool) setPreferences((current) => ({ ...current, recent: [tool, ...current.recent.filter((item) => item !== tool)].slice(0, 4) }))
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('global-search')?.focus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const notify = (message: string) => setToast(message)
  const toggleFavorite = (id: ToolId) => setPreferences((current) => ({
    ...current,
    favorites: current.favorites.includes(id) ? current.favorites.filter((item) => item !== id) : [...current.favorites, id],
  }))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('overview')} aria-label="KyroDeck overview">
          <span className="brand-mark"><img src={kyrodeckLogo} alt="KyroDeck logo" /></span>
          <span><strong>KyroDeck</strong><small>Build. Inspect. Debug.</small></span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = navIcons[item.id]
            const selected = page === item.id
            return <button key={item.id} className={`nav-item ${selected ? 'active' : ''}`} aria-current={selected ? 'page' : undefined} onClick={() => navigate(item.id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'settings' && <span className="nav-spacer" />}
            </button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-mark"><LockKeyhole size={15} /><span>Your data stays on this device.</span></div>
          <div className="sidebar-version">KYRODECK <span>·</span> LOCAL WORKSPACE</div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{NAV_ITEMS.find((item) => item.id === page)?.label}</strong></div>
          <div className="top-actions">
            <div className="search-wrap">
              <Search size={16} aria-hidden="true" />
              <input id="global-search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => {
                if (event.key === 'Enter' && filteredNav[0]) navigate(filteredNav[0].id)
              }} placeholder="Find a tool..." aria-label="Search workspace" aria-expanded={searchOpen} aria-controls="search-results" />
              {query ? <button className="search-clear" onClick={() => { setQuery(''); setSearchOpen(false) }} aria-label="Clear search"><X size={14} /></button> : <kbd><Command size={11} /> K</kbd>}
              {searchOpen && query && <div className="search-results" id="search-results">
                {filteredNav.length ? filteredNav.map((item) => {
                  const Icon = navIcons[item.id]
                  return <button key={item.id} onClick={() => navigate(item.id)}><Icon size={15} /><span>{item.label}</span><span className="search-enter">↵</span></button>
                }) : <div className="search-empty">No matching tools</div>}
              </div>}
            </div>
            <button className="top-icon" aria-label="Toggle favorite for current tool" title="Favorite this tool" disabled={!activeTool} onClick={() => activeTool && toggleFavorite(activeTool)}>
              <Heart size={17} fill={activeTool && preferences.favorites.includes(activeTool) ? 'currentColor' : 'none'} />
            </button>
            <button className="avatar" aria-label="KyroDeck home" title="Go to Overview" onClick={() => navigate('overview')}>
              <img src={kyrodeckLogo} alt="KyroDeck logo" />
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = navIcons[item.id]
            return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)} aria-label={item.label} title={item.label}><Icon size={18} /><span>{item.label}</span></button>
          })}
        </nav>

        <main className="main-content" onClick={() => searchOpen && setSearchOpen(false)}>
          {storageError && <div className="storage-warning" role="status">Browser storage is unavailable. Changes may not persist after you close this tab.</div>}
          {page === 'overview' ? <Overview
            navigate={navigate}
            recent={preferences.recent}
            favorites={preferences.favorites}
            snippets={snippets}
            toggleFavorite={toggleFavorite}
          /> : activeTool ? <ToolPages
            tool={activeTool}
            snippets={snippets}
            onSnippetsChange={setSnippets}
            notify={notify}
          /> : <SettingsPage
            theme={preferences.theme}
            onThemeChange={(theme) => setPreferences((current) => ({ ...current, theme }))}
            snippets={snippets}
            onImport={setSnippets}
            onClear={() => { setSnippets(EXAMPLE_SNIPPETS); setPreferences(defaultPreferences); notify('Local data cleared') }}
            onReset={() => { setPreferences(defaultPreferences); notify('Preferences reset') }}
            notify={notify}
          />}
        </main>
      </div>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  )
}

function Overview({ navigate, recent, favorites, snippets, toggleFavorite }: {
  navigate: (page: PageId) => void
  recent: ToolId[]
  favorites: ToolId[]
  snippets: Snippet[]
  toggleFavorite: (id: ToolId) => void
}) {
  const [filter, setFilter] = useState('')
  const tools = Object.entries(TOOL_INFO) as Array<[ToolId, typeof TOOL_INFO[ToolId]]>
  const visibleTools = tools.filter(([, info]) => `${info.title} ${info.description}`.toLowerCase().includes(filter.toLowerCase()))
  const recentSnippets = [...snippets].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  return <div className="overview-page">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="eyebrow-dot" />YOUR DEVELOPER WORKSPACE</div><h1>Good tools. Clear thinking.</h1><p>A focused place to inspect data, debug code, and keep useful things close.</p></div>
      <div className="welcome-stamp"><Code2 size={20} /><span>Build.<br />Inspect.<br />Debug.</span></div>
    </section>
    <section className="tool-section">
      <div className="section-heading"><div><h2>Tools</h2><p>Small, practical utilities for the work in front of you.</p></div><label className="tool-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tools" aria-label="Filter tools" /></label></div>
      <div className="tool-grid">
        {visibleTools.map(([id, info], index) => {
          const Icon = navIcons[id]
          return <article key={id} className="tool-card" style={{ animationDelay: `${index * 45}ms` }}>
            <button className={`card-favorite ${favorites.includes(id) ? 'selected' : ''}`} aria-label={`${favorites.includes(id) ? 'Remove' : 'Add'} ${info.title} ${favorites.includes(id) ? 'from' : 'to'} favorites`} onClick={() => toggleFavorite(id)}><Heart size={15} fill={favorites.includes(id) ? 'currentColor' : 'none'} /></button>
            <button className="tool-card-main" onClick={() => navigate(id)}>
              <span className={`tool-icon tool-icon-${id}`}><Icon size={19} strokeWidth={1.8} /></span><span className="tool-card-copy"><strong>{info.title}</strong><span>{info.description}</span></span><span className="card-arrow">↗</span>
            </button>
          </article>
        })}
        {!visibleTools.length && <div className="empty-inline">No tools match “{filter}”.</div>}
      </div>
    </section>
    <div className="overview-lower">
      <section className="lower-section"><div className="lower-title"><h2>Recently used</h2><span className="subtle-label">YOUR WORKFLOW</span></div>
        {recent.length ? <div className="recent-list">{recent.slice(0, 3).map((id) => { const Icon = navIcons[id]; return <button key={id} onClick={() => navigate(id)}><span className="recent-icon"><Icon size={16} /></span><span className="recent-name">{TOOL_INFO[id].title}</span><span className="recent-desc">{TOOL_INFO[id].short}</span><span className="recent-arrow">→</span></button> })}</div> : <button className="empty-recent" onClick={() => navigate('json')}><span className="recent-icon"><Sparkles size={16} /></span><span>Try the JSON Toolkit</span><span className="recent-arrow">→</span></button>}
      </section>
      <section className="lower-section"><div className="lower-title"><h2>Favorites</h2><span className="subtle-label">QUICK ACCESS</span></div>
        {favorites.length ? <div className="favorite-list">{favorites.slice(0, 3).map((id) => { const Icon = navIcons[id]; return <button key={id} onClick={() => navigate(id)}><Icon size={15} /><span>{TOOL_INFO[id].title}</span><ChevronDown size={13} className="favorite-open" /></button> })}</div> : <p className="empty-copy">Pin the tools you reach for most.</p>}
      </section>
    </div>
    <section className="snippet-preview"><div className="lower-title"><div><h2>Recently updated snippets</h2><p>Handy code, saved in this browser.</p></div><button className="text-link" onClick={() => navigate('snippets')}>Open vault <span>→</span></button></div>
      {recentSnippets.length ? <div className="snippet-preview-list">{recentSnippets.map((snippet) => <button key={snippet.id} onClick={() => navigate('snippets')}><span className="snippet-file-icon"><FileCode2 size={16} /></span><span className="snippet-preview-name"><strong>{snippet.title}</strong><small>{snippet.language} · {snippet.tags.slice(0, 2).join(', ') || 'No tags'}</small></span><span className="snippet-updated">{snippet.example ? 'Example' : new Date(snippet.updatedAt).toLocaleDateString()}</span></button>)}</div> : <p className="empty-copy">Your saved snippets will show up here.</p>}
    </section>
  </div>
}

function SettingsPage({ theme, onThemeChange, snippets, onImport, onClear, onReset, notify }: {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  snippets: Snippet[]
  onImport: (snippets: Snippet[]) => void
  onClear: () => void
  onReset: () => void
  notify: (message: string) => void
}) {
  const [importError, setImportError] = useState('')
  const download = () => {
    const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'kyrodeck-snippets.json'
    link.click()
    URL.revokeObjectURL(link.href)
    notify('Snippet data exported')
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const imported = parseSnippetImport(await file.text())
      onImport([...imported, ...snippets.filter((item) => !item.example)])
      setImportError('')
      notify(`${imported.length} snippet${imported.length === 1 ? '' : 's'} imported`)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read this file.')
    }
  }
  return <div className="settings-page"><div className="page-heading"><div className="eyebrow">WORKSPACE</div><h1>Settings</h1><p>Preferences and data stored on this device.</p></div>
    <section className="settings-section"><div className="settings-section-title"><div><h2>Appearance</h2><p>Choose a comfortable workspace theme.</p></div></div><div className="settings-row"><div><strong>Theme</strong><small>Light is the default. Your choice is saved locally.</small></div><div className="segmented"><button className={theme === 'light' ? 'active' : ''} onClick={() => onThemeChange('light')}>Light</button><button className={theme === 'dark' ? 'active' : ''} onClick={() => onThemeChange('dark')}>Dark</button></div></div></section>
    <section className="settings-section"><div className="settings-section-title"><div><h2>Snippet data</h2><p>Move your vault between browsers with a JSON file.</p></div></div><div className="settings-row"><div><strong>Export snippets</strong><small>{snippets.length} snippets currently saved in this browser.</small></div><button className="button button-secondary" onClick={download}>Export JSON</button></div><div className="settings-row"><div><strong>Import snippets</strong><small>Imported snippets are added to your vault.</small></div><label className="button button-secondary file-button">Import JSON<input type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} /></label></div>{importError && <div className="inline-error">{importError}</div>}</section>
    <section className="settings-section"><div className="settings-section-title"><div><h2>Local data</h2><p>KyroDeck does not upload your content or sync it across devices.</p></div></div><div className="settings-row"><div><strong>Reset preferences</strong><small>Restore the default theme and favorite tools.</small></div><button className="button button-secondary" onClick={onReset}>Reset preferences</button></div><div className="settings-row"><div><strong>Clear saved data</strong><small>Remove saved snippets and restore the built-in examples.</small></div><button className="button button-danger" onClick={() => { if (window.confirm('Clear your saved snippets and reset preferences?')) onClear() }}>Clear local data</button></div></section>
    <div className="privacy-note"><LockKeyhole size={17} /><div><strong>Private by default</strong><p>Saved data lives in this browser’s LocalStorage. It is not automatically shared, synced, or sent to a server.</p></div></div>
  </div>
}

export default App
