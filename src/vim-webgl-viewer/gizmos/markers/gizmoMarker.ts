import { VimDocument, IElement } from 'vim-format'
import { ElementParameter } from 'vim-format/dist/vimHelpers'
import { Object, Vim } from '../../../vim'
import { Submesh } from '../../../vim-loader/mesh'
import { Viewer } from '../../viewer'
import * as THREE from 'three'

export class GizmoMarker {
  private _viewer: Viewer
  private _sprite: THREE.Sprite

  vim: Vim
  document: VimDocument
  element: number
  instances: number[]

  constructor (viewer: Viewer) {
    const map = new THREE.TextureLoader().load('dot.png')
    const material = new THREE.SpriteMaterial({ map, depthTest: false })
    const sprite = new THREE.Sprite(material)
    sprite.userData.vim = this

    this._sprite = sprite
    this._viewer = viewer
    this.focused = false
    
  }

  get position() {
    return this._sprite.position;
  }

  load(){
    this._viewer.renderer.add(this._sprite)
  }

  unload(){
    this._viewer.renderer.remove(this._sprite)
  }

  get hasMesh (): boolean {
    return false
  }

  get outline (): boolean {
    throw new Error('Method not implemented.')
  }

  set outline (value: boolean) {
    throw new Error('Method not implemented.')
  }

  get focused (): boolean {
    return this._sprite.scale.x === 8
  }

  set focused (value: boolean) {
    if (value) {
      this._sprite.scale.set(8, 8, 8)
    } else {
      this._sprite.scale.set(5, 5, 5)
    }
    this._viewer.renderer.needsUpdate = true
  }

  get visible (): boolean {
    throw new Error('Method not implemented.')
  }

  set visible (value: boolean) {
    throw new Error('Method not implemented.')
  }

  get color (): THREE.Color {
    throw new Error('Method not implemented.')
  }

  set color (color: THREE.Color) {
    throw new Error('Method not implemented.')
  }

  addMesh (mesh: Submesh): void {
    throw new Error('Method not implemented.')
  }

  getBimElement (): Promise<IElement> {
    throw new Error('Method not implemented.')
  }

  getBimParameters (): Promise<ElementParameter[]> {
    throw new Error('Method not implemented.')
  }

  get elementId (): any {
    throw new Error('Method not implemented.')
  }

  getBoundingBox (): THREE.Box3 {
    throw new Error('Method not implemented.')
  }

  public getCenter (target?: THREE.Vector3): THREE.Vector3 {
    throw new Error('Method not implemented.')
  }

  createWireframe (): THREE.LineSegments<
    THREE.WireframeGeometry<THREE.BufferGeometry>,
    THREE.LineBasicMaterial
    > {
    throw new Error('Method not implemented.')
  }

  createGeometry (): THREE.BufferGeometry {
    throw new Error('Method not implemented.')
  }
}
