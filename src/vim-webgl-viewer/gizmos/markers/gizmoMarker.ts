import { VimDocument, IElement } from 'vim-format'
import { ElementParameter } from 'vim-format/dist/vimHelpers'
import { Vim } from '../../../vim-loader/vim'
import { Submesh } from '../../../vim-loader/mesh'
import { Viewer } from '../../viewer'
import * as THREE from 'three'
import { IObject } from '../../../vim-loader/object'

export class GizmoMarker implements IObject {
  private _viewer: Viewer
  private _sprite: THREE.Sprite
  private _material : THREE.SpriteMaterial

  vim: Vim
  document: VimDocument
  element: number
  instances: number[]

  constructor (viewer: Viewer) {
    const map = new THREE.TextureLoader().load('dot.png')
    this._material = new THREE.SpriteMaterial({ map, depthTest: false })
    this._sprite = new THREE.Sprite(this._material)
    this._sprite.userData.vim = this
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
    return !this.color.equals(new THREE.Color('white'))
  }

  set outline (value: boolean) {
    this.color = value ? new THREE.Color('red') : new THREE.Color('white')
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
    return this._material.color
  }

  set color (color: THREE.Color) {
    this._material.color.copy(color)
    this._viewer.renderer.needsUpdate = true
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
    return new THREE.Box3().setFromCenterAndSize(this.position.clone(), new THREE.Vector3(1,1,1))
  }

  public getCenter (target?: THREE.Vector3): THREE.Vector3 {
    return (target ?? new THREE.Vector3()).copy(this.position)
  }
}