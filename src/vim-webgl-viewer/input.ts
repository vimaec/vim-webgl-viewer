/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
import { Camera } from './camera'
import { Keyboard } from './keyboard'
import { Touch } from './touch'
import { Mouse } from './mouse'

/**
 * Manages and registers all viewer user inputs for mouse, keyboard and touch
 */
export class Input {
  // Dependencies
  private _canvas: HTMLCanvasElement

  // State
  private _unregisters: Function[]
  private _touch: Touch
  private _mouse: Mouse
  private _keyboard: Keyboard

  constructor (viewer: Viewer, camera: Camera) {
    this._canvas = viewer.viewport.canvas
    this._unregisters = []

    this._keyboard = new Keyboard(camera, viewer.selection)
    this._mouse = new Mouse(viewer, this._keyboard)
    this._touch = new Touch(camera, viewer.viewport, this._mouse)
  }

  private reg = (
    // eslint-disable-next-line no-undef
    handler: DocumentAndElementEventHandlers,
    type: string,
    listener: (event: any) => void
  ) => {
    handler.addEventListener(type, listener)
    this._unregisters.push(() => handler.removeEventListener(type, listener))
  }

  /**
   * Register inputs handlers for default viewer behavior
   */
  register () {
    // mouse
    this.reg(this._canvas, 'mousedown', this._mouse.onMouseDown)
    this.reg(this._canvas, 'wheel', this._mouse.onMouseWheel)
    this.reg(this._canvas, 'mousemove', this._mouse.onMouseMove)
    this.reg(this._canvas, 'mouseup', this._mouse.onMouseUp)
    this.reg(this._canvas, 'mouseout', this._mouse.onMouseOut)
    this.reg(this._canvas, 'dblclick', this._mouse.onDoubleClick)

    // touch
    this.reg(this._canvas, 'touchstart', this._touch.onTouchStart)
    this.reg(this._canvas, 'touchend', this._touch.onTouchEnd)
    this.reg(this._canvas, 'touchmove', this._touch.onTouchMove)

    // keys
    this.reg(document, 'keydown', this._keyboard.onKeyDown)
    this.reg(document, 'keyup', this._keyboard.onKeyUp)

    // Disable right click menu
    this.reg(this._canvas, 'contextmenu', (e) => e.preventDefault())
  }

  /**
   * Unregisters all input handlers
   */
  unregister = () => {
    this._unregisters.forEach((f) => f())
    this.reset()
  }

  /**
   * Resets all input state
   */
  reset () {
    this._mouse.reset()
    this._keyboard.reset()
    this._touch.reset()
  }
}
