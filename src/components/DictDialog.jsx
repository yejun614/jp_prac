import { useRef, useState } from 'react'
import { dictionary } from '../ime/dictionary.js'

const SKK_BASE = 'https://raw.githubusercontent.com/skk-dev/dict/master/'
const SKK_DICTS = [
  { file: 'SKK-JISYO.M', desc: '중형 · 약 140KB' },
  { file: 'SKK-JISYO.ML', desc: '중대형 · 약 1MB' },
  { file: 'SKK-JISYO.L', desc: '대형 · 약 4.5MB (추천)' },
]

/** IME 사전 설정 + 사용법 */
export default function DictDialog({ onClose, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  const load = async (label, getBuffer) => {
    setBusy(label)
    setMsg('')
    try {
      const buf = await getBuffer()
      const n = await dictionary.setExternal(buf, label)
      setMsg(`✅ ${label} 사전을 불러왔습니다 (${n.toLocaleString()}개 표제어).`)
      onChanged()
    } catch (e) {
      setMsg(`⚠️ 불러오기 실패: ${e.message}`)
    } finally {
      setBusy(null)
    }
  }

  const download = (file) =>
    load(file, async () => {
      const res = await fetch(SKK_BASE + file)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.arrayBuffer()
    })

  const onFile = (e) => {
    const file = e.target.files[0]
    if (file) load(file.name, () => file.arrayBuffer())
    e.target.value = ''
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="IME 설정">
        <div className="modal-head">
          <h2>IME 설정 · 도움말</h2>
          <button className="tb-btn" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <section>
          <h3>일본어 변환 사전</h3>
          <p className="muted">
            기본으로 자주 쓰는 단어 {dictionary.builtin.size.toLocaleString()}개가 내장되어 있습니다. 더 많은 한자 변환이 필요하면{' '}
            <a href="https://github.com/skk-dev/dict" target="_blank" rel="noreferrer">
              SKK 사전
            </a>
            을 내려받아 브라우저(IndexedDB)에 저장해 쓸 수 있어요.
          </p>
          <div className="dict-status">
            현재 확장 사전:{' '}
            <b>{dictionary.externalName ? `${dictionary.externalName} (${dictionary.externalSize.toLocaleString()}개)` : '없음'}</b>
          </div>
          <div className="dict-buttons">
            {SKK_DICTS.map((d) => (
              <button key={d.file} className="btn" disabled={!!busy} onClick={() => download(d.file)}>
                {busy === d.file ? '내려받는 중…' : d.file}
                <small>{d.desc}</small>
              </button>
            ))}
            <button className="btn" disabled={!!busy} onClick={() => fileRef.current.click()}>
              파일에서 불러오기
              <small>SKK 형식 (EUC-JP/UTF-8)</small>
            </button>
            <input ref={fileRef} type="file" hidden onChange={onFile} />
          </div>
          <div className="dict-buttons">
            {dictionary.externalName && (
              <button
                className="btn"
                onClick={async () => {
                  await dictionary.clearExternal()
                  setMsg('확장 사전을 삭제했습니다.')
                  onChanged()
                }}
              >
                확장 사전 삭제
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                dictionary.clearLearned()
                setMsg('변환 학습 기록을 초기화했습니다.')
              }}
            >
              학습 기록 초기화
            </button>
          </div>
          {msg && <p className="dict-msg">{msg}</p>}
        </section>

        <section>
          <h3>단축키</h3>
          <table className="keys">
            <tbody>
              <tr><td>Alt+1 / Alt+2 / Alt+3</td><td>영어 / 일본어 / 한국어 입력</td></tr>
              <tr><td>Alt+`</td><td>입력 모드 순환</td></tr>
              <tr><td>Space · ↓</td><td>(일) 변환 · 다음 후보</td></tr>
              <tr><td>Shift+Space · ↑</td><td>(일) 이전 후보</td></tr>
              <tr><td>Enter / Esc</td><td>(일) 확정 / 변환 취소</td></tr>
              <tr><td>← → / Shift+← →</td><td>(일) 문절 이동 / 문절 길이 조절</td></tr>
              <tr><td>1 ~ 9, PgUp/PgDn</td><td>(일) 후보 선택, 후보 페이지</td></tr>
              <tr><td>F6 F7 F8 F9 F10</td><td>(일) ひらがな · カタカナ · ﾊﾝｶｸ · ＡＢＣ · abc</td></tr>
              <tr><td>Ctrl+B / I / U</td><td>굵게 / 기울임 / 밑줄</td></tr>
              <tr><td>Ctrl+Shift+X</td><td>취소선</td></tr>
              <tr><td>Alt+N / Alt+W</td><td>새 메모 / 탭 닫기</td></tr>
              <tr><td>Alt+\ / Alt+-</td><td>오른쪽 / 아래로 분할</td></tr>
            </tbody>
          </table>
          <p className="muted">
            ※ 운영체제 한/영 IME가 켜져 있으면 그 입력이 우선합니다. 이 앱의 IME를 쓰려면 OS 입력기를 영문 상태로 두세요.
          </p>
        </section>
      </div>
    </div>
  )
}
