// 일본어 IME 엔진: 로마자 → 히라가나 조합, 문절 분할, 가나·한자 변환
import { feedRomaji, flushRomaji, hiraToKata, toHalfKata, toFullAscii, kanaToRomaji } from './kana.js'
import { dictionary } from './dictionary.js'

const PAGE_SIZE = 9
const MAX_WORD = 16
// 조사: 분할 비용을 낮춰 단어 경계로 잘 잘리게 한다
const PARTICLES = new Set([...'はがをにでともへやかねよの'])

export class JapaneseIME {
  constructor() {
    this.reset()
  }

  reset() {
    this.units = [] // [{ kana, raw }]
    this.pending = '' // 아직 가나가 되지 않은 로마자
    this.conv = null // 변환 상태 { segments, focus, listOpen }
  }

  isComposing() {
    return this.units.length > 0 || this.pending !== '' || this.conv !== null
  }

  /** 현재 조합 중인 내용을 모두 확정하고 문자열을 돌려준다 */
  flush() {
    let text = ''
    if (this.conv) {
      for (const seg of this.conv.segments) {
        const word = seg.cands[seg.index]
        if (seg.index > 0 || seg.learnable) dictionary.learn(seg.reading, word)
        text += word
      }
    } else {
      text = this.reading()
    }
    this.reset()
    return text
  }

  reading() {
    return this.units.map((u) => u.kana).join('') + flushRomaji(this.pending)
  }

  raw() {
    return this.units.map((u) => u.raw).join('') + this.pending
  }

  /**
   * 키 입력 처리
   * @param {{key:string, shift:boolean, ctrl:boolean, alt:boolean, meta:boolean}} ev
   * @returns {{handled:boolean, commit:string}}
   */
  handleKey(ev) {
    const { key } = ev
    if (ev.ctrl || ev.meta || ev.alt) {
      return { handled: false, commit: this.isComposing() ? this.flush() : '' }
    }
    if (this.conv) return this.handleConvertKey(ev)

    const printable = key.length === 1
    if (!this.isComposing()) {
      if (printable && key !== ' ') {
        this.input(key)
        return { handled: true, commit: '' }
      }
      return { handled: false, commit: '' }
    }

    if (printable) {
      if (key === ' ') {
        if (ev.shift) {
          // Shift+Space: 조합 확정 후 공백
          return { handled: true, commit: this.flush() + ' ' }
        }
        this.startConvert()
      } else {
        this.input(key)
      }
      return { handled: true, commit: '' }
    }

    switch (key) {
      case 'Backspace':
        this.backspace()
        return { handled: true, commit: '' }
      case 'Enter':
        return { handled: true, commit: this.flush() }
      case 'Escape':
        this.reset()
        return { handled: true, commit: '' }
      case 'ArrowDown':
      case 'Tab':
        this.startConvert()
        return { handled: true, commit: '' }
      case 'F6':
      case 'F7':
      case 'F8':
      case 'F9':
      case 'F10': {
        const raw = this.raw()
        this.finishPending()
        const reading = this.reading()
        this.conv = { segments: [makeSegment(reading, [], raw)], focus: 0, listOpen: false }
        this.transliterate(key)
        return { handled: true, commit: '' }
      }
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'Delete':
        return { handled: true, commit: '' }
      case 'Shift':
      case 'Control':
      case 'Alt':
      case 'Meta':
      case 'CapsLock':
        return { handled: false, commit: '' }
      default:
        return { handled: false, commit: this.flush() }
    }
  }

  input(ch) {
    if (/^[A-Z]$/.test(ch)) {
      // 대문자는 로마자 그대로 입력
      this.finishPending()
      this.units.push({ kana: ch, raw: ch })
      return
    }
    const rawBuf = this.pending + ch
    const { out, pending } = feedRomaji(this.pending, ch)
    if (out) this.units.push({ kana: out, raw: rawBuf.slice(0, rawBuf.length - pending.length) })
    this.pending = pending
  }

  finishPending() {
    if (!this.pending) return
    this.units.push({ kana: flushRomaji(this.pending), raw: this.pending })
    this.pending = ''
  }

