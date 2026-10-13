import { useCallback, useEffect, useRef, useState } from 'react'
import AppNav from '../components/AppNav.jsx'
import Keyboard from '../components/Keyboard.jsx'
import { RomajiMatcher } from '../typing/romaji.js'
import { MODES, makeRound } from '../typing/data.js'
import { furigana } from '../typing/furigana.js'
import '../typing/typing.css'

const SETTINGS_KEY = 'jpmemo:typing-settings'
const RECORDS_KEY = 'jpmemo:typing-records'

const KANA_SETS = [
  { id: 'hiragana', label: 'ひらがな' },
  { id: 'katakana', label: 'カタカナ' },
  { id: 'both', label: '둘 다' },
]

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

// 가나 모드에서는 문제 자체가 가나이므로 '가나 가리기'가 적용되지 않는다
const kanaHidden = (s) => s.mode !== 'kana' && !s.showKana
const romajiHidden = (s) => !s.showRomaji

// 가리기 옵션을 켠 기록은 난이도가 달라서 따로 저장한다
const recordKey = (s) =>
  (s.mode === 'kana' ? `kana-${s.kanaSet}` : s.mode) + (kanaHidden(s) ? '-nokana' : '') + (romajiHidden(s) ? '-noromaji' : '')

// 로마자를 가렸을 때, 같은 자리에서 이만큼 연속으로 틀리면 다음 키를 힌트로 보여준다
const HINT_AFTER_MISSES = 3

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function calcStats(g, now = Date.now()) {
  const elapsed = g.start ? now - g.start : 0
  const total = g.correct + g.miss
  return {
    elapsed,
    kpm: elapsed > 1000 ? Math.round((g.correct / elapsed) * 60000) : 0,
    accuracy: total ? (g.correct / total) * 100 : 100,
    miss: g.miss,
    correct: g.correct,
  }
}

export default function TypingPage() {
  const [settings, setSettings] = useState(() => ({
    mode: 'sentence',
    kanaSet: 'hiragana',
    showKana: true,
    showRomaji: true,
    showKeyboard: true,
    showFurigana: false,
    ...loadJSON(SETTINGS_KEY, {}),
  }))
  const [phase, setPhase] = useState('ready') // ready | playing | result
  const [, setTick] = useState(0)
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState(() => loadJSON(RECORDS_KEY, {}))
  const [imeWarning, setImeWarning] = useState(false)
  const [missFlash, setMissFlash] = useState(0)
  const game = useRef(null)

  const rerender = () => setTick((t) => t + 1)

  useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings])

  const start = useCallback(() => {
    const items = makeRound(settings.mode, settings.kanaSet)
    game.current = {
      items,
      index: 0,
      matcher: new RomajiMatcher(items[0].kana),
      correct: 0,
      miss: 0,
      missBy: {},
      streak: 0, // 현재 자리에서 연속으로 틀린 횟수
      start: null,
    }
    setResult(null)
    setPhase('playing')
    // 시작 버튼에 포커스가 남아 있으면 Space 입력이 버튼을 다시 누른다
    document.activeElement?.blur?.()
  }, [settings])

  const finish = useCallback(() => {
    const g = game.current
    const stats = calcStats(g)
    const worst = Object.entries(g.missBy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const entry = { date: Date.now(), kpm: stats.kpm, accuracy: stats.accuracy, elapsed: stats.elapsed, miss: stats.miss }
    const key = recordKey(settings)
    const prev = records[key] ?? { best: null, recent: [] }
    const isBest = !prev.best || entry.kpm > prev.best.kpm
    const next = {
      ...records,
      [key]: { best: isBest ? entry : prev.best, recent: [entry, ...prev.recent].slice(0, 10) },
    }
    setRecords(next)
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next))
    setResult({ ...stats, worst, isBest, best: next[key].best })
    setPhase('result')
  }, [records, settings])

  // 키 입력
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Process' || e.isComposing || e.keyCode === 229) {
        setImeWarning(true)
        return
      }
      if (phase === 'ready') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          start()
        } else if (/^[1-3]$/.test(e.key)) {
          setSettings((s) => ({ ...s, mode: MODES[Number(e.key) - 1].id }))
        }
        return
      }
      if (phase === 'result') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          start()
        } else if (e.key === 'Escape') setPhase('ready')
        return
      }
      // playing
      if (e.key === 'Escape') {
        setPhase('ready')
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault()
      setImeWarning(false)
      const g = game.current
      if (!g.start) g.start = Date.now()
      const kana = g.matcher.currentKana()
      if (g.matcher.input(e.key)) {
        g.correct++
        g.streak = 0
        if (g.matcher.done) {
          g.index++
          if (g.index >= g.items.length) {
            finish()
            return
          }
          g.matcher = new RomajiMatcher(g.items[g.index].kana)
        }
      } else {
        g.miss++
        g.streak++
        if (kana) g.missBy[kana] = (g.missBy[kana] ?? 0) + 1
        setMissFlash((n) => n + 1)
      }
      rerender()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, start, finish])

  // 경과 시간 표시 갱신
  useEffect(() => {
    if (phase !== 'playing') return
    const t = setInterval(rerender, 250)
    return () => clearInterval(t)
  }, [phase])

  return (
    <div className="typing-page">
      <header className="typing-header">
        <AppNav />
        <div className="typing-title">日本語タイピング練習</div>
      </header>

      <main className="typing-main">
        {imeWarning && (
          <div className="ty-warning">
            운영체제 입력기가 한글/일본어 상태예요. <b>한/영</b> 키를 눌러 영문 입력으로 바꿔주세요.
          </div>
        )}
        {phase === 'ready' && <Ready settings={settings} setSettings={setSettings} records={records} onStart={start} />}
        {phase === 'playing' && game.current && <Play game={game.current} missFlash={missFlash} settings={settings} setSettings={setSettings} />}
        {phase === 'result' && result && <Result result={result} onRetry={start} onBack={() => setPhase('ready')} />}
      </main>
    </div>
  )
}

