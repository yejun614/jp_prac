// 타자연습용 로마자 판정기.
// 가나 문자열을 받아, 여러 가지 로마자 표기(shi/si, tsu/tu, n/nn, っ 중복 자음 등)를 모두 허용하며
// 한 글자씩 맞았는지 판정하고, 남은 부분의 추천 로마자(가이드)를 계산한다.
import { ROMAJI_TABLE, kataToHira } from '../ime/kana.js'

// 가나 → 가능한 로마자 목록
const REV = {}
for (const [romaji, kana] of Object.entries(ROMAJI_TABLE)) {
  if (romaji.startsWith('z') && romaji.length === 2 && !/[aiueo]/.test(romaji[1])) continue // z. 등 기호 조합 제외
  ;(REV[kana] ??= []).push(romaji)
}

// 가이드에 우선 표시할 표기 (헵번식 위주)
const PREFERRED = {
  し: 'shi', ち: 'chi', つ: 'tsu', ふ: 'fu', じ: 'ji', を: 'wo', ぢ: 'di', づ: 'du',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', しぇ: 'she', ちぇ: 'che', じぇ: 'je',
  ぁ: 'xa', ぃ: 'xi', ぅ: 'xu', ぇ: 'xe', ぉ: 'xo', ゃ: 'xya', ゅ: 'xyu', ょ: 'xyo',
}
const rank = (kana, r) => {
  if (PREFERRED[kana] === r) return -1
  return (/^[xlcqw]/.test(r) && r.length > 1 ? 10 : 0) + r.length
}
for (const [kana, list] of Object.entries(REV)) list.sort((a, b) => rank(kana, a) - rank(kana, b))

// 가나가 아닌 문자 (전각 기호 → 입력할 키)
const SYMBOLS = {
  '、': ',', '。': '.', '！': '!', '？': '?', '「': '[', '」': ']', '・': '/', '〜': '~', 'ー': '-',
  '：': ':', '；': ';', '（': '(', '）': ')', '　': ' ',
}

const CONSONANT = /^[bcdfghjkmpqrstvwxz]/

function optionsAt(kana, i, depth = 0) {
  if (i >= kana.length) return []
  const out = []
  const push = (r, len) => {
    if (!out.some((o) => o.r === r && o.len === len)) out.push({ r, len })
  }
  const c = kana[i]

  if (c === 'っ' && depth < 3) {
    // 다음 음절의 자음을 겹쳐 쓴다 (tte, kka …)
    for (const n of optionsAt(kana, i + 1, depth + 1)) {
      if (CONSONANT.test(n.r)) push(n.r[0] + n.r, 1 + n.len)
    }
    for (const r of ['xtu', 'ltu', 'xtsu', 'ltsu']) push(r, 1)
    return out
  }

  if (c === 'ん') {
    const next = optionsAt(kana, i + 1, depth + 1)
    // 다음 음절이 모음/や행/な행으로 시작하지 않으면 n 하나로 충분하다 (끝에서는 nn 필요)
    if (next.length && next.every((n) => !/^[aiueoyn']/.test(n.r))) push('n', 1)
    for (const r of ['nn', "n'", 'xn']) push(r, 1)
    return out
  }

  // 요음 등 2글자 단위 (きゃ, てぃ …)
  const two = kana.slice(i, i + 2)
  if (two.length === 2 && REV[two]) {
    for (const r of REV[two]) push(r, 2)
    for (const a of REV[c] ?? []) for (const b of REV[kana[i + 1]] ?? []) push(a + b, 2)
  }
  if (REV[c]) for (const r of REV[c]) push(r, 1)
  else if (SYMBOLS[c]) push(SYMBOLS[c], 1)
  else push(c.toLowerCase(), 1) // 숫자, 영문 등은 그대로
  return out
}

export class RomajiMatcher {
  constructor(kana) {
    this.source = kana
    this.kana = kataToHira(kana) // 길이가 그대로 유지된다
    this.pos = 0 // 확정된 가나 수
    this.typed = '' // 현재 음절에서 입력 중인 로마자
    this.done = this.kana.length === 0
    this.committed = '' // 확정된 로마자
  }

  /** 키 하나 입력. 맞으면 true */
  input(key) {
    if (this.done) return false
    const k = key.length === 1 ? key.toLowerCase() : key
    for (;;) {
      const opts = optionsAt(this.kana, this.pos)
      const next = this.typed + k
      const matching = opts.filter((o) => o.r.startsWith(next))
      if (matching.length) {
        this.typed = next
        const exact = matching.find((o) => o.r === next)
        const longer = matching.some((o) => o.r.length > next.length)
        if (exact && !longer) this.commit(exact)
        return true
      }
      // 지금까지 입력한 것이 이미 완성된 표기라면 확정하고 다음 음절에서 다시 판정 (n + k 등)
      const done = this.typed && opts.find((o) => o.r === this.typed)
      if (!done) return false
      this.commit(done)
      if (this.done) return false
    }
  }

  commit(opt) {
    this.committed += opt.r
    this.pos += opt.len
    this.typed = ''
    if (this.pos >= this.kana.length) this.done = true
  }

  /** 지금까지 입력한 로마자 / 남은 추천 로마자 */
  guide() {
    let rest = ''
    let p = this.pos
    if (p < this.kana.length) {
      const cur = optionsAt(this.kana, p).find((o) => o.r.startsWith(this.typed))
      rest += cur.r.slice(this.typed.length)
      p += cur.len
    }
    while (p < this.kana.length) {
      const o = optionsAt(this.kana, p)[0]
      rest += o.r
      p += o.len
    }
    return { typed: this.committed + this.typed, rest }
  }

  /** 다음에 눌러야 할 키 */
  nextKey() {
    return this.guide().rest[0] ?? ''
  }

  /** 현재 입력 중인 가나 (오타 통계용) */
  currentKana() {
    return this.source[this.pos] ?? ''
  }
}