  backspace() {
    if (this.pending) {
      this.pending = this.pending.slice(0, -1)
      return
    }
    const last = this.units[this.units.length - 1]
    if (!last) return
    const chars = [...last.kana]
    chars.pop()
    if (!chars.length) this.units.pop()
    else {
      last.kana = chars.join('')
      last.raw = kanaToRomaji(last.kana)
    }
  }

  startConvert() {
    this.finishPending()
    const reading = this.reading()
    if (!reading) return
    this.conv = { segments: segmentReading(reading), focus: 0, listOpen: false }
  }

  handleConvertKey(ev) {
    const { key } = ev
    const conv = this.conv
    const seg = conv.segments[conv.focus]

    if (key === ' ' || key === 'ArrowDown' || key === 'Tab') {
      if (ev.shift && key !== 'ArrowDown') this.moveCandidate(-1)
      else this.moveCandidate(1)
      return { handled: true, commit: '' }
    }
    if (key === 'ArrowUp') {
      this.moveCandidate(-1)
      return { handled: true, commit: '' }
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const dir = key === 'ArrowLeft' ? -1 : 1
      if (ev.shift) this.resizeSegment(dir)
      else {
        conv.focus = Math.max(0, Math.min(conv.segments.length - 1, conv.focus + dir))
        conv.listOpen = false
      }
      return { handled: true, commit: '' }
    }
    if (key === 'PageDown' || key === 'PageUp') {
      conv.listOpen = true
      const n = seg.cands.length
      const delta = key === 'PageDown' ? PAGE_SIZE : -PAGE_SIZE
      const page = Math.floor(seg.index / PAGE_SIZE) * PAGE_SIZE + delta
      if (page >= 0 && page < n) seg.index = page
      return { handled: true, commit: '' }
    }
    if (conv.listOpen && /^[1-9]$/.test(key)) {
      const i = Math.floor(seg.index / PAGE_SIZE) * PAGE_SIZE + Number(key) - 1
      if (i < seg.cands.length) {
        seg.index = i
        seg.learnable = true
        conv.listOpen = false
        if (conv.focus < conv.segments.length - 1) conv.focus++
        else return { handled: true, commit: this.flush() }
      }
      return { handled: true, commit: '' }
    }
    switch (key) {
      case 'Enter':
        return { handled: true, commit: this.flush() }
      case 'Escape':
      case 'Backspace':
        // 변환 취소 → 읽기(히라가나) 편집 상태로
        this.conv = null
        return { handled: true, commit: '' }
      case 'F6':
      case 'F7':
      case 'F8':
      case 'F9':
      case 'F10':
        this.transliterate(key)
        return { handled: true, commit: '' }
      case 'Shift':
      case 'Control':
      case 'Alt':
      case 'Meta':
      case 'CapsLock':
      case 'Delete':
        return { handled: true, commit: '' }
    }
    if (key.length === 1) {
      // 변환 중에 새 글자 입력 → 확정 후 새 조합 시작
      const commit = this.flush()
      this.input(key)
      return { handled: true, commit }
    }
    return { handled: false, commit: this.flush() }
  }

  moveCandidate(delta) {
    const conv = this.conv
    const seg = conv.segments[conv.focus]
    if (!conv.listOpen && delta > 0 && !seg.touched) {
      // 첫 번째 Space 는 변환, 두 번째부터 후보 목록
      seg.touched = true
      conv.listOpen = seg.cands.length > 1
      if (seg.cands.length > 1) seg.index = (seg.index + 1) % seg.cands.length
      return
    }
    seg.touched = true
    conv.listOpen = seg.cands.length > 1
    const n = seg.cands.length
    seg.index = (seg.index + delta + n) % n
    seg.learnable = true
  }

  resizeSegment(dir) {
    const conv = this.conv
    const segs = conv.segments
    const f = conv.focus
    const seg = segs[f]
    const rest = segs.slice(f + 1).map((s) => s.reading).join('')
    const total = seg.reading + rest
    const len = [...seg.reading].length + dir
    const chars = [...total]
    if (len < 1 || len > chars.length) return
    const head = chars.slice(0, len).join('')
    const tail = chars.slice(len).join('')
    const newSegs = [makeSegment(head)]
    if (tail) newSegs.push(...segmentReading(tail))
    conv.segments = [...segs.slice(0, f), ...newSegs]
    conv.listOpen = false
  }

