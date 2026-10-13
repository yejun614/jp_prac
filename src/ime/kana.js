// 로마자 → 히라가나 변환 테이블과 가나 유틸리티 (의존성 없음)

const VOWELS = ['a', 'i', 'u', 'e', 'o']

// 자음 + 모음 기본 행
const ROWS = {
  '': 'あいうえお',
  k: 'かきくけこ',
  s: 'さしすせそ',
  t: 'たちつてと',
  n: 'なにぬねの',
  h: 'はひふへほ',
  m: 'まみむめも',
  y: ['や', 'い', 'ゆ', 'いぇ', 'よ'],
  r: 'らりるれろ',
  w: ['わ', 'うぃ', 'う', 'うぇ', 'を'],
  g: 'がぎぐげご',
  z: 'ざじずぜぞ',
  d: 'だぢづでど',
  b: 'ばびぶべぼ',
  p: 'ぱぴぷぺぽ',
  c: ['か', 'し', 'く', 'せ', 'こ'],
  f: ['ふぁ', 'ふぃ', 'ふ', 'ふぇ', 'ふぉ'],
  j: ['じゃ', 'じ', 'じゅ', 'じぇ', 'じょ'],
  v: ['ゔぁ', 'ゔぃ', 'ゔ', 'ゔぇ', 'ゔぉ'],
  q: ['くぁ', 'くぃ', 'く', 'くぇ', 'くぉ'],
  l: 'ぁぃぅぇぉ',
  x: 'ぁぃぅぇぉ',
  // 확장 행
  ky: ['きゃ', 'きぃ', 'きゅ', 'きぇ', 'きょ'],
  sy: ['しゃ', 'しぃ', 'しゅ', 'しぇ', 'しょ'],
  sh: ['しゃ', 'し', 'しゅ', 'しぇ', 'しょ'],
  ty: ['ちゃ', 'ちぃ', 'ちゅ', 'ちぇ', 'ちょ'],
  ch: ['ちゃ', 'ち', 'ちゅ', 'ちぇ', 'ちょ'],
  cy: ['ちゃ', 'ちぃ', 'ちゅ', 'ちぇ', 'ちょ'],
  ts: ['つぁ', 'つぃ', 'つ', 'つぇ', 'つぉ'],
  th: ['てゃ', 'てぃ', 'てゅ', 'てぇ', 'てょ'],
  tw: ['とぁ', 'とぃ', 'とぅ', 'とぇ', 'とぉ'],
  ny: ['にゃ', 'にぃ', 'にゅ', 'にぇ', 'にょ'],
  hy: ['ひゃ', 'ひぃ', 'ひゅ', 'ひぇ', 'ひょ'],
  fy: ['ふゃ', 'ふぃ', 'ふゅ', 'ふぇ', 'ふょ'],
  my: ['みゃ', 'みぃ', 'みゅ', 'みぇ', 'みょ'],
  ry: ['りゃ', 'りぃ', 'りゅ', 'りぇ', 'りょ'],
  gy: ['ぎゃ', 'ぎぃ', 'ぎゅ', 'ぎぇ', 'ぎょ'],
  gw: ['ぐぁ', 'ぐぃ', 'ぐぅ', 'ぐぇ', 'ぐぉ'],
  kw: ['くぁ', 'くぃ', 'くぅ', 'くぇ', 'くぉ'],
  zy: ['じゃ', 'じぃ', 'じゅ', 'じぇ', 'じょ'],
  jy: ['じゃ', 'じぃ', 'じゅ', 'じぇ', 'じょ'],
  dy: ['ぢゃ', 'ぢぃ', 'ぢゅ', 'ぢぇ', 'ぢょ'],
  dh: ['でゃ', 'でぃ', 'でゅ', 'でぇ', 'でょ'],
  dw: ['どぁ', 'どぃ', 'どぅ', 'どぇ', 'どぉ'],
  by: ['びゃ', 'びぃ', 'びゅ', 'びぇ', 'びょ'],
  py: ['ぴゃ', 'ぴぃ', 'ぴゅ', 'ぴぇ', 'ぴょ'],
  vy: ['ゔゃ', 'ゔぃ', 'ゔゅ', 'ゔぇ', 'ゔょ'],
  wh: ['うぁ', 'うぃ', 'う', 'うぇ', 'うぉ'],
  xy: ['ゃ', 'ぃ', 'ゅ', 'ぇ', 'ょ'],
  ly: ['ゃ', 'ぃ', 'ゅ', 'ぇ', 'ょ'],
}

