/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object3D } from '../vim-loader/object3D'
import { Mesh } from '../vim-loader/mesh'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { Camera } from './camera/camera'
import { Renderer } from './rendering/renderer'
import { GizmoMarker } from './gizmos/markers/gizmoMarker'
import { GizmoMarkers } from './gizmos/markers/gizmoMarkers'
import { Plan2D } from './gizmos/plan2D'

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
  object: Object3D | GizmoMarker | Plan2D | undefined
  intersections: ThreeIntersectionList
  firstHit: THREE.Intersection | undefined

  constructor (intersections: ThreeIntersectionList) {
    this.intersections = intersections

    // Markers have priority over other objects
    const [markerHit, marker] = this.GetFirstMarkerHit(intersections)
    if (marker) {
      this.object = marker
      this.firstHit = markerHit
      return
    }

    const [objectHit, obj] = this.GetFirstHit(intersections)
    this.firstHit = objectHit
    this.object = obj
  }

  private GetFirstHit (
    intersections: ThreeIntersectionList
  ): [THREE.Intersection, Object3D | Plan2D] | [] {
    for (let i = 0; i < intersections.length; i++) {
      // Check for Plan2D
      const data = intersections[i].object.userData.vim
      if (data instanceof Plan2D) {
        return [intersections[i], data]
      }

      // Check for visible vim object
      const obj = this.getVimObjectFromHit(intersections[i])
      if (obj?.visible) return [intersections[i], obj]
    }
    return []
  }

  private GetFirstMarkerHit (
    intersections: ThreeIntersectionList
  ): [THREE.Intersection, GizmoMarker] | [] {
    for (let i = 0; i < intersections.length; i++) {
      const data = intersections[i].object.userData.vim

      if (data instanceof GizmoMarkers) {
        const instance = intersections[i].instanceId
        const marker = data.getMarkerFromIndex(instance)
        return [intersections[i], marker]
      }
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
   * Performs a raycast by projecting a ray from the camera position to a screen position.
   * @param {THREE.Vector2} position - The screen position for raycasting.
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
   * Performs a raycast by projecting a ray from the camera position to a world position.
   * @param {THREE.Vector3} position - The world position for raycasting.
   */
  raycast3 (position: THREE.Vector3) {
    this._raycaster = this.fromPoint3(position, this._raycaster)
    let hits = this._raycaster.intersectObjects(this._scene.scene.children)
    hits = this.filterHits(hits)
    return new RaycastResult(hits)
  }

  /**
   * Performs a raycast by projecting a ray from the camera center.
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
   * Returns a THREE.Raycaster projecting a ray from the camera position to a screen position.
   * @param {THREE.Vector2} position - The screen position for raycasting.
   * @returns {THREE.Raycaster} A raycaster object for performing raycasting.
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
   * A THREE.Raycaster object for custom raycasting.
   */
  get raycaster () {
    return this._raycaster.fromPoint2(this.position)
  }

  /**
   * Performs raycasting for VIM objects at the current point. This operation can be computationally expensive.
   */
  get raycast () {
    return (
      this._raycast ?? (this._raycast = this._raycaster.raycast2(this.position))
    )
  }

  /**
   * Returns the object at the current point. This operation can cause a computationally expensive raycast evaluation.
   */
  get object () {
    return this.raycast.object
  }
}
