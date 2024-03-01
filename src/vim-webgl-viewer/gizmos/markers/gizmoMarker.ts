import { IElement } from 'vim-format'
import { ElementParameter } from 'vim-format/dist/vimHelpers'
import { Vim } from '../../../vim-loader/vim'
import { Viewer } from '../../viewer'
import * as THREE from 'three'
import { IObject, ObjectType } from '../../../vim-loader/objectInterface'
import { dot } from '../../../images'

/**
 * Marker gizmo that display an interactive sprite at a 3D positions
 * Marker gizmos are still under development.
 */
export class GizmoMarker implements IObject {
  public readonly type: ObjectType = "Marker"
  private _viewer: Viewer
  private _sprite: THREE.Sprite
  private _material : THREE.SpriteMaterial
  private _loaded = false

  /**
   * The vim object from which this object came from.
   */
  vim: Vim

  /**
   * The bim element index associated with this object.
   */
  element: number

  /**
   * The geometry instances  associated with this object.
   */
  instances: number[]

  constructor (viewer: Viewer) {
    this._viewer = viewer

    const texture = this.loadTexture(dot)
    this._material = new THREE.SpriteMaterial({ map:texture, depthTest: false })
    this._sprite = new THREE.Sprite(this._material)
    this._sprite.userData.vim = this
    this.focused = false
  }

  get position() {
    return this._sprite.position;
  }

  /**
   *  Adds this marker to the renderer 
   */
  load(){
    if(!this._loaded){
      this._loaded = this._viewer.renderer.add(this._sprite)
    }
  }

  /**
   * Removes this marker from the renderer.
   */
  unload(){
    if(this._loaded){
      this._viewer.renderer.remove(this._sprite)
    }
  }

   /**
   * Always false
   */
  get hasMesh (): boolean {
    return false
  }

  /**
   * Applies a color override instead of outlines.
   */
  get outline (): boolean {
    return !this.color.equals(new THREE.Color('white'))
  }

  set outline (value: boolean) {
    this.color = value ? new THREE.Color('red') : new THREE.Color('white')
  }

  /**
   * Enlarges the gizmo to indicate focus.
   */
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

  /**
   * Determines if the gizmo will be rendered.
   */
  get visible (): boolean {
    return this._loaded
  }

  set visible (value: boolean) {
    if(value){
      this.load()
    }else{
      this.unload()
    }
  }

  get color (): THREE.Color {
    return this._material.color
  }

  set color (color: THREE.Color) {
    this._material.color.copy(color)
    this._viewer.renderer.needsUpdate = true
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

 /**
   * Retrieves the bounding box of the object from cache or computes it if needed.
   * Returns a unit box arount the marker position.
   * @returns {THREE.Box3 | undefined} The bounding box of the object.
   */
  getBoundingBox (): THREE.Box3 {
    return new THREE.Box3().setFromCenterAndSize(this.position.clone(), new THREE.Vector3(1,1,1))
  }

   /**
   * Retrieves the center position of this object.
   * @param {THREE.Vector3} [target=new THREE.Vector3()] Optional parameter specifying where to copy the center position data.
   * A new instance is created if none is provided.
   * @returns {THREE.Vector3 | undefined} The center position of the object.
   */
  public getCenter (target?: THREE.Vector3): THREE.Vector3 {
    return (target ?? new THREE.Vector3()).copy(this.position)
  }

  private loadTexture(data: string){
    const image = new Image()
    image.src = data
    const texture = new THREE.Texture()
    texture.image = image
    image.onload = () => {
      texture.needsUpdate = true
    }
    return texture
  }
}
