// 한자 문장(text)과 읽기(kana)를 맞춰 한자 부분마다 후리가나를 붙인다.
// 예: ('お腹がすきました。', 'おなかがすきました。') → [お][腹(なか)][がすきました。]
import { kataToHira } from '../ime/kana.js'

const KANJI = /[㐀-鿿々〆ヵヶ]/

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @returns {{ base: string, ruby?: string }[] | null} 맞출 수 없으면 null
 */
export function furigana(text, kana) {
  // 한자 덩어리 / 나머지 덩어리로 나눈다
  const parts = []
  for (const ch of text) {
    const isKanji = KANJI.test(ch)
    const last = parts[parts.length - 1]
    if (last && last.kanji === isKanji) last.base += ch
    else parts.push({ base: ch, kanji: isKanji })
  }
  if (!parts.some((p) => p.kanji)) return parts.map(({ base }) => ({ base }))

  // 한자가 아닌 부분은 그대로 일치해야 하고, 한자 덩어리는 사이의 읽기를 차지한다
  // (가타카나/히라가나 차이는 무시)
  const pattern = parts.map((p) => (p.kanji ? '(.+?)' : escapeRe(kataToHira(p.base)))).join('')
  const m = new RegExp(`^${pattern}$`, 'u').exec(kataToHira(kana))
  if (!m) return null
  let g = 1
  return parts.map((p) => (p.kanji ? { base: p.base, ruby: m[g++] } : { base: p.base }))
}
