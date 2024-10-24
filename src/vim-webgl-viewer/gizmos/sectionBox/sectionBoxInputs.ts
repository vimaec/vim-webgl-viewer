/**
 @module viw-webgl-viewer/gizmos/sectionBox
*/

import { Viewer } from '../../viewer'
import * as THREE from 'three'

/**
 * Defines user interactions with the section box.
 */
export class BoxInputs {
  // dependencies
  viewer: Viewer
  cube: THREE.Object3D
  sharedBox: THREE.Box3

  // state
  faceNormal: THREE.Vector3 = new THREE.Vector3()
  dragOrigin: THREE.Vector3 = new THREE.Vector3()
  dragpPlane: THREE.Plane = new THREE.Plane()
  mouseDown: boolean | undefined
  raycaster: THREE.Raycaster = new THREE.Raycaster()
  lastBox: THREE.Box3 = new THREE.Box3()
  unregisters: (() => void)[] = []
  lastMouse : PointerEvent
  ctrlDown: boolean = false

  // Called when mouse enters or leave a face
  onFaceEnter: ((normal: THREE.Vector3) => void) | undefined
  // Called the box is reshaped
  onBoxStretch: ((box: THREE.Box3) => void) | undefined
  // Called when the user is done reshaping the box
  onBoxConfirm: ((box: THREE.Box3) => void) | undefined

  constructor (viewer: Viewer, cube: THREE.Object3D, box: THREE.Box3) {
    this.viewer = viewer
    this.cube = cube
    this.sharedBox = box
  }

  private reg = (
    // eslint-disable-next-line no-undef
    handler: HTMLElement | Window,
    type: string,
    listener: (event: any) => void
  ) => {
    handler.addEventListener(type, listener)
    this.unregisters.push(() => handler.removeEventListener(type, listener))
  }

  register () {
    if (this.unregister.length > 0) return
    const canvas = this.viewer.viewport.canvas
    this.reg(window, 'keydown', this.onKey.bind(this))
    this.reg(window, 'keyup', this.onKey.bind(this))

    this.reg(canvas, 'pointerdown', this.onMouseDown.bind(this))
    this.reg(canvas, 'pointermove', this.onMouseMove.bind(this))
    this.reg(canvas, 'pointerup', this.onMouseUp.bind(this))
  }

  unregister () {
    this.ctrlDown = false
    this.mouseDown = false
    this.viewer.viewport.canvas.releasePointerCapture(this.lastMouse.pointerId)
    this.viewer.inputs.registerAll()
    this.unregisters.forEach((unreg) => unreg())
    this.unregisters.length = 0
  }

  onKey (event: KeyboardEvent) {
    if (this.ctrlDown !== event.ctrlKey) {
      this.ctrlDown = event.ctrlKey
      this.onMouseMove(this.lastMouse)
    }
  }

  onMouseMove (event: PointerEvent) {
    this.lastMouse = event
    if (this.mouseDown) {
      this.onDrag(event)
      return
    }

    const hits = this.raycast(
      new THREE.Vector2(event.offsetX, event.offsetY),
      this.ctrlDown
    )
    const hit = hits?.[0]
    const norm = hit?.face?.normal
    if (!norm) {
      if (
        this.faceNormal.x !== 0 ||
        this.faceNormal.y !== 0 ||
        this.faceNormal.z !== 0
      ) {
        this.faceNormal.set(0, 0, 0)
        this.onFaceEnter?.(this.faceNormal)
      }
      return
    }

    if (this.faceNormal.equals(norm)) {
      return
    }

    this.faceNormal = norm
    this.onFaceEnter?.(this.faceNormal)
  }

  onMouseUp (event: PointerEvent) {
    this.viewer.viewport.canvas.releasePointerCapture(event.pointerId)
    if (this.mouseDown) {
      this.mouseDown = false
      this.viewer.inputs.registerAll()
      if (event.pointerType === 'mouse') {
        this.onMouseMove(event)
      } else {
        this.faceNormal = new THREE.Vector3()
        this.onFaceEnter?.(this.faceNormal)
      }
      this.onBoxConfirm?.(this.sharedBox)
    }
  }

  onMouseDown (event: PointerEvent) {
    const hits = this.raycast(
      new THREE.Vector2(event.offsetX, event.offsetY),
      this.ctrlDown
    )
    const hit = hits?.[0]
    if (!hit?.face?.normal) return
    this.viewer.viewport.canvas.setPointerCapture(event.pointerId)

    this.lastBox.copy(this.sharedBox)
    this.faceNormal = hit.face.normal
    this.dragOrigin.copy(hit.point)
    const dist = hit.point.clone().dot(this.viewer.camera.forward)

    this.dragpPlane.set(this.viewer.camera.forward, -dist)
    this.mouseDown = true
    this.viewer.inputs.unregisterAll()
    this.onFaceEnter?.(this.faceNormal)
  }

  onDrag (event: any) {
    this.raycaster = this.viewer.raycaster.fromPoint2(
      new THREE.Vector2(event.offsetX, event.offsetY),
      this.raycaster
    )
    // We get the mouse raycast intersection on the drag plane.
    const point =
      this.raycaster.ray.intersectPlane(this.dragpPlane, new THREE.Vector3()) ??
      this.dragOrigin.clone()

    // We compute the normal-aligned component of the delta between current drag point and origin drag point.
    const delta = point.sub(this.dragOrigin)
    const amount = delta.dot(this.faceNormal)
    const box = this.stretch(this.faceNormal, amount)
    this.onBoxStretch?.(box)
  }

  stretch (normal: THREE.Vector3, amount: number) {
    const result = this.sharedBox.clone()
    if (normal.x > 0.1) {
      result.max.setX(Math.max(this.lastBox.max.x + amount, result.min.x - 1))
    }
    if (normal.x < -0.1) {
      result.min.setX(Math.min(this.lastBox.min.x - amount, result.max.x + 1))
    }

    if (normal.y > 0.1) {
      result.max.setY(Math.max(this.lastBox.max.y + amount, result.min.y - 1))
    }
    if (normal.y < -0.1) {
      result.min.setY(Math.min(this.lastBox.min.y - amount, result.max.y + 1))
    }

    if (normal.z > 0.1) {
      result.max.setZ(Math.max(this.lastBox.max.z + amount, result.min.z - 1))
    }
    if (normal.z < -0.1) {
      result.min.setZ(Math.min(this.lastBox.min.z - amount, result.max.z + 1))
    }
    return result
  }

  raycast (position: THREE.Vector2, reverse: boolean) {
    this.raycaster = this.viewer.raycaster.fromPoint2(position, this.raycaster)
    if (reverse) {
      this.raycaster.ray.set(
        this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(this.viewer.settings.camera.far)),
        this.raycaster.ray.direction.negate())
    }
    return this.raycaster.intersectObject(this.cube)
  }
}
