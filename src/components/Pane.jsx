import { useState } from 'react'
import Editor from './Editor.jsx'
import { htmlToText } from '../lib/exporter.js'
import { registry } from '../lib/registry.js'

const DND_TYPE = 'application/x-jpmemo-tab'

// 문서 객체는 불변으로 갱신되므로 객체 단위로 텍스트 변환 결과를 캐시한다
const textCache = new WeakMap()
export function docText(doc) {
  let t = textCache.get(doc)
  if (t === undefined) {
    t = htmlToText(doc.html)
    textCache.set(doc, t)
  }
  return t
}

export function docTitle(doc) {
  if (doc.title) return doc.title
  const line = docText(doc).split('\n').find((l) => l.trim())?.trim() || ''
  return (line.length > 24 ? line.slice(0, 24) + '…' : line) || '제목 없음'
}

function readDrag(e) {
  try {
    return JSON.parse(e.dataTransfer.getData(DND_TYPE))
  } catch {
    return null
  }
}

const isTabDrag = (e) => e.dataTransfer.types.includes(DND_TYPE)

/** 탭 표시줄 + 에디터를 가진 하나의 창 */
export default function Pane({ pane, docs, dispatch, mode, active, onStats }) {
  const [renaming, setRenaming] = useState(null)
  const [dropSide, setDropSide] = useState(null)
  const [tabDropIndex, setTabDropIndex] = useState(null)
  const doc = pane.active ? docs[pane.active] : null

  const focusPane = () => dispatch({ type: 'focusPane', paneId: pane.id })

  const onTabDragStart = (e, docId) => {
    registry.active?.flush()
    e.dataTransfer.setData(DND_TYPE, JSON.stringify({ docId, fromPane: pane.id }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const onTabBarDragOver = (e) => {
    if (!isTabDrag(e)) return
    e.preventDefault()
    const tabs = [...e.currentTarget.querySelectorAll('.tab')]
    let index = tabs.length
    for (let i = 0; i < tabs.length; i++) {
      const r = tabs[i].getBoundingClientRect()
      if (e.clientX < r.left + r.width / 2) {
        index = i
        break
      }
    }
    setTabDropIndex(index)
  }

  const onTabBarDrop = (e) => {
    const data = readDrag(e)
    setTabDropIndex(null)
    if (!data) return
    e.preventDefault()
    dispatch({ type: 'moveTab', fromPane: data.fromPane, toPane: pane.id, docId: data.docId, index: tabDropIndex ?? pane.tabs.length })
  }

  const onBodyDragOver = (e) => {
    if (!isTabDrag(e)) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const edge = 0.25
    let side = 'center'
    const dists = { left: x, right: 1 - x, top: y, bottom: 1 - y }
    const [nearest, d] = Object.entries(dists).sort((a, b) => a[1] - b[1])[0]
    if (d < edge) side = nearest
    setDropSide(side)
  }

  const onBodyDrop = (e) => {
    const data = readDrag(e)
    const side = dropSide
    setDropSide(null)
    if (!data) return
    e.preventDefault()
    if (side === 'center' || !side) {
      dispatch({ type: 'moveTab', fromPane: data.fromPane, toPane: pane.id, docId: data.docId })
    } else {
      dispatch({ type: 'split', paneId: pane.id, side, docId: data.docId, fromPane: data.fromPane })
    }
  }

  const commitRename = (docId, value) => {
    dispatch({ type: 'rename', docId, title: value })
    setRenaming(null)
  }

  return (
    <div className={'pane' + (active ? ' active' : '')} onMouseDownCapture={focusPane}>
      <div
        className="tabbar"
        onDragOver={onTabBarDragOver}
        onDragLeave={() => setTabDropIndex(null)}
        onDrop={onTabBarDrop}
        onDoubleClick={(e) => e.target === e.currentTarget && dispatch({ type: 'newDoc', paneId: pane.id })}
      >
        {pane.tabs.map((id, i) => {
          const d = docs[id]
          if (!d) return null
          return (
            <div
              key={id}
              className={'tab' + (id === pane.active ? ' current' : '') + (tabDropIndex === i ? ' drop-before' : '')}
              draggable={renaming !== id}
              onDragStart={(e) => onTabDragStart(e, id)}
              onClick={() => dispatch({ type: 'activateTab', paneId: pane.id, docId: id })}
              onDoubleClick={() => setRenaming(id)}
              onAuxClick={(e) => e.button === 1 && dispatch({ type: 'closeTab', paneId: pane.id, docId: id })}
              title={docTitle(d) + ' (더블클릭: 이름 바꾸기)'}
            >
              {renaming === id ? (
                <input
                  className="tab-rename"
                  autoFocus
                  defaultValue={d.title || docTitle(d)}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => commitRename(id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(id, e.target.value)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-title">{docTitle(d)}</span>
              )}
              <button
                className="tab-close"
                title="탭 닫기 (Alt+W)"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'closeTab', paneId: pane.id, docId: id })
                }}
              >
                ×
              </button>
            </div>
          )
        })}
        {tabDropIndex === pane.tabs.length && <div className="tab-drop-end" />}
        <button className="tab-new" title="새 메모 (Alt+N)" onClick={() => dispatch({ type: 'newDoc', paneId: pane.id })}>
          +
        </button>
        <div className="tabbar-spacer" />
        <div className="pane-actions">
          <button title="오른쪽으로 분할 (Alt+\)" onClick={() => dispatch({ type: 'split', paneId: pane.id, side: 'right' })}>
            <SplitIcon dir="row" />
          </button>
          <button title="아래로 분할 (Alt+-)" onClick={() => dispatch({ type: 'split', paneId: pane.id, side: 'bottom' })}>
            <SplitIcon dir="column" />
          </button>
        </div>
      </div>

      <div className="pane-body" onDragOver={onBodyDragOver} onDragLeave={() => setDropSide(null)} onDrop={onBodyDrop}>
        {doc ? (
          <Editor
            doc={doc}
            mode={mode}
            active={active}
            onChange={(docId, html) => dispatch({ type: 'docChange', docId, html })}
            onFocus={focusPane}
            onStats={active ? onStats : undefined}
          />
        ) : (
          <div className="pane-empty">
            <p>열린 메모가 없습니다.</p>
            <button className="btn primary" onClick={() => dispatch({ type: 'newDoc', paneId: pane.id })}>
              새 메모 만들기
            </button>
          </div>
        )}
        {dropSide && <div className={'drop-indicator ' + dropSide} />}
      </div>
    </div>
  )
}

export function SplitIcon({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      {dir === 'row' ? <line x1="8" y1="2.5" x2="8" y2="13.5" /> : <line x1="1.5" y1="8" x2="14.5" y2="8" />}
    </svg>
  )
}
