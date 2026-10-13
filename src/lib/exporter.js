// 에디터 HTML → Markdown / 일반 텍스트 변환

const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'HR'])

function inlineStyleOf(el, base) {
  const s = { ...base }
  const tag = el.tagName
  if (tag === 'B' || tag === 'STRONG') s.b = true
  if (tag === 'I' || tag === 'EM') s.i = true
  if (tag === 'U' || tag === 'INS') s.u = true
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.s = true
  if (tag === 'CODE') s.code = true
  if (tag === 'FONT' && el.getAttribute('color')) s.color = el.getAttribute('color')
  const st = el.style
  if (st) {
    const fw = st.fontWeight
    if (fw === 'bold' || Number(fw) >= 600) s.b = true
    if (fw === 'normal' || (fw && Number(fw) < 600)) s.b = false
    if (st.fontStyle === 'italic') s.i = true
    const td = `${st.textDecoration} ${st.textDecorationLine}`
    if (td.includes('underline')) s.u = true
    if (td.includes('line-through')) s.s = true
    if (st.color) s.color = st.color
    if (st.backgroundColor && st.backgroundColor !== 'transparent') s.bg = st.backgroundColor
  }
  return s
}

/** DOM 을 줄 단위 블록 목록으로 변환 */
function toLines(root) {
  const lines = []
  let cur = null
  let needNew = true

  const ensureLine = (block) => {
    if (needNew || !cur) {
      cur = { block, runs: [] }
      lines.push(cur)
      needNew = false
    }
    return cur
  }

  const walk = (node, style, block) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.data.replace(/ /g, ' ').replace(/​/g, '').split('\n')
      parts.forEach((text, i) => {
        if (i > 0) needNew = true
        if (text) ensureLine(block).runs.push({ text, style })
      })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node
    if (el.classList?.contains('ime-preedit')) return
    if (el.tagName === 'BR') {
      ensureLine(block)
      needNew = true
      return
    }
    if (el.tagName === 'HR') {
      needNew = true
      lines.push({ block: { ...block, type: 'hr' }, runs: [] })
      return
    }
    const nextStyle = inlineStyleOf(el, style)
    if (!BLOCK_TAGS.has(el.tagName)) {
      for (const c of el.childNodes) walk(c, nextStyle, block)
      return
    }
    let nextBlock = block
    switch (el.tagName) {
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6':
        nextBlock = { ...block, type: 'h', level: Number(el.tagName[1]) }
        break
      case 'UL':
      case 'OL':
        nextBlock = { ...block, list: el.tagName === 'OL' ? 'ol' : 'ul', depth: (block.depth ?? -1) + 1 }
        break
      case 'LI': {
        const idx = [...el.parentNode.children].filter((c) => c.tagName === 'LI').indexOf(el)
        const start = Number(el.parentNode.getAttribute?.('start') || 1)
        nextBlock = { ...block, type: 'li', index: start + idx }
        break
      }
      case 'BLOCKQUOTE':
        nextBlock = { ...block, quote: (block.quote ?? 0) + 1 }
        break
      case 'PRE':
        nextBlock = { ...block, type: 'pre' }
        break
    }
    needNew = true
    const startLen = lines.length
    for (const c of el.childNodes) walk(c, nextStyle, nextBlock)
    // li 의 첫 줄만 글머리표를 갖고, 이어지는 줄은 들여쓰기만 한다
    if (el.tagName === 'LI') {
      let first = true
      for (let k = startLen; k < lines.length; k++) {
        if (lines[k].block !== nextBlock) continue
        if (!first) lines[k].block = { ...nextBlock, type: 'li-cont' }
        first = false
      }
    }
    needNew = true
  }

  for (const c of root.childNodes) walk(c, {}, { type: 'p' })
  return lines
}

function sameStyle(a, b) {
  return !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && !!a.s === !!b.s && !!a.code === !!b.code &&
    (a.color || '') === (b.color || '') && (a.bg || '') === (b.bg || '')
}

function mergeRuns(runs) {
  const out = []
  for (const r of runs) {
    const last = out[out.length - 1]
    if (last && sameStyle(last.style, r.style)) last.text += r.text
    else out.push({ text: r.text, style: r.style })
  }
  return out
}

