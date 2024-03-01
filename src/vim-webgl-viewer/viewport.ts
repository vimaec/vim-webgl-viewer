/**
 @module viw-webgl-viewer
*/

import { SignalDispatcher } from 'ste-signals'
import * as THREE from 'three'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { Settings } from './viewerSettings'

export class Viewport {
  /**
   *  HTML Canvas on which the model is rendered
   */
  readonly canvas: HTMLCanvasElement
  /** HTML Element in which text is rendered */
  readonly textRenderer : CSS2DRenderer

  get text(){
    return this.textRenderer.domElement
  }

  private _unregisterResize: Function | undefined
  private _ownedCanvas: boolean
  private _onResize: SignalDispatcher = new SignalDispatcher()

  /**
   * Signal dispatched when the canvas is resized.
   */
  get onResize () {
    return this._onResize.asEvent()
  }

  /**
   * Constructs a new instance of the class with the provided settings.
   * @param {Settings} settings The settings object defining viewer configurations.
   */
  constructor (settings: Settings) {
    const { canvas, owned } = Viewport.getOrCreateCanvas(settings.canvas.id)
    this.canvas = canvas
    this.textRenderer = this.createTextRenderer()
    this._ownedCanvas = owned
    this.watchResize(settings.canvas.resizeDelay)
  }

  /**
   * Either returns html canvas at provided Id or creates a canvas at root level
   */
  private static getOrCreateCanvas (canvasId?: string) {
    const canvas = canvasId
      ? (document.getElementById(canvasId) as HTMLCanvasElement)
      : undefined

    return canvas
      ? { canvas, owned: false }
      : { canvas: this.createCanvas(), owned: true }
  }

  private static createCanvas () {
    const canvas = document.createElement('canvas')
    canvas.className = 'vim-canvas'
    canvas.tabIndex = 0
    canvas.style.backgroundColor = 'black'
    document.body.appendChild(canvas)
    return canvas
  }

  /** Returns a text renderer that will render html in an html element sibbling to canvas */
  private createTextRenderer () {
    if (!this.canvas.parentElement) {
      throw new Error('Cannot create text renderer without a canvas')
    }

    const size = this.getParentSize()
    const renderer = new CSS2DRenderer()
    renderer.setSize(size.x, size.y)
    const text = renderer.domElement

    text.className = 'vim-text-renderer'
    text.style.position = 'absolute'
    text.style.top = '0px'
    text.style.pointerEvents = 'none'
    this.canvas.parentElement.append(text)
    return renderer
  }

  /**
   * Removes the canvas if it's owned by the viewer.
   */
  dispose () {
    this._unregisterResize?.()
    this._unregisterResize = undefined

    if (this._ownedCanvas) this.canvas.remove()
  }

  /**
   * Returns the pixel size of the parent element.
   * @returns {THREE.Vector2} The pixel size of the parent element.
   */
  getParentSize () {
    return new THREE.Vector2(
      this.canvas.parentElement?.clientWidth ?? this.canvas.clientWidth,
      this.canvas.parentElement?.clientHeight ?? this.canvas.clientHeight
    )
  }

  /**
   * Returns the pixel size of the canvas.
   * @returns {THREE.Vector2} The pixel size of the canvas.
   */
  getSize () {
    return new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight)
  }

  /**
   * Calculates and returns the aspect ratio of the parent element.
   * @returns {number} The aspect ratio (width divided by height) of the parent element.
   */
  getAspectRatio () {
    const size = this.getParentSize()
    return size.x / size.y
  }

  /**
   * Resizes the canvas and updates the camera to match new parent dimensions.
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
