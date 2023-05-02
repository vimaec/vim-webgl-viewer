/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Mesh } from '../vim-loader/mesh'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { Camera } from './camera/camera'
import { Renderer } from './rendering/renderer'

/**
 * Type alias for THREE intersection array
 */
export type ThreeIntersectionList = THREE.Intersection<
  THREE.Object3D<THREE.Event>
>[]

export type ActionType = 'main' | 'double' | 'idle'
export type ActionModifier = 'none' | 'shift' | 'ctrl'

/**
 * Highlevel aggregate of information about a raycast result
 */
export class RaycastResult {
  object: Object | undefined
  intersections: ThreeIntersectionList
  firstHit: THREE.Intersection | undefined

  constructor (intersections: ThreeIntersectionList) {
    this.intersections = intersections
    const [hit, obj] = this.GetFirstVimHit(intersections)
    this.firstHit = hit
    this.object = obj
  }

  private GetFirstVimHit (
    intersections: ThreeIntersectionList
  ): [THREE.Intersection, Object] | [] {
    for (let i = 0; i < intersections.length; i++) {
      const obj = this.getVimObjectFromHit(intersections[i])
      if (obj?.visible) return [intersections[i], obj]
    }
    return []
  }

  private getVimObjectFromHit (hit: THREE.Intersection) {
    const mesh = hit.object.userData.vim as Mesh
    if (!mesh) return

    const sub = mesh.merged
      ? mesh.getSubmeshFromFace(hit.faceIndex)
      : mesh.getSubMesh(hit.instanceId)

    return sub.object
  }

  // Convenience functions and mnemonics
  get isHit (): boolean {
    return !!this.firstHit
  }

  get distance () {
    return this.firstHit?.distance
  }

  get position () {
    return this.firstHit?.point
  }

  get threeId () {
    return this.firstHit?.object?.id
  }

  get faceIndex () {
    return this.firstHit?.faceIndex
  }
}

export class Raycaster {
  private _viewport: Viewport
  private _camera: Camera
  private _scene: RenderScene
  private _renderer: Renderer

  private _raycaster = new THREE.Raycaster()

  constructor (
    viewport: Viewport,
    camera: Camera,
    scene: RenderScene,
    renderer: Renderer
  ) {
    this._viewport = viewport
    this._camera = camera
    this._scene = scene
    this._renderer = renderer
  }

  /**
   * Raycast projecting a ray from camera position to screen position
   */
  raycast2 (position: THREE.Vector2) {
    this._raycaster = this.fromPoint2(position, this._raycaster)
    let hits = this._raycaster.intersectObjects(this._scene.scene.children)
    hits = this.filterHits(hits)
    return new RaycastResult(hits)
  }

  private filterHits (hits: ThreeIntersectionList) {
    return this._renderer.section.active
      ? hits.filter((i) => this._renderer.section.box.containsPoint(i.point))
      : hits
  }

  /**
   * Raycast projecting a ray from camera position to world position
   */
  raycast3 (position: THREE.Vector3) {
    this._raycaster = this.fromPoint3(position, this._raycaster)
    let hits = this._raycaster.intersectObjects(this._scene.scene.children)
    hits = this.filterHits(hits)
    return new RaycastResult(hits)
  }

  /**
   * Raycast projecting a ray from camera center
   */
  raycastForward () {
    return this.raycast3(this._camera.target)
  }

  /**
   * Returns a THREE.Raycaster projecting a ray from camera position to screen position
   */
  fromPoint2 (
    position: THREE.Vector2,
    target: THREE.Raycaster = new THREE.Raycaster()
  ) {
    const size = this._viewport.getSize()
    const x = (position.x / size.x) * 2 - 1
    const y = -(position.y / size.y) * 2 + 1
    target.setFromCamera(new THREE.Vector2(x, y), this._camera.three)
    return target
  }

  /**
   * Returns a THREE.Raycaster projecting a ray from camera position to world position
   */
  fromPoint3 (
    position: THREE.Vector3,
    target: THREE.Raycaster = new THREE.Raycaster()
  ) {
    const direction = position.clone().sub(this._camera.position).normalize()

    target.set(this._camera.position, direction)
    return target
  }
}

/**
 * Represents an input action with its position and modifiers.
 */
export class InputAction {
  readonly position: THREE.Vector2
  readonly modifier: ActionModifier
  readonly type: ActionType
  private _raycaster: Raycaster

  constructor (
    type: ActionType,
    modifier: ActionModifier,
    position: THREE.Vector2,
    raycaster: Raycaster
  ) {
    this.type = type
    this.modifier = modifier
    this.position = position
    this._raycaster = raycaster
  }

  private _raycast: RaycastResult | undefined

  /**
   * Returns a raycaster that can be used for custom raycast.
   */
  get raycaster () {
    return this._raycaster.fromPoint2(this.position)
  }

  /**
   * Raycast for VIM Ojbjects at current point. Can be computationally expensive. Lazy evaluation for performance.
   */
  get raycast () {
    return (
      this._raycast ?? (this._raycast = this._raycaster.raycast2(this.position))
    )
  }

  /**
   * Returns the object at current point. This can cause a computationally expensive raycast evaluation.
   */
  get object () {
    return this.raycast.object
  }
}
