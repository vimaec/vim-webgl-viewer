/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Camera } from './camera'
import { Mouse } from './mouse'
import { Renderer } from './renderer'

/**
 * Manages user touch inputs.
 */
export class Touch {
  TAP_DURATION_MS: number = 500

  // Dependencies
  private _camera: Camera
  private _renderer: Renderer
  private _mouse: Mouse

  // State
  private _touchStart: THREE.Vector2 | undefined = undefined // When one touch occurs this is the value, when two or more touches occur it is the average of the first two.
  private _touchStart1: THREE.Vector2 | undefined = undefined // The first touch when multiple touches occur, otherwise left undefined
  private _touchStart2: THREE.Vector2 | undefined = undefined // The second touch when multiple touches occur, otherwise left undefined
  private _touchStartTime: number | undefined = undefined // In ms since epoch

  constructor (camera: Camera, renderer: Renderer, mouse: Mouse) {
    this._camera = camera
    this._renderer = renderer
    this._mouse = mouse
  }

  reset = () => {
    this._touchStart =
      this._touchStart1 =
      this._touchStart2 =
      this._touchStartTime =
        undefined
  }

  private onTap = (position: THREE.Vector2) => {
    this._mouse.onMouseClick(position, false)
  }

  onTouchStart = (event: any) => {
    event.preventDefault() // prevent scrolling
    if (!event || !event.touches || !event.touches.length) {
      return
    }
    this._touchStartTime = new Date().getTime()

    if (event.touches.length === 1) {
      this._touchStart = this.touchToVector(event.touches[0])
      this._touchStart1 = this._touchStart2 = undefined
    } else if (event.touches.length === 2) {
      this._touchStart1 = this.touchToVector(event.touches[0])
      this._touchStart2 = this.touchToVector(event.touches[1])
      this._touchStart = this.average(this._touchStart1, this._touchStart2)
    }
  }

  onDrag = (delta: THREE.Vector2) => {
    this._camera.rotate(delta)
  }

  onDoubleDrag = (delta: THREE.Vector2) => {
    this._camera.move2(delta, 'XY')
  }

  onPinchOrSpread = (delta: number) => {
    this._camera.move1(delta, 'Z')
  }

  onTouchMove = (event: any) => {
    event.preventDefault()
    if (!event || !event.touches || !event.touches.length) return
    if (!this._touchStart) return

    if (event.touches.length === 1) {
      const pos = this.touchToVector(event.touches[0])
      const [width, height] = this._renderer.getContainerSize()
      const delta = pos
        .clone()
        .sub(this._touchStart)
        .multiply(new THREE.Vector2(1 / width, 1 / height))

      this._touchStart = pos
      this.onDrag(delta)
      return
    }

    if (!this._touchStart1 || !this._touchStart2) return
    if (event.touches.length >= 2) {
      const p1 = this.touchToVector(event.touches[0])
      const p2 = this.touchToVector(event.touches[1])
      const p = this.average(p1, p2)
      const [width, height] = this._renderer.getContainerSize()
      const moveDelta = this._touchStart
        .clone()
        .sub(p)
        .multiply(
          // -1 to invert movement
          new THREE.Vector2(-1 / width, -1 / height)
        )

      const zoom = p1.distanceTo(p2)
      const prevZoom = this._touchStart1.distanceTo(this._touchStart2)
      const min = Math.min(width, height)
      // -1 to invert movement
      const zoomDelta = (zoom - prevZoom) / -min

      this._touchStart = p
      this._touchStart1 = p1
      this._touchStart2 = p2

      if (moveDelta.length() > Math.abs(zoomDelta)) {
        this.onDoubleDrag(moveDelta)
      } else {
        this.onPinchOrSpread(zoomDelta)
      }
    }
  }

  onTouchEnd = (_: any) => {
    if (this.isSingleTouch()) {
      const touchDurationMs = new Date().getTime() - this._touchStartTime!
      if (touchDurationMs < this.TAP_DURATION_MS) {
        this.onTap(this._touchStart!)
      }
    }
    this.reset()
  }

  private isSingleTouch (): boolean {
    return (
      this._touchStart !== undefined &&
      this._touchStartTime !== undefined &&
      this._touchStart1 === undefined &&
      this._touchStart2 === undefined
    )
  }

  private touchToVector (touch: any) {
    return new THREE.Vector2(touch.pageX, touch.pageY)
  }

  private average (p1: THREE.Vector2, p2: THREE.Vector2): THREE.Vector2 {
    return p1.clone().lerp(p2, 0.5)
  }
}
