import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import Toolbar from './components/Toolbar.jsx'
import { MODES } from './lib/modes.js'
import Sidebar from './components/Sidebar.jsx'
import Layout from './components/Layout.jsx'
import DictDialog from './components/DictDialog.jsx'
import { docTitle } from './components/Pane.jsx'
import { allPanes, findPane, loadState, reducer, saveState } from './lib/store.js'
import { downloadFile, htmlToMarkdown, htmlToText, safeFilename } from './lib/exporter.js'
import { registry } from './lib/registry.js'
import { dictionary } from './ime/dictionary.js'

const MODE_KEY = 'jpmemo:mode'
const SIDEBAR_KEY = 'jpmemo:sidebar'

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, loadState)
  const [mode, setModeState] = useState(() => localStorage.getItem(MODE_KEY) || 'ja')
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== '0')
  const [dictOpen, setDictOpen] = useState(false)
  const [, setDictVersion] = useState(0)
  const [stats, setStats] = useState('')
  const [savedState, setSavedState] = useState(state)
  const saved = savedState === state

  const setMode = useCallback((m) => {
    setModeState(m)
    localStorage.setItem(MODE_KEY, m)
  }, [])

  // 자동 저장 (디바운스)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        saveState(state)
        setSavedState(state)
      } catch (e) {
        console.error('저장 실패', e)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    dictionary.loadExternalFromDB().then(() => setDictVersion((v) => v + 1))
  }, [])

  useEffect(() => localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? '1' : '0'), [sidebarOpen])

  // 전역 단축키
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      const ids = MODES.map((m) => m.id)
      if (/^Digit[123]$/.test(e.code)) {
        handled()
        setMode(ids[Number(e.code.slice(5)) - 1])
      } else if (e.code === 'Backquote') {
        handled()
        setModeState((cur) => {
          const next = ids[(ids.indexOf(cur) + 1) % ids.length]
          localStorage.setItem(MODE_KEY, next)
          return next
        })
      } else if (e.code === 'KeyN') {
        handled()
        dispatch({ type: 'newDoc' })
      } else if (e.code === 'KeyW') {
        handled()
        dispatch({ type: 'closeActiveTab' })
      } else if (e.code === 'Backslash') {
        handled()
        dispatch({ type: 'splitActive', side: 'right' })
      } else if (e.code === 'Minus') {
        handled()
        dispatch({ type: 'splitActive', side: 'bottom' })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [setMode])

  const activePane = findPane(state.layout, state.activePane)
  const activeDoc = activePane?.active ? state.docs[activePane.active] : null

  const openIds = useMemo(() => new Set(allPanes(state.layout).flatMap((p) => p.tabs)), [state.layout])

  const onDownload = (format) => {
    registry.active?.flush()
    // flush 직후의 최신 내용은 에디터 DOM 에 있으므로 우선 사용
    const editorDocId = registry.active?.docId()
    const doc = activeDoc
    if (!doc) return
    const html = editorDocId === doc.id ? registry.active.el().innerHTML : doc.html
    const name = safeFilename(docTitle(doc))
    if (format === 'md') downloadFile(`${name}.md`, htmlToMarkdown(html), 'text/markdown')
    else downloadFile(`${name}.txt`, htmlToText(html), 'text/plain')
  }

  const modeInfo = MODES.find((m) => m.id === mode)

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        setMode={setMode}
        onDownload={onDownload}
        onOpenDict={() => setDictOpen(true)}
        sidebarOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen((v) => !v)}
        writingMode={activeDoc?.writingMode ?? 'horizontal'}
        setWritingMode={
          activeDoc ? (writingMode) => dispatch({ type: 'setWritingMode', docId: activeDoc.id, writingMode }) : null
        }
      />
      <div className="main">
        {sidebarOpen && <Sidebar docs={state.docs} openIds={openIds} dispatch={dispatch} />}
        <div className="workspace">
          <Layout
            node={state.layout}
            docs={state.docs}
            dispatch={dispatch}
            mode={mode}
            activePane={state.activePane}
            onStats={setStats}
          />
        </div>
      </div>
      <footer className="statusbar">
        <span className={'mode-badge ' + mode}>
          {modeInfo.label} {modeInfo.name}
        </span>
        {mode === 'ja' && <span className="muted">Space 변환 · Enter 확정 · F7 カタカナ</span>}
        {mode === 'ko' && <span className="muted">두벌식</span>}
        <span className="status-spacer" />
        {activeDoc && <StatsText text={stats} />}
        <span className="muted">{saved ? '자동 저장됨' : '저장 중…'}</span>
      </footer>
      {dictOpen && <DictDialog onClose={() => setDictOpen(false)} onChanged={() => setDictVersion((v) => v + 1)} />}
    </div>
  )
}

function StatsText({ text }) {
  const chars = [...text.replace(/\s/g, '')].length
  const lines = text ? text.replace(/\n$/, '').split('\n').length : 0
  return (
    <span className="muted">
      글자 {chars.toLocaleString()} · 줄 {lines.toLocaleString()}
    </span>
  )
}