  transliterate(fkey) {
    const seg = this.conv.segments[this.conv.focus]
    const raw = seg.raw ?? kanaToRomaji(seg.reading)
    const forms = {
      F6: seg.reading,
      F7: hiraToKata(seg.reading),
      F8: toHalfKata(seg.reading),
      F9: toFullAscii(raw),
      F10: raw,
    }
    const word = forms[fkey]
    let i = seg.cands.indexOf(word)
    if (i < 0) {
      seg.cands.push(word)
      i = seg.cands.length - 1
    }
    seg.index = i
    seg.touched = true
    this.conv.listOpen = false
  }

  /** 렌더링용 상태 */
  getView() {
    if (this.conv) {
      const { segments, focus, listOpen } = this.conv
      const seg = segments[focus]
      const pageStart = Math.floor(seg.index / PAGE_SIZE) * PAGE_SIZE
      return {
        segments: segments.map((s, i) => ({ text: s.cands[s.index], focused: i === focus, converted: true })),
        candidates: listOpen
          ? {
              items: seg.cands.slice(pageStart, pageStart + PAGE_SIZE),
              selected: seg.index - pageStart,
              page: pageStart / PAGE_SIZE + 1,
              pages: Math.ceil(seg.cands.length / PAGE_SIZE),
              total: seg.cands.length,
              focusIndex: focus,
            }
          : null,
      }
    }
    const text = this.units.map((u) => u.kana).join('') + this.pending
    if (!text) return { segments: [], candidates: null }
    return { segments: [{ text, focused: false, converted: false }], candidates: null }
  }
}

function makeSegment(reading, dictCands = dictionary.candidates(reading), raw) {
  const cands = [...dictCands]
  for (const form of [reading, hiraToKata(reading)]) if (!cands.includes(form)) cands.push(form)
  return { reading, cands, index: 0, raw, touched: false, learnable: false }
}

/**
 * 동적 계획법으로 문절 분할. 사전 단어 = 비용 1 (오쿠리 1.2, 한 글자 1.5),
 * 사전에 없는 글자 = 글자당 1 (조사 0.5). 연속된 미등록 글자는 하나의 문절로 합친다.
 */
export function segmentReading(reading) {
  const chars = [...reading]
  const n = chars.length
  if (n === 0) return []
  const best = new Array(n + 1).fill(Infinity)
  const back = new Array(n + 1)
  best[0] = 0
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue
    // 미등록 1글자 (조사는 더 싸게)
    const single = PARTICLES.has(chars[i]) && n > 1 ? 0.5 : 1
    if (best[i] + single < best[i + 1]) {
      best[i + 1] = best[i] + single
      back[i + 1] = { from: i, word: false }
    }
    for (let L = 1; L <= MAX_WORD && i + L <= n; L++) {
      const s = chars.slice(i, i + L).join('')
      let cost = Infinity
      if (dictionary.hasPlain(s)) cost = L === 1 ? (n === 1 ? 0.5 : 1.5) : 1
      else if (dictionary.hasOkuri(s)) cost = 1.2
      if (cost === Infinity) continue
      if (best[i] + cost < best[i + L] - 1e-9) {
        best[i + L] = best[i] + cost
        back[i + L] = { from: i, word: true }
      }
    }
  }
  const parts = []
  for (let j = n; j > 0; ) {
    const b = back[j]
    parts.unshift({ text: chars.slice(b.from, j).join(''), word: b.word })
    j = b.from
  }
  // 미등록 글자 묶기
  const merged = []
  for (const p of parts) {
    const last = merged[merged.length - 1]
    if (!p.word && last && !last.word) last.text += p.text
    else merged.push({ ...p })
  }
  return merged.map((p) => {
    if (p.word) return makeSegment(p.text)
    // 미등록 문절은 히라가나가 첫 후보, 사전 후보는 뒤에 붙인다
    const seg = makeSegment(p.text, [])
    for (const c of dictionary.candidates(p.text)) if (!seg.cands.includes(c)) seg.cands.push(c)
    return seg
  })
}
