// 메모 문서 + 분할 레이아웃 상태 관리 (useReducer) 와 localStorage 저장

const STORAGE_KEY = 'jpmemo:v1'

export const uid = () => Math.random().toString(36).slice(2, 10)

const WELCOME_HTML = [
  '<h2>📝 일본어 메모장에 오신 것을 환영합니다</h2>',
  '<div>상단에서 입력 모드를 고르세요: <b>EN</b> · <b>あ (일본어)</b> · <b>가 (한국어)</b></div>',
  '<div>단축키: <b>Alt+1</b> 영어, <b>Alt+2</b> 일본어, <b>Alt+3</b> 한국어, <b>Alt+`</b> 순환</div>',
  '<div><br></div>',
  '<h3>일본어 입력</h3>',
  '<ul><li>로마자로 입력: <span style="color: rgb(37, 99, 235);">nihongo</span> → にほんご</li>',
  '<li><b>Space</b> 한자 변환 / 다음 후보, <b>Enter</b> 확정, <b>Esc</b> 변환 취소</li>',
  '<li><b>←/→</b> 문절 이동, <b>Shift+←/→</b> 문절 길이 조절, <b>1~9</b> 후보 선택</li>',
  '<li><b>F6</b> 히라가나, <b>F7</b> 가타카나, <b>F8</b> 반각 가타카나, <b>F9</b> 전각 영문, <b>F10</b> 반각 영문</li></ul>',
  '<div><br></div>',
  '<h3>한국어 입력</h3>',
  '<div>두벌식 자판 배열입니다. 예) <span style="color: rgb(37, 99, 235);">dkssudgktpdy</span> → 안녕하세요</div>',
  '<div><br></div>',
  '<div>탭을 끌어 다른 창이나 가장자리에 놓으면 화면을 <u>좌우/상하로 분할</u>할 수 있어요.</div>',
  '<div><s>취소선</s>, <i>기울임</i>, <b>굵게</b>, <font color="#dc2626">색상</font>, <span style="background-color: rgb(254, 240, 138);">형광펜</span>도 쓸 수 있어요.</div>',
].join('')

function makeDoc(title = '', html = '') {
  const now = Date.now()
  return { id: uid(), title, html, createdAt: now, updatedAt: now }
}

export function makePane(tabs = [], active = tabs[0] ?? null) {
  return { type: 'pane', id: uid(), tabs, active }
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.docs && saved?.layout) return { ...saved, activePane: saved.activePane ?? firstPane(saved.layout).id }
  } catch {
    /* 손상된 저장 데이터는 무시 */
  }
  const doc = makeDoc('시작하기', WELCOME_HTML)
  const pane = makePane([doc.id])
  return { docs: { [doc.id]: doc }, layout: pane, activePane: pane.id }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ---------- 트리 헬퍼 ----------
export function firstPane(node) {
  return node.type === 'pane' ? node : firstPane(node.a)
}

export function findPane(node, id) {
  if (node.type === 'pane') return node.id === id ? node : null
  return findPane(node.a, id) || findPane(node.b, id)
}

export function allPanes(node, out = []) {
  if (node.type === 'pane') out.push(node)
  else {
    allPanes(node.a, out)
    allPanes(node.b, out)
  }
  return out
}

function mapNode(node, id, fn) {
  if (node.id === id) return fn(node)
  if (node.type === 'split') {
    const a = mapNode(node.a, id, fn)
    const b = mapNode(node.b, id, fn)
    if (a !== node.a || b !== node.b) return { ...node, a, b }
  }
  return node
}

/** 빈 창을 제거하고 형제 노드가 부모 자리를 차지하게 한다 */
function prune(node) {
  if (node.type === 'pane') return node.tabs.length ? node : null
  const a = prune(node.a)
  const b = prune(node.b)
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  return a === node.a && b === node.b ? node : { ...node, a, b }
}

function normalize(state) {
  let layout = prune(state.layout)
  if (!layout) layout = makePane()
  let activePane = state.activePane
  if (!findPane(layout, activePane)) activePane = firstPane(layout).id
  return { ...state, layout, activePane }
}

function removeTab(pane, docId) {
  const i = pane.tabs.indexOf(docId)
  if (i < 0) return pane
  const tabs = pane.tabs.filter((t) => t !== docId)
  const active = pane.active === docId ? (tabs[i] ?? tabs[i - 1] ?? null) : pane.active
  return { ...pane, tabs, active }
}

