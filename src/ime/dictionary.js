// SKK 형식 사전 파서 + 조회 + 학습 + 외부 사전(IndexedDB) 저장
import { BUILTIN_DICT } from './builtinDict.js'
import { okuriConsonant } from './kana.js'

const LEARN_KEY = 'jpmemo:ime-learn'
const DB_NAME = 'jpmemo-ime'
const STORE = 'dict'

/** SKK 사전 텍스트를 Map<key, string[]> 로 파싱 */
export function parseSKK(text, into = new Map()) {
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(';')) continue
    const sp = line.indexOf(' /')
    if (sp < 0) continue
    const key = line.slice(0, sp)
    const body = line.slice(sp + 2).replace(/\[[^\]]*\]\//g, '')
    const cands = []
    for (const raw of body.split('/')) {
      if (!raw) continue
      const word = raw.split(';')[0]
      if (!word || word.startsWith('(')) continue // lisp 표현식은 건너뜀
      cands.push(word)
    }
    if (!cands.length) continue
    const prev = into.get(key)
    if (prev) {
      for (const c of cands) if (!prev.includes(c)) prev.push(c)
    } else into.set(key, cands)
  }
  return into
}

class Dictionary {
  constructor() {
    this.builtin = parseSKK(BUILTIN_DICT)
    this.external = new Map()
    this.externalName = null
    this.learned = loadLearned()
  }

  get externalSize() {
    return this.external.size
  }

  /** 오쿠리 없는 단어 후보 */
  lookupPlain(reading) {
    return merge(this.builtin.get(reading), this.external.get(reading))
  }

  /** 오쿠리 있는 후보: reading = 어간 + 오쿠리가나 1글자 → 한자 + 오쿠리가나 */
  lookupOkuri(reading) {
    if (reading.length < 2) return []
    const stem = reading.slice(0, -1)
    const okuri = reading.slice(-1)
    const c = okuriConsonant(okuri)
    if (!c) return []
    const key = stem + c
    return merge(this.builtin.get(key), this.external.get(key)).map((k) => k + okuri)
  }

  hasPlain(reading) {
    return this.builtin.has(reading) || this.external.has(reading)
  }

  hasOkuri(reading) {
    if (reading.length < 2) return false
    const c = okuriConsonant(reading.slice(-1))
    if (!c) return false
    const key = reading.slice(0, -1) + c
    return this.builtin.has(key) || this.external.has(key)
  }

  /** 한 문절(reading)의 모든 후보. 학습된 후보가 가장 앞에 온다. */
  candidates(reading) {
    const list = merge(this.lookupPlain(reading), this.lookupOkuri(reading))
    const learned = this.learned[reading]
    if (learned) {
      const i = list.indexOf(learned)
      if (i > 0) {
        list.splice(i, 1)
        list.unshift(learned)
      }
    }
    return list
  }

  learn(reading, word) {
    if (!reading || !word || reading === word) return
    this.learned[reading] = word
    try {
      localStorage.setItem(LEARN_KEY, JSON.stringify(this.learned))
    } catch {
      /* 저장 공간 부족 등은 무시 */
    }
  }

  clearLearned() {
    this.learned = {}
    localStorage.removeItem(LEARN_KEY)
  }

  async loadExternalFromDB() {
    try {
      const rec = await dbGet('external')
      if (rec?.text) {
        this.external = parseSKK(rec.text)
        this.externalName = rec.name
      }
    } catch (e) {
      console.warn('[IME] 외부 사전 로드 실패', e)
    }
  }

  /** ArrayBuffer(EUC-JP 또는 UTF-8) 를 받아 외부 사전으로 저장 */
  async setExternal(buffer, name) {
    const text = decodeDict(buffer)
    const map = parseSKK(text)
    if (!map.size) throw new Error('SKK 사전 형식이 아닙니다.')
    this.external = map
    this.externalName = name
    await dbPut('external', { text, name })
    return map.size
  }

  async clearExternal() {
    this.external = new Map()
    this.externalName = null
    await dbPut('external', null)
  }
}

function merge(...lists) {
  const out = []
  for (const l of lists) if (l) for (const w of l) if (!out.includes(w)) out.push(w)
  return out
}

function loadLearned() {
  try {
    return JSON.parse(localStorage.getItem(LEARN_KEY)) || {}
  } catch {
    return {}
  }
}

function decodeDict(buffer) {
  const bytes = new Uint8Array(buffer)
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 200))
  if (/coding:\s*utf-8/i.test(head)) return new TextDecoder('utf-8').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('euc-jp').decode(bytes)
  }
}

// ---------- IndexedDB 헬퍼 ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const dictionary = new Dictionary()
