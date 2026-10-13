import { useRef } from 'react'
import Pane from './Pane.jsx'

/** 분할 레이아웃 트리를 재귀적으로 그린다 */
export default function Layout({ node, ...props }) {
  if (node.type === 'pane') {
    return <Pane pane={node} active={props.activePane === node.id} {...props} />
  }
  return <Split node={node} {...props} />
}

function Split({ node, ...props }) {
  const ref = useRef(null)
  const { dispatch } = props
  const isRow = node.dir === 'row'

  const onPointerDown = (e) => {
    e.preventDefault()
    const el = ref.current
    const rect = el.getBoundingClientRect()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    document.body.classList.add(isRow ? 'resizing-col' : 'resizing-row')
    const move = (ev) => {
      const ratio = isRow ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height
      dispatch({ type: 'resize', splitId: node.id, ratio: Math.min(0.9, Math.max(0.1, ratio)) })
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-col', 'resizing-row')
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  }

  return (
    <div ref={ref} className={'split ' + node.dir}>
      <div className="split-child" style={{ flexBasis: `${node.ratio * 100}%` }}>
        <Layout node={node.a} {...props} />
      </div>
      <div
        className="split-handle"
        onPointerDown={onPointerDown}
        onDoubleClick={() => dispatch({ type: 'resize', splitId: node.id, ratio: 0.5 })}
        title="드래그하여 크기 조절 (더블클릭: 반반)"
      />
      <div className="split-child" style={{ flexBasis: `${(1 - node.ratio) * 100}%` }}>
        <Layout node={node.b} {...props} />
      </div>
    </div>
  )
}
