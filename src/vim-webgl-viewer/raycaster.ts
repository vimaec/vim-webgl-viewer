/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Vim } from '../vim-loader/vim'
import { RenderScene } from './renderScene'
import { Viewport } from './viewport'
import { Camera } from './camera'
import { Renderer } from './renderer'

type ThreeIntersectionList = THREE.Intersection<THREE.Object3D<THREE.Event>>[]

type ActionType = 'main' | 'double' | 'idle'

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
    const vim = hit.object.userData.vim as Vim
    if (!vim) return

    if (hit.object.userData.merged) {
      if (!hit.faceIndex) {
        throw new Error('Raycast hit has no face index.')
      }
      const index = this.binarySearch(
        hit.object.userData.submeshes,
        hit.faceIndex * 3
      )
      const instance = hit.object.userData.instances[index]
      return vim.getObjectFromInstance(instance)
    } else if (hit.instanceId !== undefined) {
      return vim.getObjectFromMesh(
        hit.object as THREE.InstancedMesh,
        hit.instanceId
      )
    }
  }

  private binarySearch (array: number[], element: number) {
    let m = 0
    let n = array.length - 1
    while (m <= n) {
      const k = (n + m) >> 1
      const cmp = element - array[k]
      if (cmp > 0) {
        m = k + 1
      } else if (cmp < 0) {
        n = k - 1
      } else {
        return k
      }
    }
    return m - 1
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
  sceneRaycast (position: THREE.Vector2) {
    let intersections = this.raycast(position)

    if (this._renderer.section.active) {
      intersections = intersections.filter((i) =>
        this._renderer.section.box.containsPoint(i.point)
      )
    }
    return new RaycastResult(intersections)
  }

  fromPoint (
    position: THREE.Vector2,
    target: THREE.Raycaster = new THREE.Raycaster()
  ) {
    const [width, height] = this._viewport.getSize()
    const x = (position.x / width) * 2 - 1
    const y = -(position.y / height) * 2 + 1
    target.setFromCamera(new THREE.Vector2(x, y), this._camera.camera)
    return target
  }

  private raycast (position: THREE.Vector2): ThreeIntersectionList {
    this._raycaster = this.fromPoint(position, this._raycaster)
    return this._raycaster.intersectObjects(this._scene.scene.children)
  }
}

export class InputAction {
  readonly position: THREE.Vector2
  readonly type: ActionType
  private _raycaster: Raycaster

  constructor (type: ActionType, position: THREE.Vector2, raycaster: Raycaster) {
    this.type = type
    this.position = position
    this._raycaster = raycaster
  }

  private _raycast: RaycastResult
  get raycast () {
    return (
      this._raycast ??
      (this._raycast = this._raycaster.sceneRaycast(this.position))
    )
  }

  get object () {
    return this.raycast.object
  }
}
