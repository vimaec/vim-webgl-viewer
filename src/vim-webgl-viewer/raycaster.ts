/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Viewer } from './viewer'

type ThreeIntersectionList = THREE.Intersection<THREE.Object3D<THREE.Event>>[]

/**
 * Highlevel aggregate of information about a raycast result
 */
export class RaycastResult {
  mousePosition: THREE.Vector2
  doubleClick: boolean
  object: Object
  intersections: ThreeIntersectionList
  firstHit: THREE.Intersection

  constructor (
    mousePosition: THREE.Vector2,
    intersections: ThreeIntersectionList
  ) {
    this.mousePosition = mousePosition
    this.intersections = intersections
    this.firstHit = RaycastResult.GetFirstVimHit(intersections)
  }

  private static GetFirstVimHit (
    intersections: ThreeIntersectionList
  ): THREE.Intersection | undefined {
    for (let i = 0; i < intersections.length; i++) {
      if (intersections[i].object?.userData?.index !== undefined) {
        return intersections[i]
      }
    }
  }

  // Convenience functions and mnemonics
  get isHit (): boolean {
    return !!this.firstHit
  }

  get distance (): number {
    return this.firstHit.distance
  }

  get position (): THREE.Vector3 {
    return this.firstHit.point
  }

  get objectId (): number {
    return this.firstHit.object.id
  }

  get faceIndex (): number {
    return this.firstHit.faceIndex
  }
}

export class Raycaster {
  private _viewer: Viewer
  private _raycaster = new THREE.Raycaster()

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  /**
   * Raycast projecting a ray from camera position to screen position
   */
  screenRaycast (position: THREE.Vector2): RaycastResult {
    console.time('raycast')
    const intersections = this.raycast(position)
    console.timeEnd('raycast')
    const r = new RaycastResult(position, intersections)

    const hit = r.firstHit

    if (hit) {
      const vimIndex = hit.object.userData.index
      // Merged meshes have g3d intance index of each face encoded in uvs
      if (hit.object.userData.merged && hit.uv !== undefined) {
        const instance = Math.round(hit.uv.x)
        r.object = this._viewer.getVim(vimIndex).getObjectFromInstance(instance)
      } else if (hit.instanceId !== undefined) {
        r.object = this._viewer
          .getVim(vimIndex)
          .getObjectFromMesh(hit.object as THREE.InstancedMesh, hit.instanceId)
      }
    }
    return r
  }

  private raycast (position: THREE.Vector2): ThreeIntersectionList {
    const [width, height] = this._viewer.renderer.getContainerSize()
    const x = (position.x / width) * 2 - 1
    const y = -(position.y / height) * 2 + 1
    this._raycaster.setFromCamera(
      new THREE.Vector2(x, y),
      this._viewer.camera.camera
    )
    return this._raycaster.intersectObjects(this._viewer.renderer.scene.children)
  }
}
