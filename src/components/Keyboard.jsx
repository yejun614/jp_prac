// 다음에 칠 키를 표시하는 화면 키보드
const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '['],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
]
// Shift 를 눌러야 하는 문자 → 실제 키
const SHIFTED = { '!': '1', '?': '/', '~': '`', ':': ';', '(': '9', ')': '0', '{': '[', '}': ']', '"': "'" }

export default function Keyboard({ nextKey }) {
  const k = nextKey.toLowerCase()
  const base = SHIFTED[k] ?? k
  const shift = k in SHIFTED
  return (
    <div className="keyboard" aria-hidden="true">
      {ROWS.map((row, r) => (
        <div key={r} className={`kb-row kb-row-${r}`}>
          {r === 3 && <span className={'kb-key kb-shift' + (shift ? ' next' : '')}>Shift</span>}
          {row.map((key) => (
            <span key={key} className={'kb-key' + (key === base ? ' next' : '') + (key === 'f' || key === 'j' ? ' home' : '')}>
              {key.toUpperCase()}
            </span>
          ))}
        </div>
      ))}
      <div className="kb-row">
        <span className={'kb-key kb-space' + (k === ' ' ? ' next' : '')}>Space</span>
      </div>
    </div>
  )
}
