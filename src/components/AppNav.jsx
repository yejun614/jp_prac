import { NavLink } from 'react-router'

/** 페이지 이동 (메모장 / 타자연습) */
export default function AppNav() {
  return (
    <nav className="app-nav" aria-label="페이지">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>
        メモ<span>帳</span>
      </NavLink>
      <NavLink to="/typing" className={({ isActive }) => (isActive ? 'on' : '')}>
        タイピング
      </NavLink>
    </nav>
  )
}
