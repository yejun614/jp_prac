// IME 엔진을 contentEditable 요소에 연결하는 컨트롤러.
// 조합 중인 문자열은 <span class="ime-preedit"> 로 캐럿 위치에 그려지고,
// 확정 시 execCommand('insertText') 로 삽입되어 실행 취소/서식이 자연스럽게 동작한다.
import { JapaneseIME } from './japanese.js'
import { KoreanIME } from './korean.js'

export class ImeController {
  /**
   * @param {HTMLElement} el
   * @param {{ getMode: () => string, onView: (v: object|null) => void, onCommitDom: () => void }} opts
   */
  constructor(el, opts) {
    this.el = el
    this.opts = opts
    this.engines = { ja: new JapaneseIME(), ko: new KoreanIME() }
    this.span = null
  }

  get engine() {
    return this.engines[this.opts.getMode()] ?? null
  }

  isComposing() {
    return Object.values(this.engines).some((e) => e.isComposing())
  }

  /** keydown 처리. 처리했으면 true */
  handleKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return false // OS IME 입력 중
    const engine = this.engine
    if (!engine) return false
    const res = engine.handleKey({
      key: e.key,
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
    })
    if (res.handled) e.preventDefault()
    if (res.commit) this.insertText(res.commit)
    this.render(engine.getView())
    return res.handled
  }

  /** 후보 창에서 마우스로 고른 경우 */
  pickCandidate(indexInPage) {
    const engine = this.engines.ja
    if (!engine.isComposing()) return
    const res = engine.handleKey({ key: String(indexInPage + 1) })
    if (res.commit) this.insertText(res.commit)
    this.render(engine.getView())
  }

  /**
   * 조합 중인 모든 내용을 확정한다.
   * @param {boolean} viaDom 포커스가 없을 때(blur) DOM 조작으로 확정
   */
  flush(viaDom = false) {
    let text = ''
    for (const e of Object.values(this.engines)) if (e.isComposing()) text += e.flush()
    if (text) {
      if (viaDom || document.activeElement !== this.el) this.replaceSpanWithText(text)
      else this.insertText(text)
    }
    this.removeSpan()
    this.opts.onView(null)
    return text
  }

  /** 조합 내용을 버린다 */
  cancel() {
    for (const e of Object.values(this.engines)) e.reset()
    this.removeSpan()
    this.opts.onView(null)
  }

  insertText(text) {
    this.removeSpan()
    document.execCommand('insertText', false, text)
  }

  replaceSpanWithText(text) {
    const span = this.span
    if (span?.isConnected) {
      span.replaceWith(document.createTextNode(text))
      this.span = null
      this.opts.onCommitDom?.()
    }
  }

  ensureSpan() {
    if (this.span?.isConnected && this.el.contains(this.span)) return this.span
    const sel = window.getSelection()
    if (!sel.rangeCount || !this.el.contains(sel.anchorNode)) {
      // 캐럿이 없으면 끝에 둔다
      const r = document.createRange()
      r.selectNodeContents(this.el)
      r.collapse(false)
      sel.removeAllRanges()
      sel.addRange(r)
    }
    if (!sel.isCollapsed) document.execCommand('delete')
    const range = sel.getRangeAt(0)
    const span = document.createElement('span')
    span.className = 'ime-preedit'
    // 빈 줄(<div><br></div>)에서는 <br> 앞에 넣는다
    range.insertNode(span)
    this.span = span
    return span
  }

  removeSpan() {
    const span = this.span
    this.span = null
    if (!span?.isConnected) return
    const parent = span.parentNode
    const prev = span.previousSibling
    const next = span.nextSibling
    span.remove()
    let node
    let offset
    if (prev?.nodeType === Node.TEXT_NODE) {
      node = prev
      offset = prev.length
      // insertNode 로 쪼개졌던 텍스트 노드를 다시 합친다
      if (next?.nodeType === Node.TEXT_NODE) {
        prev.appendData(next.data)
        next.remove()
      }
    } else if (next?.nodeType === Node.TEXT_NODE) {
      node = next
      offset = 0
    } else {
      node = parent
      offset = next ? [...parent.childNodes].indexOf(next) : parent.childNodes.length
    }
    if (document.activeElement === this.el) {
      const sel = window.getSelection()
      const r = document.createRange()
      r.setStart(node, offset)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
    }
  }

  render(view) {
    if (!view || !view.segments.length) {
      this.removeSpan()
      this.opts.onView(null)
      return
    }
    const span = this.ensureSpan()
    span.textContent = ''
    let focusEl = null
    for (const seg of view.segments) {
      const s = document.createElement('span')
      s.className = 'ime-seg' + (seg.converted ? ' converted' : '') + (seg.focused ? ' focused' : '')
      s.textContent = seg.text
      span.appendChild(s)
      if (seg.focused) focusEl = s
    }
    // 캐럿은 조합 문자열 바로 뒤
    const sel = window.getSelection()
    const r = document.createRange()
    r.setStartAfter(span)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)

    const anchor = (focusEl ?? span).getBoundingClientRect()
    const vertical = getComputedStyle(this.el).writingMode.startsWith('vertical')
    this.opts.onView({
      ...view,
      anchor: { left: anchor.left, right: anchor.right, top: anchor.top, bottom: anchor.bottom, vertical },
    })
  }
}
