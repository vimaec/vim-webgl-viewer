/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
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
  private _touch: Touch
  private _mouse: Mouse
  private _keyboard: Keyboard

  private _unregistersTouch: Function[] = []
  private _unregistersMouse: Function[] = []
  private _unregistersKeyboard: Function[] = []

  constructor (viewer: Viewer) {
    this._canvas = viewer.viewport.canvas

    this._keyboard = new Keyboard(viewer)
    this._mouse = new Mouse(viewer, this._keyboard)
    this._touch = new Touch(viewer, this._mouse)
  }

  private reg = (
    // eslint-disable-next-line no-undef
    handler: DocumentAndElementEventHandlers,
    type: string,
    unregisters: Function[],
    listener: (event: any) => void
  ) => {
    handler.addEventListener(type, listener)
    unregisters.push(() => handler.removeEventListener(type, listener))
  }

  /**
   * Register inputs handlers for default viewer behavior
   */
  register () {
    this.registerKeyboard()
    this.registerMouse()
    this.registerTouch()
  }

  registerMouse () {
    if (this._unregistersMouse.length > 0) return

    // mouse
    this.reg(
      this._canvas,
      'mousedown',
      this._unregistersMouse,
      this._mouse.onMouseDown
    )
    this.reg(
      this._canvas,
      'wheel',
      this._unregistersMouse,
      this._mouse.onMouseWheel
    )
    this.reg(
      this._canvas,
      'mousemove',
      this._unregistersMouse,
      this._mouse.onMouseMove
    )
    this.reg(
      this._canvas,
      'mouseup',
      this._unregistersMouse,
      this._mouse.onMouseUp
    )
    this.reg(
      this._canvas,
      'mouseout',
      this._unregistersMouse,
      this._mouse.onMouseOut
    )
    this.reg(
      this._canvas,
      'dblclick',
      this._unregistersMouse,
      this._mouse.onDoubleClick
    )

    // Disable right click menu
    this.reg(this._canvas, 'contextmenu', this._unregistersMouse, (e) =>
      e.preventDefault()
    )
  }

  registerTouch () {
    if (this._unregistersTouch.length > 0) return

    this.reg(
      this._canvas,
      'touchstart',
      this._unregistersTouch,
      this._touch.onTouchStart
    )
    this.reg(
      this._canvas,
      'touchend',
      this._unregistersTouch,
      this._touch.onTouchEnd
    )
    this.reg(
      this._canvas,
      'touchmove',
      this._unregistersTouch,
      this._touch.onTouchMove
    )
  }

  registerKeyboard () {
    if (this._unregistersKeyboard.length > 0) return

    this.reg(
      document,
      'keydown',
      this._unregistersKeyboard,
      this._keyboard.onKeyDown
    )
    this.reg(
      document,
      'keyup',
      this._unregistersKeyboard,
      this._keyboard.onKeyUp
    )
  }

  /**
   * Unregisters all input handlers
   */
  unregister = () => {
    this.unregisterTouch()
    this.unregisterMouse()
    this.unregisterKeyboard()
  }

  unregisterTouch () {
    this._unregistersTouch.forEach((f) => f())
    this._unregistersTouch.length = 0
    this._touch.reset()
  }

  unregisterMouse () {
    this._unregistersMouse.forEach((f) => f())
    this._unregistersMouse.length = 0
    this._mouse.reset()
  }

  unregisterKeyboard () {
    this._unregistersKeyboard.forEach((f) => f())
    this._unregistersKeyboard.length = 0
    this._keyboard.reset()
  }

  /**
   * Resets all input state
   */
  reset () {
    this._touch.reset()
    this._mouse.reset()
    this._keyboard.reset()
  }
}