function escapeMd(text) {
  return text.replace(/([\\`*_~[\]<>|])/g, '\\$1')
}

function rgbToHex(color) {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (!m) return color
  return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
}

function runToMd(run) {
  const { style } = run
  const m = /^(\s*)(.*?)(\s*)$/s.exec(run.text)
  const [, lead, body, trail] = m
  if (!body) return run.text
  let t = style.code ? '`' + body + '`' : escapeMd(body)
  if (style.s) t = `~~${t}~~`
  if (style.i) t = `*${t}*`
  if (style.b) t = `**${t}**`
  if (style.u) t = `<u>${t}</u>`
  const css = []
  if (style.color) css.push(`color: ${rgbToHex(style.color)}`)
  if (style.bg) css.push(`background-color: ${rgbToHex(style.bg)}`)
  if (css.length) t = `<span style="${css.join('; ')}">${t}</span>`
  return lead + t + trail
}

function blockKind(block) {
  if (block.type === 'h') return 'h'
  if (block.type === 'hr') return 'hr'
  if (block.list) return 'list'
  if (block.type === 'pre') return 'pre'
  return 'p'
}

export function htmlToMarkdown(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  const lines = toLines(root)
  const out = []
  let prevKind = null
  let prevQuote = 0
  let inPre = false

  lines.forEach((line, i) => {
    const { block } = line
    const kind = blockKind(block)
    const quote = block.quote ?? 0
    const runs = mergeRuns(line.runs)
    const plain = runs.map((r) => r.text).join('')
    let text = kind === 'pre' ? plain : runs.map(runToMd).join('')

    // 블록 종류가 바뀌면 빈 줄로 구분
    if (prevKind && (kind !== prevKind || quote !== prevQuote) && out[out.length - 1] !== '' && plain.trim() !== '') {
      if (inPre) {
        out.push('```')
        inPre = false
      }
      out.push(quote && prevQuote ? '>'.repeat(Math.min(quote, prevQuote)) : '')
    }
    if (kind === 'pre' && !inPre) {
      out.push('```')
      inPre = true
    }

    let prefix = ''
    if (kind === 'h') prefix = '#'.repeat(block.level) + ' '
    else if (kind === 'hr') text = '---'
    else if (kind === 'list') {
      const indent = '   '.repeat(block.depth ?? 0)
      if (block.type === 'li') prefix = indent + (block.list === 'ol' ? `${block.index}. ` : '- ')
      else prefix = indent + '   '
    } else if (kind === 'p' && text) {
      // 줄머리 마크다운 기호 이스케이프
      text = text.replace(/^(\s*)([#>+-]|\d+\.)(\s)/, '$1\\$2$3')
      const next = lines[i + 1]
      const nextPlain = next ? next.runs.map((r) => r.text).join('') : ''
      // 일반 문단의 줄바꿈 유지 (하드 브레이크)
      if (next && blockKind(next.block) === 'p' && (next.block.quote ?? 0) === quote && nextPlain.trim()) text += '  '
    }
    const q = quote ? '> '.repeat(quote) : ''
    out.push(q + prefix + text)
    prevKind = kind
    prevQuote = quote
  })
  if (inPre) out.push('```')
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function htmlToText(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  return toLines(root)
    .map(({ block, runs }) => {
      const text = runs.map((r) => r.text).join('')
      if (block.type === 'hr') return '────────'
      let prefix = ''
      if (block.list) {
        const indent = '  '.repeat(block.depth ?? 0)
        prefix = block.type === 'li' ? indent + (block.list === 'ol' ? `${block.index}. ` : '・ ') : indent + '  '
      }
      if (block.quote) prefix = '│ '.repeat(block.quote) + prefix
      return prefix + text
    })
    .join('\n')
}

/** 일반 텍스트 → 에디터 HTML (파일 열기용) */
export function textToHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => `<div>${line ? esc(line) : '<br>'}</div>`)
    .join('')
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name) {
  return (name || '메모').replace(/[\\/:*?"<>|\n\r]+/g, '_').trim().slice(0, 80) || '메모'
}
