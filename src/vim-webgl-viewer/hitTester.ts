/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Object } from '../vim-loader/object'
import { Viewer } from './viewer'

type ThreeIntersectionList = THREE.Intersection<THREE.Object3D<THREE.Event>>[]

export class HitTestResult {
  mousePosition: THREE.Vector2
  doubleClick: boolean
  object: Object
  intersections: ThreeIntersectionList
  firstHit: THREE.Intersection

  constructor (
    mousePosition: THREE.Vector2,
    doubleClick: boolean,
    intersections: ThreeIntersectionList
  ) {
    this.mousePosition = mousePosition
    this.doubleClick = doubleClick
    this.intersections = intersections
    this.firstHit = HitTestResult.GetFirstVimHit(intersections)
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
    console.time('raycast')
    const intersections = this.mouseRaycast(position)
    console.timeEnd('raycast')
    const r = new HitTestResult(position, double, intersections)

    const hit = r.firstHit

    if (hit) {
      const vimIndex = hit.object.userData.index
      // Merged mesh have node origin of each face encoded in uvs
      if (hit.object.userData.merged && hit.uv !== undefined) {
        const instance = Math.round(hit.uv.x)
        r.object = this.viewer
          .getVim(vimIndex)
          .getObjectFromInstance(instance)
      } else if (hit.instanceId !== undefined) {
        r.object = this.viewer
          .getVim(vimIndex)
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
    return this.raycaster.intersectObjects(this.viewer.renderer.scene.children)
  }
}