export const ROMAJI_TABLE = {}
for (const [cons, kanas] of Object.entries(ROWS)) {
  const list = typeof kanas === 'string' ? [...kanas] : kanas
  VOWELS.forEach((v, i) => {
    ROMAJI_TABLE[cons + v] = list[i]
  })
}

Object.assign(ROMAJI_TABLE, {
  nn: 'ん',
  "n'": 'ん',
  xn: 'ん',
  xtu: 'っ',
  ltu: 'っ',
  xtsu: 'っ',
  ltsu: 'っ',
  xwa: 'ゎ',
  lwa: 'ゎ',
  xka: 'ゕ',
  lka: 'ゕ',
  xke: 'ゖ',
  lke: 'ゖ',
  wyi: 'ゐ',
  wye: 'ゑ',
  tsu: 'つ',
  shi: 'し',
  chi: 'ち',
  fu: 'ふ',
  ji: 'じ',
  // 기호
  '-': 'ー',
  ',': '、',
  '.': '。',
  '[': '「',
  ']': '」',
  '/': '・',
  '?': '？',
  '!': '！',
  '~': '〜',
  ':': '：',
  ';': '；',
  '(': '（',
  ')': '）',
  '{': '｛',
  '}': '｝',
  '"': '”',
  // z 조합 기호 (MS-IME/Google IME 호환)
  zh: '←',
  zj: '↓',
  zk: '↑',
  zl: '→',
  'z.': '…',
  'z,': '‥',
  'z-': '〜',
  'z/': '・',
  'z[': '『',
  'z]': '』',
})

// 접두사 집합: 더 긴 입력을 기다려야 하는지 판정
const PREFIXES = new Set()
for (const key of Object.keys(ROMAJI_TABLE)) {
  for (let i = 1; i < key.length; i++) PREFIXES.add(key.slice(0, i))
}

const CONSONANT = /^[bcdfghjklmpqrstvwxyz]$/

/**
 * 대기 중인 로마자 버퍼에 한 글자를 더해 변환한다.
 * @returns {{ out: string, pending: string }} out: 확정된 가나, pending: 남은 로마자
 */
