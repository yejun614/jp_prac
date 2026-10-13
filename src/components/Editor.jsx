import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ImeController } from '../ime/controller.js'
import { sanitizeHtml } from '../lib/sanitize.js'
import { registry } from '../lib/registry.js'
import CandidateWindow from './CandidateWindow.jsx'

/** 서식 있는 텍스트 에디터 (contentEditable) + 자체 IME */
export default function Editor({ doc, mode, active, onChange, onFocus, onStats }) {
  const ref = useRef(null)
  const ctrlRef = useRef(null)
  const lastHtml = useRef(null)
  const lastRange = useRef(null)
  const modeRef = useRef(mode)
  const docIdRef = useRef(doc.id)
  const onChangeRef = useRef(onChange)
  const onStatsRef = useRef(onStats)
  const [imeView, setImeView] = useState(null)
  const [empty, setEmpty] = useState(false)

  const vertical = doc.writingMode === 'vertical'
  modeRef.current = mode
  onChangeRef.current = onChange
  onStatsRef.current = onStats

  const serialize = () => {
    const el = ref.current
    if (!el.querySelector('.ime-preedit')) return el.innerHTML
    const clone = el.cloneNode(true)
    clone.querySelectorAll('.ime-preedit').forEach((n) => n.remove())
    return clone.innerHTML
  }

  // 조합 중인 글자(preedit)도 textContent 에 포함되므로, 입력을 시작하면 바로 placeholder 가 사라진다
  const updateEmpty = () => {
    const el = ref.current
    if (!el) return // 언마운트 중
    setEmpty(!el.textContent && !el.querySelector('li, hr'))
    onStatsRef.current?.(el.innerText)
  }

  const emit = () => {
    const html = serialize()
    lastHtml.current = html
    onChangeRef.current(docIdRef.current, html)
    updateEmpty()
  }

  // IME 컨트롤러 생성
  useEffect(() => {
    const ctrl = new ImeController(ref.current, {
      getMode: () => modeRef.current,
      onView: (v) => {
        setImeView(v)
        updateEmpty()
      },
      onCommitDom: () => emit(),
    })
    ctrlRef.current = ctrl
    return () => ctrl.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 문서 전환 / 다른 창에서의 변경 반영
  useLayoutEffect(() => {
    const el = ref.current
    if (docIdRef.current !== doc.id) {
      ctrlRef.current?.cancel()
      docIdRef.current = doc.id
      lastHtml.current = null
    }
    if (doc.html !== lastHtml.current) {
      if (ctrlRef.current?.isComposing()) ctrlRef.current.cancel()
      el.innerHTML = doc.html
      lastHtml.current = doc.html
      updateEmpty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.html])

  // 활성 창에서 문서가 열리면 바로 입력할 수 있게 포커스
  useEffect(() => {
    const el = ref.current
    const ae = document.activeElement
    if (!active || el === ae || ae?.matches?.('input, textarea')) return
    el.focus()
    const r = document.createRange()
    r.selectNodeContents(el)
    r.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, active])

  // 입력 모드가 바뀌면 조합 중인 글자 확정
  useEffect(() => {
    const ctrl = ctrlRef.current
    if (ctrl?.isComposing()) {
      ctrl.flush()
      emit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // 선택 영역 기억 (색상 선택기 등 포커스를 빼앗는 UI 용)
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      if (sel.rangeCount && ref.current?.contains(sel.anchorNode)) lastRange.current = sel.getRangeAt(0).cloneRange()
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const api = {
    el: () => ref.current,
    flush: () => {
      if (ctrlRef.current?.isComposing()) {
        ctrlRef.current.flush()
        emit()
      }
    },
    focus: () => {
      const el = ref.current
      if (document.activeElement !== el) {
        el.focus()
        const r = lastRange.current
        if (r && el.contains(r.startContainer)) {
          const sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(r)
        }
      }
    },
    exec: (cmd, value = null) => {
      api.focus()
      api.flush()
      document.execCommand('styleWithCSS', false, cmd === 'hiliteColor')
      document.execCommand(cmd, false, value)
      emit()
    },
    docId: () => docIdRef.current,
  }

  const handleFocus = () => {
    registry.active = api
    onFocus?.()
  }

  const handleKeyDown = (e) => {
    const ctrl = ctrlRef.current
    // 서식 단축키
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        return
      }
      if (e.shiftKey && k === 'x') {
        e.preventDefault()
        api.exec('strikeThrough')
        return
      }
    }
    if (ctrl.handleKeyDown(e)) return
    if (e.key === 'Tab' && !e.isComposing) {
      e.preventDefault()
      const inList = window.getSelection().anchorNode?.parentElement?.closest('li')
      if (inList) document.execCommand(e.shiftKey ? 'outdent' : 'indent')
      else if (!e.shiftKey) document.execCommand('insertText', false, '\t')
    }
  }

  const handlePaste = (e) => {
    ctrlRef.current.flush()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    e.preventDefault()
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html))
    else document.execCommand('insertText', false, text)
  }

  const handleBlur = () => {
    const ctrl = ctrlRef.current
    if (ctrl.isComposing()) ctrl.flush(true)
  }

  return (
    <div className={'editor-wrap' + (vertical ? ' vertical' : '')}>
      {/* placeholder 는 에디터의 ::before 가 아닌 별도 오버레이로 그린다.
          ::before 로 그리면 빈 상태의 캐럿이 placeholder 줄에 맞춰져 입력 시작 순간 위치/높이가 튄다 */}
      {empty && (
        <div className={'editor-placeholder' + (vertical ? ' vertical' : '')} aria-hidden="true">
          여기에 메모를 입력하세요…
        </div>
      )}
      <div
        ref={ref}
        className={'editor' + (empty ? ' is-empty' : '') + (vertical ? ' vertical' : '')}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onInput={emit}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={() => ctrlRef.current.isComposing() && ctrlRef.current.flush()}
        onPaste={handlePaste}
        onCut={() => ctrlRef.current.flush()}
        onDrop={() => ctrlRef.current.flush()}
      />
      {imeView?.candidates && (
        <CandidateWindow view={imeView} onPick={(i) => ctrlRef.current.pickCandidate(i)} />
      )}
    </div>
  )
}
