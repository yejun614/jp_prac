import { createPortal } from 'react-dom'

/** 일본어 변환 후보 창 */
export default function CandidateWindow({ view, onPick }) {
  const { candidates: c, anchor } = view
  const height = 40 + c.items.length * 32
  // 가로쓰기: 문절 아래 / 세로쓰기: 문절 왼쪽에 띄운다
  const style = anchor.vertical
    ? { top: Math.max(8, Math.min(anchor.top, window.innerHeight - height)), right: window.innerWidth - anchor.left + 8 }
    : { top: Math.min(anchor.bottom + 6, window.innerHeight - height), left: Math.min(anchor.left, window.innerWidth - 240) }
  return createPortal(
    <div className="candidates" style={style} onMouseDown={(e) => e.preventDefault()}>
      <ol>
        {c.items.map((w, i) => (
          <li key={i} className={i === c.selected ? 'selected' : ''} onMouseDown={() => onPick(i)}>
            <span className="num">{i + 1}</span>
            <span className="word">{w}</span>
          </li>
        ))}
      </ol>
      <div className="cand-footer">
        {c.selected + 1 + (c.page - 1) * 9} / {c.total}
        {c.pages > 1 && <span> · PgUp/PgDn</span>}
      </div>
    </div>,
    document.body,
  )
}
