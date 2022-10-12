// Links files to generate package type exports
import './style.css'
export * as THREE from 'three'

export * from './vim-webgl-viewer/viewer'
export type { PointerMode, InputScheme } from './vim-webgl-viewer/input'
export { DefaultInputScheme, KEYS } from './vim-webgl-viewer/input'
export * from './vim-webgl-viewer/viewerSettings'
export {
  RaycastResult as HitTestResult,
  InputAction
} from './vim-webgl-viewer/raycaster'

export * from './vim-loader/bfast'
export * from './vim-loader/document'
export * from './vim-loader/g3d'
export * from './vim-loader/geometry'
export * from './vim-loader/loader'
export * from './vim-loader/materials'
export * from './vim-loader/mesh'
export * from './vim-loader/object'
export type { IProgressLogs } from './vim-loader/remoteBuffer'
export * from './vim-loader/scene'
export * from './vim-loader/vim'
export * from './vim-loader/vimSettings'
