/**
 @module viw-webgl-viewer
*/

import { SignalDispatcher } from 'ste-signals'
import * as THREE from 'three'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { ViewerConfig } from './viewerSettings'

export class Viewport {
  /** HTML Canvas on which the model is rendered */
  canvas: HTMLCanvasElement
  /** HTML Element in which text is rendered */
  text: HTMLElement | undefined

  private _unregisterResize: Function | undefined
  private _ownedCanvas: boolean
  private _onResize: SignalDispatcher = new SignalDispatcher()

  get onResize () {
    return this._onResize.asEvent()
  }

  constructor (settings: ViewerConfig) {
    const [canvas, owned] = Viewport.getOrCreateCanvas(settings.canvas.id)
    this.canvas = canvas
    this._ownedCanvas = owned
    this.watchResize(settings.canvas.resizeDelay)
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

  /** Returns a text renderer that will render html in an html element sibbling to canvas */
  createTextRenderer () {
    if (!this.canvas.parentElement) {
      throw new Error('Cannot create text renderer without a canvas')
    }

    const size = this.getParentSize()
    const renderer = new CSS2DRenderer()
    renderer.setSize(size.x, size.y)
    this.text = renderer.domElement

    this.text.className = 'vim-text-renderer'
    this.text.style.position = 'absolute'
    this.text.style.top = '0px'
    this.text.style.pointerEvents = 'none'
    this.canvas.parentElement.append(this.text)
    return renderer
  }

  /** Removes canvas if owned */
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

  /** Returns x/y of the parent size */
  getAspectRatio () {
    const size = this.getParentSize()
    return size.x / size.y
  }

  /**
   * Resizes canvas and update camera to match new parent dimensions.
   */
  ResizeToParent () {
    this._onResize.dispatch()
  }

  /**
   * Set a callback for canvas resize with debouncing
   * https://stackoverflow.com/questions/5825447/javascript-event-for-canvas-resize/30688151
   * @param callback code to be called
   * @param timeout time after the last resize before code will be called
   */
  private watchResize (timeout: number) {
    let timerId: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
      timerId = setTimeout(() => {
        timerId = undefined
        this._onResize.dispatch()
      }, timeout)
    }
    window.addEventListener('resize', onResize)

    this._unregisterResize = () =>
      window.removeEventListener('resize', onResize)
  }
}
