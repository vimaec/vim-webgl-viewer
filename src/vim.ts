// Links files to generate package type exports
import './style.css'
export * as THREE from 'three'

export * from './vim-webgl-viewer/viewer'
export * from './vim-webgl-viewer/gizmos/gizmoGrid'
export type { PointerMode, InputScheme } from './vim-webgl-viewer/inputs/input'
export { DefaultInputScheme, KEYS } from './vim-webgl-viewer/inputs/input'
export * from './vim-webgl-viewer/viewerSettings'
export {
  RaycastResult as HitTestResult,
  InputAction
} from './vim-webgl-viewer/raycaster'

export * from './vim-loader/geometry'
export * from './vim-loader/loader'
export * from './vim-loader/materials/materials'
export * from './vim-loader/mesh'
export * from './vim-loader/object'
export type { IProgressLogs } from 'vim-format'
export * from './vim-loader/scene'
export * from './vim-loader/vim'
export * from './vim-loader/vimSettings'
