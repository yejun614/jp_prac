import { useEffect, useRef, useState } from 'react'
import { registry } from '../lib/registry.js'
import { MODES } from '../lib/modes.js'
import AppNav from './AppNav.jsx'

const TEXT_COLORS = ['#111827', '#6b7280', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777']
const HIGHLIGHTS = ['#fef08a', '#fed7aa', '#fecaca', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#e5e7eb']

const exec = (cmd, value) => registry.active?.exec(cmd, value)
// 툴바 버튼 클릭이 에디터 포커스/선택을 빼앗지 않도록
const keep = (e) => e.preventDefault()

function useFormatState() {
  const [state, setState] = useState({})
  useEffect(() => {
    const update = () => {
      const el = registry.active?.el()
      const sel = window.getSelection()
      if (!el || !sel.rangeCount || !el.contains(sel.anchorNode)) return
      const q = (c) => {
        try {
          return document.queryCommandState(c)
        } catch {
          return false
        }
      }
      let block = ''
      try {
        block = document.queryCommandValue('formatBlock')
      } catch {
        /* noop */
      }
      setState({
        bold: q('bold'),
        italic: q('italic'),
        underline: q('underline'),
        strikeThrough: q('strikeThrough'),
        ul: q('insertUnorderedList'),
        left: q('justifyLeft'),
        center: q('justifyCenter'),
        right: q('justifyRight'),
        ol: q('insertOrderedList'),
        block: block.toLowerCase(),
      })
    }
    document.addEventListener('selectionchange', update)
    document.addEventListener('keyup', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      document.removeEventListener('keyup', update)
    }
  }, [])
  return state
}

function ColorPicker({ title, icon, colors, cmd, clearValue }) {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState(colors[cmd === 'foreColor' ? 2 : 0])
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const apply = (c) => {
    setLast(c)
    exec(cmd, c)
    setOpen(false)
  }

  return (
    <div className="color-picker" ref={ref}>
      <button className="tb-btn color-main" title={title} onMouseDown={keep} onClick={() => apply(last)}>
        {icon}
        <span className="color-bar" style={{ background: last }} />
      </button>
      <button className="tb-btn color-caret" title={title + ' 고르기'} onMouseDown={keep} onClick={() => setOpen(!open)}>
        ▾
      </button>
      {open && (
        <div className="color-pop" onMouseDown={keep}>
          <div className="swatches">
            {colors.map((c) => (
              <button key={c} className="swatch" style={{ background: c }} title={c} onClick={() => apply(c)} />
            ))}
          </div>
          <div className="color-pop-row">
            <button className="btn small" onClick={() => apply(clearValue)}>
              {cmd === 'foreColor' ? '기본색' : '없음'}
            </button>
            <label className="btn small custom-color">
              직접 선택
              <input type="color" defaultValue={last} onChange={(e) => apply(e.target.value)} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Toolbar({ mode, setMode, onDownload, onOpenDict, sidebarOpen, toggleSidebar, writingMode, setWritingMode }) {
  const vertical = writingMode === 'vertical'
  const f = useFormatState()
  const btn = (cmd, label, title, active, value) => (
    <button
      className={'tb-btn' + (active ? ' on' : '')}
      title={title}
      onMouseDown={keep}
      onClick={() => exec(cmd, value)}
    >
      {label}
    </button>
  )
  const block = (tag, label, title) =>
    btn('formatBlock', label, title, f.block === tag || (tag === 'div' && (f.block === '' || f.block === 'p')), tag)

  return (
    <header className="toolbar">
      <button className={'tb-btn' + (sidebarOpen ? ' on' : '')} title="메모 목록" onClick={toggleSidebar}>
        ☰
      </button>
      <AppNav />

      <div className="mode-switch" role="radiogroup" aria-label="입력 모드">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            className={mode === m.id ? 'on' : ''}
            title={`${m.name} 입력 (${m.key})`}
            onMouseDown={keep}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="tb-group">
        {btn('bold', <b>B</b>, '굵게 (Ctrl+B)', f.bold)}
        {btn('italic', <i>I</i>, '기울임 (Ctrl+I)', f.italic)}
        {btn('underline', <u>U</u>, '밑줄 (Ctrl+U)', f.underline)}
        {btn('strikeThrough', <s>S</s>, '취소선 (Ctrl+Shift+X)', f.strikeThrough)}
      </div>

      <div className="tb-group">
        <ColorPicker title="글자색" icon={<span className="a-icon">A</span>} colors={TEXT_COLORS} cmd="foreColor" clearValue="#111827" />
        <ColorPicker title="형광펜" icon={<span className="hl-icon">✎</span>} colors={HIGHLIGHTS} cmd="hiliteColor" clearValue="transparent" />
        {btn('removeFormat', <span className="clear-icon">T̸</span>, '서식 지우기')}
      </div>

      <div className="tb-group">
        {block('h1', 'H1', '제목 1')}
        {block('h2', 'H2', '제목 2')}
        {block('h3', 'H3', '제목 3')}
        {block('div', '¶', '본문')}
        {btn('insertUnorderedList', '•≡', '글머리 기호 목록', f.ul)}
        {btn('insertOrderedList', '1≡', '번호 목록', f.ol)}
        {block('blockquote', '❝', '인용')}
      </div>

      <div className="tb-group">
        {btn('justifyLeft', <AlignIcon kind="left" vertical={vertical} />, vertical ? '위쪽 정렬' : '왼쪽 정렬', f.left)}
        {btn('justifyCenter', <AlignIcon kind="center" vertical={vertical} />, '가운데 정렬', f.center)}
        {btn('justifyRight', <AlignIcon kind="right" vertical={vertical} />, vertical ? '아래쪽 정렬' : '오른쪽 정렬', f.right)}
      </div>

      <div className="tb-group" role="radiogroup" aria-label="쓰기 방향">
        <button
          className={'tb-btn text' + (!vertical ? ' on' : '')}
          title="가로쓰기"
          aria-checked={!vertical}
          role="radio"
          disabled={!setWritingMode}
          onMouseDown={keep}
          onClick={() => setWritingMode?.('horizontal')}
        >
          <WritingIcon vertical={false} /> 가로
        </button>
        <button
          className={'tb-btn text' + (vertical ? ' on' : '')}
          title="세로쓰기 (縦書き)"
          aria-checked={vertical}
          role="radio"
          disabled={!setWritingMode}
          onMouseDown={keep}
          onClick={() => setWritingMode?.('vertical')}
        >
          <WritingIcon vertical /> 세로
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button className="tb-btn text" onMouseDown={keep} onClick={() => onDownload('md')} title="Markdown 파일로 다운로드">
          ⤓ .md
        </button>
        <button className="tb-btn text" onMouseDown={keep} onClick={() => onDownload('txt')} title="텍스트 파일로 다운로드">
          ⤓ .txt
        </button>
        <button className="tb-btn" onClick={onOpenDict} title="IME 사전 설정 · 도움말">
          ⚙
        </button>
      </div>
    </header>
  )
}

/** 정렬 아이콘. 세로쓰기에서는 90° 돌려 위/가운데/아래로 보이게 한다 */
function AlignIcon({ kind, vertical }) {
  const lines = {
    left: [[2, 14], [2, 10], [2, 14], [2, 8]],
    center: [[2, 14], [4, 12], [2, 14], [5, 11]],
    right: [[2, 14], [6, 14], [2, 14], [8, 14]],
  }[kind]
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      style={vertical ? { transform: 'rotate(90deg)' } : undefined}>
      {lines.map(([x1, x2], i) => (
        <line key={i} x1={x1} x2={x2} y1={3 + i * 3.4} y2={3 + i * 3.4} />
      ))}
    </svg>
  )
}

function WritingIcon({ vertical }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {vertical ? (
        <>
          <path d="M12 2v12" />
          <path d="M8 2v9" />
          <path d="M4 2v6" />
        </>
      ) : (
        <>
          <path d="M2 4h12" />
          <path d="M2 8h9" />
          <path d="M2 12h6" />
        </>
      )}
    </svg>
  )
}
