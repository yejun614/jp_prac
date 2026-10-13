import { useRef, useState } from 'react'
import { docText, docTitle } from './Pane.jsx'
import { textToHtml } from '../lib/exporter.js'

function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return new Date(ts).toLocaleDateString('ko-KR')
}

/** 모든 메모 목록 (닫힌 탭도 여기서 다시 열 수 있다) */
export default function Sidebar({ docs, openIds, dispatch }) {
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const fileRef = useRef(null)

  const list = Object.values(docs)
    .map((d) => ({ d, title: docTitle(d), text: docText(d) }))
    .filter(({ title, text }) => !query || (title + '\n' + text).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.d.updatedAt - a.d.updatedAt)

  const onFile = async (e) => {
    for (const file of e.target.files) {
      const text = await file.text()
      dispatch({ type: 'newDoc', title: file.name.replace(/\.(txt|md|markdown)$/i, ''), html: textToHtml(text) })
    }
    e.target.value = ''
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <input className="search" placeholder="메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="sidebar-actions">
        <button className="btn primary" onClick={() => dispatch({ type: 'newDoc' })}>
          + 새 메모
        </button>
        <button className="btn" onClick={() => fileRef.current.click()} title=".txt / .md 파일 열기">
          파일 열기
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md,.markdown,text/plain" multiple hidden onChange={onFile} />
      </div>
      <ul className="doc-list">
        {list.map(({ d, title, text }) => (
          <li key={d.id} className={openIds.has(d.id) ? 'open' : ''} onClick={() => dispatch({ type: 'openDoc', docId: d.id })}>
            <div className="doc-title">{title}</div>
            <div className="doc-preview">{text.replace(/\s+/g, ' ').slice(0, 60) || '(빈 메모)'}</div>
            <div className="doc-meta">
              {timeAgo(d.updatedAt)}
              {confirmId === d.id ? (
                <span className="confirm" onClick={(e) => e.stopPropagation()}>
                  <button className="link danger" onClick={() => dispatch({ type: 'deleteDoc', docId: d.id })}>
                    삭제
                  </button>
                  <button className="link" onClick={() => setConfirmId(null)}>
                    취소
                  </button>
                </span>
              ) : (
                <button
                  className="link del"
                  title="메모 삭제"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmId(d.id)
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          </li>
        ))}
        {!list.length && <li className="empty">메모가 없습니다</li>}
      </ul>
    </aside>
  )
}
