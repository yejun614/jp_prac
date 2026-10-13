// 한국어 두벌식 IME 엔진 (오토마타)

const KEYMAP = {
  q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
  Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ',
}

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ']

const VOWEL_COMBO = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' }
const JONG_COMBO = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
}
const JONG_SPLIT = Object.fromEntries(Object.entries(JONG_COMBO).map(([k, v]) => [v, [...k]]))

const isVowel = (j) => JUNG.includes(j)
const canBeJong = (j) => JONG.includes(j)

export function composeSyllable({ cho, jung, jong }) {
  if (cho && jung) {
    return String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong || ''))
  }
  return (cho || '') + (jung || '') + (jong || '')
}

export class KoreanIME {
  constructor() {
    this.reset()
  }

  reset() {
    this.state = { cho: '', jung: '', jong: '' }
    this.history = [] // 백스페이스로 되돌릴 이전 상태들
  }

  isComposing() {
    const { cho, jung, jong } = this.state
    return Boolean(cho || jung || jong)
  }

  current() {
    return composeSyllable(this.state)
  }

  flush() {
    const text = this.current()
    this.reset()
    return text
  }

  handleKey(ev) {
    const { key } = ev
    if (ev.ctrl || ev.meta || ev.alt) {
      return { handled: false, commit: this.flush() }
    }
    const jamo = KEYMAP[key] ?? KEYMAP[key.toLowerCase?.()]
    if (key.length === 1 && jamo) {
      const commit = this.input(jamo)
      return { handled: true, commit }
    }
    if (key === 'Backspace' && this.isComposing()) {
      this.state = this.history.pop() ?? { cho: '', jung: '', jong: '' }
      return { handled: true, commit: '' }
    }
    if (key === 'Escape' && this.isComposing()) {
      return { handled: true, commit: this.flush() }
    }
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key)) {
      return { handled: false, commit: '' }
    }
    // 그 외 키(공백, 기호, 숫자, 방향키 등): 조합 확정 후 기본 동작
    return { handled: false, commit: this.flush() }
  }

  /** 자모 하나 입력. 확정된 글자가 있으면 반환 */
  input(j) {
    const s = this.state
    const push = (next) => {
      this.history.push({ ...this.state })
      this.state = next
    }
    const startNew = (next) => {
      const commit = this.current()
      this.history = []
      this.state = { cho: '', jung: '', jong: '' }
      push(next)
      return commit
    }

    if (isVowel(j)) {
      if (s.jong) {
        // 종성을 다음 글자의 초성으로 넘긴다 (닭+ㅏ → 달가)
        const split = JONG_SPLIT[s.jong]
        const [keep, move] = split ?? ['', s.jong]
        const commit = composeSyllable({ ...s, jong: keep })
        this.history = []
        this.state = { cho: '', jung: '', jong: '' }
        push({ cho: move, jung: '', jong: '' })
        push({ cho: move, jung: j, jong: '' })
        return commit
      }
      if (s.jung) {
        const combo = VOWEL_COMBO[s.jung + j]
        if (combo && !this.lastWasComboVowel()) {
          push({ ...s, jung: combo })
          return ''
        }
        return startNew({ cho: '', jung: j, jong: '' })
      }
      if (s.cho) {
        push({ ...s, jung: j })
        return ''
      }
      push({ cho: '', jung: j, jong: '' })
      return ''
    }

    // 자음
    if (s.cho && s.jung) {
      if (!s.jong) {
        if (canBeJong(j)) {
          push({ ...s, jong: j })
          return ''
        }
        return startNew({ cho: j, jung: '', jong: '' })
      }
      const combo = JONG_COMBO[s.jong + j]
      if (combo) {
        push({ ...s, jong: combo })
        return ''
      }
      return startNew({ cho: j, jung: '', jong: '' })
    }
    if (!this.isComposing()) {
      push({ cho: j, jung: '', jong: '' })
      return ''
    }
    return startNew({ cho: j, jung: '', jong: '' })
  }

  lastWasComboVowel() {
    return Object.values(VOWEL_COMBO).includes(this.state.jung)
  }

  getView() {
    const text = this.current()
    return { segments: text ? [{ text, focused: false, converted: false }] : [], candidates: null }
  }
}