function addTab(pane, docId, index = pane.tabs.length) {
  const tabs = pane.tabs.filter((t) => t !== docId)
  tabs.splice(Math.min(index, tabs.length), 0, docId)
  return { ...pane, tabs, active: docId }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'docChange': {
      const doc = state.docs[action.docId]
      if (!doc || doc.html === action.html) return state
      return { ...state, docs: { ...state.docs, [doc.id]: { ...doc, html: action.html, updatedAt: Date.now() } } }
    }
    case 'rename': {
      const doc = state.docs[action.docId]
      if (!doc) return state
      return { ...state, docs: { ...state.docs, [doc.id]: { ...doc, title: action.title.trim() } } }
    }
    case 'newDoc': {
      const doc = makeDoc(action.title ?? '', action.html ?? '')
      const paneId = action.paneId ?? state.activePane
      return {
        ...state,
        docs: { ...state.docs, [doc.id]: doc },
        layout: mapNode(state.layout, paneId, (p) => addTab(p, doc.id)),
        activePane: paneId,
      }
    }
    case 'openDoc': {
      const paneId = action.paneId ?? state.activePane
      return { ...state, layout: mapNode(state.layout, paneId, (p) => addTab(p, action.docId, p.tabs.indexOf(p.active) + 1)), activePane: paneId }
    }
    case 'activateTab':
      return {
        ...state,
        layout: mapNode(state.layout, action.paneId, (p) => ({ ...p, active: action.docId })),
        activePane: action.paneId,
      }
    case 'closeTab':
      return normalize({ ...state, layout: mapNode(state.layout, action.paneId, (p) => removeTab(p, action.docId)) })
    case 'deleteDoc': {
      const docs = { ...state.docs }
      delete docs[action.docId]
      let layout = state.layout
      for (const p of allPanes(layout)) layout = mapNode(layout, p.id, (n) => removeTab(n, action.docId))
      return normalize({ ...state, docs, layout })
    }
    case 'focusPane':
      return state.activePane === action.paneId ? state : { ...state, activePane: action.paneId }
    case 'split': {
      // 창을 나누고 새 창에 문서를 연다. side: left|right|top|bottom
      const { paneId, side, docId, fromPane } = action
      const target = findPane(state.layout, paneId)
      if (!target) return state
      const openId = docId ?? target.active
      let docs = state.docs
      let newTabs
      if (openId) newTabs = [openId]
      else {
        const doc = makeDoc()
        docs = { ...docs, [doc.id]: doc }
        newTabs = [doc.id]
      }
      // 같은 창에서 하나뿐인 탭을 끌어다 나누는 것은 의미가 없다
      if (fromPane === paneId && target.tabs.length === 1) return state
      let layout = state.layout
      if (fromPane) layout = mapNode(layout, fromPane, (p) => removeTab(p, docId))
      const newPane = makePane(newTabs)
      const dir = side === 'left' || side === 'right' ? 'row' : 'column'
      const before = side === 'left' || side === 'top'
      layout = mapNode(layout, paneId, (p) => ({
        type: 'split',
        id: uid(),
        dir,
        ratio: 0.5,
        a: before ? newPane : p,
        b: before ? p : newPane,
      }))
      return normalize({ ...state, docs, layout, activePane: newPane.id })
    }
    case 'moveTab': {
      const { fromPane, toPane, docId, index } = action
      let layout = state.layout
      if (fromPane !== toPane) layout = mapNode(layout, fromPane, (p) => removeTab(p, docId))
      layout = mapNode(layout, toPane, (p) => addTab(p, docId, index))
      return normalize({ ...state, layout, activePane: toPane })
    }
    case 'setWritingMode': {
      const doc = state.docs[action.docId]
      if (!doc) return state
      return { ...state, docs: { ...state.docs, [doc.id]: { ...doc, writingMode: action.writingMode } } }
    }
    case 'closeActiveTab': {
      const pane = findPane(state.layout, state.activePane)
      if (!pane?.active) return state
      return reducer(state, { type: 'closeTab', paneId: pane.id, docId: pane.active })
    }
    case 'splitActive':
      return reducer(state, { type: 'split', paneId: state.activePane, side: action.side })
    case 'resize':
      return { ...state, layout: mapNode(state.layout, action.splitId, (s) => ({ ...s, ratio: action.ratio })) }
    default:
      return state
  }
}