function Ready({ settings, setSettings, records, onStart }) {
  const rec = records[recordKey(settings)]
  return (
    <section className="ty-ready">
      <h1>모드를 고르세요</h1>
      <div className="ty-modes">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            className={'ty-mode' + (settings.mode === m.id ? ' on' : '')}
            onClick={() => setSettings((s) => ({ ...s, mode: m.id }))}
          >
            <span className="ty-mode-key">{i + 1}</span>
            <span className="ty-mode-name">{m.name}</span>
            <span className="ty-mode-desc">
              {m.desc} · {m.count}문제
            </span>
          </button>
        ))}
      </div>
      {settings.mode === 'kana' && (
        <div className="ty-kanaset" role="radiogroup" aria-label="가나 종류">
          {KANA_SETS.map((k) => (
            <button
              key={k.id}
              role="radio"
              aria-checked={settings.kanaSet === k.id}
              className={settings.kanaSet === k.id ? 'on' : ''}
              onClick={() => setSettings((s) => ({ ...s, kanaSet: k.id }))}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
      <div className="ty-options">
        <Toggle
          label="히라가나 / 가타카나"
          value={settings.mode === 'kana' ? true : settings.showKana}
          disabled={settings.mode === 'kana'}
          note={settings.mode === 'kana' ? '가나 모드에서는 항상 표시' : null}
          onChange={(v) => setSettings((s) => ({ ...s, showKana: v }))}
        />
        <Toggle
          label="후리가나"
          value={settings.mode === 'kana' ? false : settings.showFurigana}
          labels={['표시', '미표시']}
          disabled={settings.mode === 'kana'}
          note={settings.mode === 'kana' ? '가나 모드에는 한자가 없음' : null}
          onChange={(v) => setSettings((s) => ({ ...s, showFurigana: v }))}
        />
        <Toggle label="로마자" value={settings.showRomaji} onChange={(v) => setSettings((s) => ({ ...s, showRomaji: v }))} />
        <Toggle
          label="키보드"
          value={settings.showKeyboard}
          labels={['표시', '숨기기']}
          onChange={(v) => setSettings((s) => ({ ...s, showKeyboard: v }))}
        />
      </div>
      {(kanaHidden(settings) || romajiHidden(settings)) && (
        <p className="muted small">
          {romajiHidden(settings)
            ? `가린 줄에는 입력한 부분만 보여요. 같은 곳에서 ${HINT_AFTER_MISSES}번 연속 틀리면 다음 키를 힌트로 보여줘요.`
            : '가린 줄에는 입력한 부분만 보여요.'}
        </p>
      )}
      <button className="btn primary ty-start" onClick={onStart}>
        시작하기
      </button>
      <p className="muted">
        <b>Space</b> 또는 <b>Enter</b>로 시작 · 연습 중 <b>Esc</b>로 중단
      </p>
      <p className="muted small">
        로마자로 입력합니다. shi/si, tsu/tu, chi/ti, ん은 n/nn 등 여러 표기를 모두 인정해요. OS 입력기는 영문 상태로 두세요.
      </p>
      {rec?.best && (
        <div className="ty-records">
          <div>
            최고 기록 <b>{rec.best.kpm}</b> 타/분 · 정확도 {rec.best.accuracy.toFixed(1)}%
          </div>
          <ol>
            {rec.recent.map((r) => (
              <li key={r.date}>
                <span>{new Date(r.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span>{r.kpm} 타/분</span>
                <span>{r.accuracy.toFixed(1)}%</span>
                <span>{formatTime(r.elapsed)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function Play({ game, missFlash, settings, setSettings }) {
  const { items, index, matcher } = game
  const hideKana = kanaHidden(settings)
  const hideRomaji = romajiHidden(settings)
  const hint = hideRomaji && game.streak >= HINT_AFTER_MISSES
  const item = items[index]
  const next = items[index + 1]
  const stats = calcStats(game)
  const { typed, rest } = matcher.guide()
  const sameText = item.text === item.kana
  const kanaChars = [...item.kana]

  // 가렸을 때는 아직 안 친 글자를 투명하게 그려 자리만 차지하게 한다 (줄 폭이 고정돼 밑줄이 밀리지 않음)
  const kanaLine = kanaChars.map((c, i) => (
    <span
      key={i}
      className={i < matcher.pos ? 'typed' : hideKana ? 'concealed' : i === matcher.pos ? 'current' : ''}
    >
      {i >= matcher.pos && hideKana ? <span>{c}</span> : c}
    </span>
  ))

  return (
    <section className="ty-play">
      <div className="ty-progress">
        <div className="ty-progress-bar" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <div className="ty-stats">
        <span>
          {index + 1} / {items.length}
        </span>
        <span>⏱ {formatTime(stats.elapsed)}</span>
        <span>
          <b>{stats.kpm}</b> 타/분
        </span>
        <span>정확도 {stats.accuracy.toFixed(1)}%</span>
        <span>오타 {stats.miss}</span>
        <button
          className="ty-kb-toggle"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setSettings((s) => ({ ...s, showKeyboard: !s.showKeyboard }))}
        >
          ⌨ {settings.showKeyboard ? '키보드 숨기기' : '키보드 표시'}
        </button>
      </div>

      <div className={'ty-card' + (sameText ? ' kana-only' : '')} key={`card-${index}`}>
        {/* 1줄: 한자 문장 */}
        {!sameText && (
          <div className="ty-text">
            {settings.showFurigana ? <Furigana text={item.text} kana={item.kana} /> : item.text}
          </div>
        )}
        {/* 2줄: 히라가나/가타카나만으로 된 읽기 */}
        <div className={(sameText ? 'ty-text ty-kana-main' : 'ty-kana') + (hideKana ? ' hidden-line' : '')}>
          {kanaLine}
        </div>
        {/* 3줄: 입력할 영문(로마자) */}
        <div
          className={'ty-romaji' + (hideRomaji ? ' hidden-line' : '')}
          key={`miss-${missFlash}`}
          data-miss={missFlash > 0 || undefined}
        >
          <span className="typed">{typed}</span>
          {hideRomaji ? (
            <>
              {hint && <span className="cursor hint">{rest[0]}</span>}
              <span className="concealed">
                <span>{hint ? rest.slice(1) : rest}</span>
              </span>
            </>
          ) : (
            <>
              <span className="cursor">{rest[0]}</span>
              <span>{rest.slice(1)}</span>
            </>
          )}
        </div>
        {item.ko && <div className="ty-ko">{item.ko}</div>}
      </div>

      <div className="ty-next">{next ? <>다음: {next.text}</> : '마지막 문제'}</div>

      {/* 로마자를 가렸으면 키보드도 정답을 알려주지 않는다 (힌트 때만 표시) */}
      {settings.showKeyboard && <Keyboard nextKey={!hideRomaji || hint ? matcher.nextKey() : ''} />}
    </section>
  )
}

function Result({ result, onRetry, onBack }) {
  return (
    <section className="ty-result">
      <h1>{result.isBest ? '🎉 최고 기록!' : '연습 완료'}</h1>
      <div className="ty-result-grid">
        <div>
          <span>타수</span>
          <b>{result.kpm}</b>
          <small>타/분</small>
        </div>
        <div>
          <span>정확도</span>
          <b>{result.accuracy.toFixed(1)}</b>
          <small>%</small>
        </div>
        <div>
          <span>시간</span>
          <b>{formatTime(result.elapsed)}</b>
        </div>
        <div>
          <span>오타</span>
          <b>{result.miss}</b>
          <small>회</small>
        </div>
      </div>
      {result.worst.length > 0 && (
        <div className="ty-worst">
          자주 틀린 글자:{' '}
          {result.worst.map(([k, n]) => (
            <span key={k}>
              {k} <small>×{n}</small>
            </span>
          ))}
        </div>
      )}
      {!result.isBest && result.best && <p className="muted">최고 기록: {result.best.kpm} 타/분</p>}
      <div className="ty-result-actions">
        <button className="btn primary" onClick={onRetry}>
          다시 하기 (Space)
        </button>
        <button className="btn" onClick={onBack}>
          모드 선택 (Esc)
        </button>
      </div>
    </section>
  )
}

function Toggle({ label, value, onChange, disabled, note, labels = ['표시', '가리기'] }) {
  return (
    <div className={'ty-toggle' + (disabled ? ' disabled' : '')}>
      <span className="ty-toggle-label">{label}</span>
      <div className="ty-seg" role="radiogroup" aria-label={label}>
        {[
          [true, labels[0]],
          [false, labels[1]],
        ].map(([v, text]) => (
          <button
            key={text}
            role="radio"
            aria-checked={value === v}
            className={value === v ? 'on' : ''}
            disabled={disabled}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
      {note && <span className="ty-toggle-note">{note}</span>}
    </div>
  )
}

/** 한자 위에 읽기(후리가나)를 붙여 보여준다. 읽기를 맞출 수 없으면 원문 그대로 */
function Furigana({ text, kana }) {
  const parts = furigana(text, kana)
  if (!parts) return text
  return parts.map((p, i) =>
    p.ruby ? (
      <ruby key={i}>
        {p.base}
        <rt>{p.ruby}</rt>
      </ruby>
    ) : (
      <span key={i}>{p.base}</span>
    ),
  )
}
