/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { VimObject } from '../vim-loader/vimObject'
import { Viewer } from './viewer'

type ThreeIntersectionList = THREE.Intersection<THREE.Object3D<THREE.Event>>[]

export class HitTestResult {
  mousePosition: THREE.Vector2
  doubleClick: boolean
  object: VimObject
  intersections: ThreeIntersectionList

  // Convenience functions and mnemonics
  get firstHit (): THREE.Intersection<THREE.Object3D<THREE.Event>> {
    return this.intersections[0]
  }

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

  get hitFace (): number {
    return this.firstHit.faceIndex
  }
}

export class HitTester {
  viewer: Viewer
  raycaster = new THREE.Raycaster()

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  onMouseClick (position: THREE.Vector2, double: boolean): HitTestResult {
    const r = new HitTestResult()
    r.mousePosition = position
    r.doubleClick = double
    console.time('raycast')
    r.intersections = this.mouseRaycast(position)
    console.timeEnd('raycast')

    const hit = r.firstHit
    if (hit) {
      const vimIndex = hit.object.userData.index
      // Merged mesh have node origin of each face encoded in uvs
      if (hit.object.userData.merged && hit.uv !== undefined) {
        const instance = Math.round(hit.uv.x)
        r.object = this.viewer
          .getVimAt(vimIndex)
          .getObjectFromInstance(instance)
      } else if (hit.instanceId !== undefined) {
        r.object = this.viewer
          .getVimAt(vimIndex)
          .getObjectFromMesh(hit.object as THREE.InstancedMesh, hit.instanceId)
      }
    }
    return r
  }

  mouseRaycast (position: THREE.Vector2): ThreeIntersectionList {
    const [width, height] = this.viewer.renderer.getContainerSize()
    const x = (position.x / width) * 2 - 1
    const y = -(position.y / height) * 2 + 1
    this.raycaster.setFromCamera(
      new THREE.Vector2(x, y),
      this.viewer.camera.camera
    )
    return this.raycaster.intersectObjects(this.viewer.renderer.meshes)
  }
}
