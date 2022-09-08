import * as THREE from 'three'
import { ViewerSettings } from './viewerSettings'

export class Viewport {
  canvas: HTMLCanvasElement
  private _unregisterResize: Function | undefined
  private _ownedCanvas: boolean
  private _resizeCallbacks: (() => void)[] = []

  constructor (settings: ViewerSettings) {
    const [canvas, owned] = Viewport.getOrCreateCanvas(settings.getCanvasId())
    this.canvas = canvas
    this._ownedCanvas = owned
    this.registerResize(settings.getCanvasResizeDelay())
  }

  /**
   * Either returns html canvas at provided Id or creates a canvas at root level
   */
  private static getOrCreateCanvas (
    canvasId?: string
  ): [HTMLCanvasElement, boolean] {
    let canvas = canvasId
      ? (document.getElementById(canvasId) as HTMLCanvasElement)
      : undefined

    if (canvas) return [canvas, false]

    canvas = document.createElement('canvas')
    canvas.className = 'vim-canvas'
    canvas.tabIndex = 0
    document.body.appendChild(canvas)
    return [canvas, true]
  }

  dispose () {
    this._unregisterResize?.()
    this._unregisterResize = undefined

    if (this._ownedCanvas) this.canvas.remove()
  }

  /**
   * Returns the pixel size of the parent element.
   */
  getParentSize () {
    return new THREE.Vector2(
      this.canvas.parentElement?.clientWidth ?? this.canvas.clientWidth,
      this.canvas.parentElement?.clientHeight ?? this.canvas.clientHeight
    )
  }

  /**
   * Returns the pixel size of the canvas.
   */
  getSize () {
    return new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight)
  }

  getAspectRatio () {
    const size = this.getParentSize()
    return size.x / size.y
  }

  onResize (callback: () => void) {
    this._resizeCallbacks.push(callback)
  }

  /**
   * Resizes canvas and update camera to match new parent dimensions.
   */
  ResizeToParent () {
    this._resizeCallbacks.forEach((cb) => cb())
  }

  /**
   * Set a callback for canvas resize with debouncing
   * https://stackoverflow.com/questions/5825447/javascript-event-for-canvas-resize/30688151
   * @param callback code to be called
   * @param timeout time after the last resize before code will be called
   */
  private registerResize (timeout: number) {
    let timerId: number | undefined
    const onResize = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
      timerId = setTimeout(() => {
        timerId = undefined
        this._resizeCallbacks.forEach((cb) => cb())
      }, timeout)
    }
    window.addEventListener('resize', onResize)
    this._unregisterResize = () =>
      window.removeEventListener('resize', onResize)
  }
}
