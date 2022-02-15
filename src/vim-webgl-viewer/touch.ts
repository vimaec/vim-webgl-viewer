/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { ViewerCamera } from './camera'
import { Mouse } from './mouse'
import { Renderer } from './renderer'

export class InputTouch {
  TapDurationMs: number = 500

  // Dependencies
  private camera: ViewerCamera
  private renderer: Renderer
  private mouse: Mouse

  // State
  private touchStart: THREE.Vector2 | undefined = undefined // When one touch occurs this is the value, when two or more touches occur it is the average of the first two.
  private touchStart1: THREE.Vector2 | undefined = undefined // The first touch when multiple touches occur, otherwise left undefined
  private touchStart2: THREE.Vector2 | undefined = undefined // The second touch when multiple touches occur, otherwise left undefined
  private touchStartTime: number | undefined = undefined // In ms since epoch

  constructor (camera: ViewerCamera, renderer: Renderer, mouse: Mouse) {
    this.camera = camera
    this.renderer = renderer
    this.mouse = mouse
  }

  reset = () => {
    this.touchStart =
      this.touchStart1 =
      this.touchStart2 =
      this.touchStartTime =
        undefined
  }

  onTap = (position: THREE.Vector2) => {
    this.mouse.onMouseClick(position, false)
  }

  onTouchStart = (event: any) => {
    event.preventDefault() // prevent scrolling
    if (!event || !event.touches || !event.touches.length) {
      return
    }
    this.touchStartTime = new Date().getTime()

    if (event.touches.length === 1) {
      this.touchStart = this.touchToVector(event.touches[0])
      this.touchStart1 = this.touchStart2 = undefined
    } else if (event.touches.length === 2) {
      this.touchStart1 = this.touchToVector(event.touches[0])
      this.touchStart2 = this.touchToVector(event.touches[1])
      this.touchStart = this.average(this.touchStart1, this.touchStart2)
    }
  }

  onDrag = (delta: THREE.Vector2) => {
    this.camera.rotateCameraBy(delta)
  }

  onDoubleDrag = (delta: THREE.Vector2) => {
    this.camera.truckPedestalCameraBy(delta)
  }

  onPinchOrSpread = (delta: number) => {
    this.camera.dollyCameraBy(delta)
  }

  onTouchMove = (event: any) => {
    event.preventDefault()
    if (!event || !event.touches || !event.touches.length) return
    if (!this.touchStart) return

    if (event.touches.length === 1) {
      const pos = this.touchToVector(event.touches[0])
      const [width, height] = this.renderer.getContainerSize()
      const delta = pos
        .clone()
        .sub(this.touchStart)
        .multiply(new THREE.Vector2(1 / width, 1 / height))

      this.touchStart = pos
      this.onDrag(delta)
      return
    }

    if (!this.touchStart1 || !this.touchStart2) return
    if (event.touches.length >= 2) {
      const p1 = this.touchToVector(event.touches[0])
      const p2 = this.touchToVector(event.touches[1])
      const p = this.average(p1, p2)
      const [width, height] = this.renderer.getContainerSize()
      const moveDelta = this.touchStart
        .clone()
        .sub(p)
        .multiply(
          // -1 to invert movement
          new THREE.Vector2(-1 / width, -1 / height)
        )

      const zoom = p1.distanceTo(p2)
      const prevZoom = this.touchStart1.distanceTo(this.touchStart2)
      const min = Math.min(width, height)
      // -1 to invert movement
      const zoomDelta = (zoom - prevZoom) / -min

      this.touchStart = p
      this.touchStart1 = p1
      this.touchStart2 = p2

      if (moveDelta.length() > Math.abs(zoomDelta)) {
        this.onDoubleDrag(moveDelta)
      } else {
        this.onPinchOrSpread(zoomDelta)
      }
    }
  }

  onTouchEnd = (_: any) => {
    if (this.isSingleTouch()) {
      const touchDurationMs = new Date().getTime() - this.touchStartTime!
      if (touchDurationMs < this.TapDurationMs) {
        this.onTap(this.touchStart!)
      }
    }
    this.reset()
  }

  private isSingleTouch (): boolean {
    return (
      this.touchStart !== undefined &&
      this.touchStartTime !== undefined &&
      this.touchStart1 === undefined &&
      this.touchStart2 === undefined
    )
  }

  touchToVector (touch: any) {
    return new THREE.Vector2(touch.pageX, touch.pageY)
  }

  average (p1: THREE.Vector2, p2: THREE.Vector2): THREE.Vector2 {
    return p1.clone().lerp(p2, 0.5)
  }
}