export function feedRomaji(pending, ch) {
  let buf = pending + ch
  let out = ''
  while (buf) {
    // 더 긴 조합이 가능 → 다음 입력을 기다린다
    if (PREFIXES.has(buf)) break
    if (buf in ROMAJI_TABLE) {
      out += ROMAJI_TABLE[buf]
      buf = ''
      break
    }
    const a = buf[0]
    const b = buf[1]
    if (b !== undefined) {
      // 촉음: 같은 자음 반복 (kk → っk)
      if (a === b && CONSONANT.test(a) && a !== 'n') {
        out += 'っ'
        buf = buf.slice(1)
        continue
      }
      // n + 자음 → ん
      if (a === 'n' && !/[aiueony']/.test(b)) {
        out += 'ん'
        buf = buf.slice(1)
        continue
      }
    }
    // 변환 불가 → 첫 글자를 그대로 출력
    out += a
    buf = buf.slice(1)
  }
  return { out, pending: buf }
}

/** 남은 로마자를 강제로 확정 (n → ん) */
export function flushRomaji(pending) {
  if (!pending) return ''
  if (pending === 'n') return 'ん'
  let out = ''
  let buf = pending
  while (buf) {
    if (buf in ROMAJI_TABLE) return out + ROMAJI_TABLE[buf]
    if (buf[0] === 'n' && buf.length > 1 && !/[aiueoy]/.test(buf[1])) {
      out += 'ん'
      buf = buf.slice(1)
      continue
    }
    out += buf[0]
    buf = buf.slice(1)
  }
  return out
}

// ---------- 가나 변환 유틸 ----------

export function hiraToKata(s) {
  return s.replace(/[ぁ-ゖゝゞ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

export function kataToHira(s) {
  return s.replace(/[ァ-ヶヽヾ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const HALF_KATA =
  'ｧｱｨｲｩｳｪｴｫｵｶｶﾞｷｷﾞｸｸﾞｹｹﾞｺｺﾞｻｻﾞｼｼﾞｽｽﾞｾｾﾞｿｿﾞﾀﾀﾞﾁﾁﾞｯﾂﾂﾞﾃﾃﾞﾄﾄﾞﾅﾆﾇﾈﾉﾊﾊﾞﾊﾟﾋﾋﾞﾋﾟﾌﾌﾞﾌﾟﾍﾍﾞﾍﾟﾎﾎﾞﾎﾟﾏﾐﾑﾒﾓｬﾔｭﾕｮﾖﾗﾘﾙﾚﾛﾜﾜｲｴｦﾝｳﾞｶｹ'
const FULL_KATA = 'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ'
const HALF_MAP = (() => {
  const map = {}
  let j = 0
  for (const full of FULL_KATA) {
    let half = HALF_KATA[j++]
    if (HALF_KATA[j] === 'ﾞ' || HALF_KATA[j] === 'ﾟ') half += HALF_KATA[j++]
    map[full] = half
  }
  Object.assign(map, { 'ー': 'ｰ', '。': '｡', '、': '､', '「': '｢', '」': '｣', '・': '･', '゛': 'ﾞ', '゜': 'ﾟ' })
  return map
})()

export function toHalfKata(s) {
  return [...hiraToKata(s)].map((c) => HALF_MAP[c] ?? toHalfAscii(c)).join('')
}

export function toFullAscii(s) {
  return s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, '　')
}

export function toHalfAscii(s) {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ')
}

// 히라가나 → 로마자 (F9/F10 변환과 백스페이스 복원용)
const KANA_TO_ROMAJI = (() => {
  const map = {}
  const preferred = { し: 'shi', ち: 'chi', つ: 'tsu', ふ: 'fu', じ: 'ji', ん: 'nn', を: 'wo', 'ー': '-' }
  for (const [romaji, kana] of Object.entries(ROMAJI_TABLE)) {
    if (/^[lxcqwz]/.test(romaji) && romaji.length > 1 && map[kana]) continue
    if (!map[kana] || romaji.length < map[kana].length) map[kana] = romaji
  }
  return Object.assign(map, preferred)
})()

export function kanaToRomaji(s) {
  let out = ''
  const str = kataToHira(s)
  for (let i = 0; i < str.length; i++) {
    const two = str.slice(i, i + 2)
    if (two.length === 2 && KANA_TO_ROMAJI[two]) {
      out += KANA_TO_ROMAJI[two]
      i++
      continue
    }
    const c = str[i]
    if (c === 'っ' && i + 1 < str.length) {
      const next = KANA_TO_ROMAJI[str.slice(i + 1, i + 3)] || KANA_TO_ROMAJI[str[i + 1]] || ''
      if (/^[a-z]/.test(next) && !/^[aiueon]/.test(next)) {
        out += next[0]
        continue
      }
    }
    if (c === 'ん') {
      const next = KANA_TO_ROMAJI[str[i + 1]] || ''
      out += /^[aiueoyn]/.test(next) ? 'nn' : 'n'
      continue
    }
    out += KANA_TO_ROMAJI[c] ?? c
  }
  return out
}

// 오쿠리가나의 첫 자음 (SKK okuri-ari 키 생성용)
export function okuriConsonant(kana) {
  if (kana === 'ん') return 'n'
  if (kana === 'っ') return 't'
  const r = KANA_TO_ROMAJI[kataToHira(kana)]
  if (!r) return null
  if (/^(shi|sh)/.test(r)) return 's'
  if (/^ch/.test(r)) return 't'
  if (/^ts/.test(r)) return 't'
  if (/^fu/.test(r)) return 'h'
  if (/^j/.test(r)) return 'z'
  return r[0]
}

export function isHiragana(s) {
  return /^[ぁ-ゖー]+$/.test(s)
}
