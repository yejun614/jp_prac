// 붙여넣은 HTML 에서 허용된 서식만 남긴다 (글꼴/크기/레이아웃 스타일 제거)

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'INS', 'FONT', 'SPAN', 'BR', 'DIV', 'P',
  'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'HR',
])
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'IFRAME', 'OBJECT', 'TEMPLATE', 'SVG', 'IMG'])
const ALLOWED_STYLE = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration-line', 'text-decoration', 'text-align']

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = document.createElement('div')
  for (const c of doc.body.childNodes) {
    const n = clean(c)
    if (n) out.appendChild(n)
  }
  return out.innerHTML
}

function clean(node) {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.data)
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const tag = node.tagName.toUpperCase()
  if (DROP_TAGS.has(tag)) return null

  let el
  if (ALLOWED_TAGS.has(tag)) {
    el = document.createElement(tag === 'P' ? 'div' : tag.toLowerCase())
    if (tag === 'FONT' && node.getAttribute('color')) el.setAttribute('color', node.getAttribute('color'))
    const style = node.style
    if (style) {
      for (const prop of ALLOWED_STYLE) {
        const v = style.getPropertyValue(prop)
        // 흰 글자/검은 배경 등 원본 페이지 테마 색은 버린다
        if (!v || v === 'inherit' || v === 'initial') continue
        if (prop === 'background-color' && /^(transparent|rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)|#fff(fff)?|white)$/i.test(v)) continue
        if (prop === 'color' && /^(rgb\(0, 0, 0\)|#000(000)?|black)$/i.test(v)) continue
        el.style.setProperty(prop, v)
      }
    }
  } else {
    el = document.createDocumentFragment()
  }
  for (const c of node.childNodes) {
    const n = clean(c)
    if (n) el.appendChild(n)
  }
  // 속성 없는 span 은 풀어준다
  if (el.nodeType === Node.ELEMENT_NODE && el.tagName === 'SPAN' && !el.getAttribute('style')) {
    const frag = document.createDocumentFragment()
    while (el.firstChild) frag.appendChild(el.firstChild)
    return frag
  }
  return el
}
