/**
 * @module viw-webgl-viewer/inputs
 */

import * as THREE from 'three'
import { InputHandler } from './inputHandler'
import { InputAction } from '../raycaster'
import { Viewer } from '../viewer'

/**
 * Manages user touch inputs.
 */
export class TouchHandler extends InputHandler {
  private readonly TAP_DURATION_MS: number = 500
  private readonly DOUBLE_TAP_DELAY_MS = 500
  private readonly TAP_MAX_MOVE_PIXEL = 5
  private readonly ZOOM_SPEED = 1
  private readonly MOVE_SPEED = 100
  rotateSpeed = 1
  orbitSpeed = 1

  constructor (viewer: Viewer) {
    super(viewer)
    this.rotateSpeed = viewer.settings.camera.controls.rotateSpeed
    this.orbitSpeed = viewer.settings.camera.controls.orbitSpeed
  }

  private get camera () {
    return this._viewer.camera
  }

  private get viewport () {
    return this._viewer.viewport
  }

  // State
  private _touch: THREE.Vector2 | undefined = undefined // When one touch occurs this is the value, when two or more touches occur it is the average of the first two.
  private _touch1: THREE.Vector2 | undefined = undefined // The first touch when multiple touches occur, otherwise left undefined
  private _touch2: THREE.Vector2 | undefined = undefined // The second touch when multiple touches occur, otherwise left undefined
  private _touchStartTime: number | undefined = undefined // In ms since epoch
  private _lastTapMs: number | undefined
  private _touchStart: THREE.Vector2 | undefined

  protected override addListeners (): void {
    const canvas = this.viewport.canvas
    this.reg(canvas, 'touchstart', this.onTouchStart)
    this.reg(canvas, 'touchend', this.onTouchEnd)
    this.reg(canvas, 'touchmove', this.onTouchMove)
  }

  override reset = () => {
    this._touch = this._touch1 = this._touch2 = this._touchStartTime = undefined
  }

  private onTap = (position: THREE.Vector2) => {
    const time = new Date().getTime()
    const double =
      this._lastTapMs && time - this._lastTapMs < this.DOUBLE_TAP_DELAY_MS
    this._lastTapMs = new Date().getTime()

    const action = new InputAction(
      double ? 'double' : 'main',
      'none',
      position,
      this._viewer.raycaster
    )

    this._viewer.inputs.MainAction(action)
  }

  private onTouchStart = (event: any) => {
    event.preventDefault() // prevent scrolling
    if (!event || !event.touches || !event.touches.length) {
      return
    }
    this._touchStartTime = new Date().getTime()

    if (event.touches.length === 1) {
      this._touch = this.touchToVector(event.touches[0])
      this._touch1 = this._touch2 = undefined
    } else if (event.touches.length === 2) {
      this._touch1 = this.touchToVector(event.touches[0])
      this._touch2 = this.touchToVector(event.touches[1])
      this._touch = this.average(this._touch1, this._touch2)
    }
    this._touchStart = this._touch
  }

  private toRotation (delta: THREE.Vector2, speed: number) {
    const rotation = new THREE.Vector2()
    rotation.x = delta.y
    rotation.y = delta.x
    rotation.multiplyScalar(-180 * speed)
    return rotation
  }

  private onDrag = (delta: THREE.Vector2) => {
    if (this._viewer.inputs.pointerActive === 'orbit') {
      this.camera.do().orbit(this.toRotation(delta, this.orbitSpeed))
    } else {
      this.camera.do().rotate(this.toRotation(delta, this.rotateSpeed))
    }
  }

  private onDoubleDrag = (delta: THREE.Vector2) => {
    const move = delta.clone().multiplyScalar(this.MOVE_SPEED)
    this.camera.do().move2(move, 'XY')
  }

  private onPinchOrSpread = (delta: number) => {
    if (this._viewer.inputs.pointerActive === 'orbit') {
      this.camera.do().zoom(1 + delta * this.ZOOM_SPEED)
    } else {
      this.camera.do().move1(delta * this.ZOOM_SPEED, 'Z')
    }
  }

  private onTouchMove = (event: any) => {
    event.preventDefault()
    if (!event || !event.touches || !event.touches.length) return
    if (!this._touch) return

    if (event.touches.length === 1) {
      const pos = this.touchToVector(event.touches[0])
      const size = this.viewport.getSize()
      const delta = pos
        .clone()
        .sub(this._touch)
        .multiply(new THREE.Vector2(1 / size.x, 1 / size.y))

      this._touch = pos
      this.onDrag(delta)
      return
    }

    if (!this._touch1 || !this._touch2) return
    if (event.touches.length >= 2) {
      const p1 = this.touchToVector(event.touches[0])
      const p2 = this.touchToVector(event.touches[1])
      const p = this.average(p1, p2)
      const size = this.viewport.getSize()
      const moveDelta = this._touch
        .clone()
        .sub(p)
        .multiply(
          // -1 to invert movement
          new THREE.Vector2(-1 / size.x, -1 / size.y)
        )

      const zoom = p1.distanceTo(p2)
      const prevZoom = this._touch1.distanceTo(this._touch2)
      const min = Math.min(size.x, size.y)
      // -1 to invert movement
      const zoomDelta = (zoom - prevZoom) / -min

      this._touch = p
      this._touch1 = p1
      this._touch2 = p2

      if (moveDelta.length() > Math.abs(zoomDelta)) {
        this.onDoubleDrag(moveDelta)
      } else {
        this.onPinchOrSpread(zoomDelta)
      }
    }
  }

  private onTouchEnd = (event: any) => {
    if (this.isSingleTouch() && this._touchStart && this._touch) {
      const touchDurationMs = new Date().getTime() - this._touchStartTime!
      const length = this._touch.distanceTo(this._touchStart)
      if (
        touchDurationMs < this.TAP_DURATION_MS &&
        length < this.TAP_MAX_MOVE_PIXEL
      ) {
        this.onTap(this._touch!)
      }
    }
    this.reset()
  }

  private isSingleTouch (): boolean {
    return (
      this._touch !== undefined &&
      this._touchStartTime !== undefined &&
      this._touch1 === undefined &&
      this._touch2 === undefined
    )
  }

  private touchToVector (touch: any) {
    return new THREE.Vector2(touch.pageX, touch.pageY)
  }

  private average (p1: THREE.Vector2, p2: THREE.Vector2): THREE.Vector2 {
    return p1.clone().lerp(p2, 0.5)
  }
}
