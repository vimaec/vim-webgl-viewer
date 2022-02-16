/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
import { Keyboard } from './keyboard'
import { InputTouch } from './touch'
import { Mouse } from './mouse'

/**
 * Manages and registers all viewer user inputs for mouse, keyboard and touch
 */
export class Input {
  // Dependencies
  private canvas: HTMLCanvasElement

  // State
  private unregisters: Function[]
  private touch: InputTouch
  private mouse: Mouse
  private keyboard: Keyboard

  constructor (viewer: Viewer) {
    this.canvas = viewer.renderer.canvas
    this.unregisters = []

    this.keyboard = new Keyboard(viewer.camera, viewer)
    this.mouse = new Mouse(viewer, this.keyboard)
    this.touch = new InputTouch(viewer.camera, viewer.renderer, this.mouse)
  }

  private reg = (
    // eslint-disable-next-line no-undef
    handler: DocumentAndElementEventHandlers,
    type: string,
    listener: (event: any) => void
  ) => {
    handler.addEventListener(type, listener)
    this.unregisters.push(() => handler.removeEventListener(type, listener))
  }

  register () {
    // mouse
    this.reg(this.canvas, 'mousedown', this.mouse.onMouseDown)
    this.reg(this.canvas, 'wheel', this.mouse.onMouseWheel)
    this.reg(this.canvas, 'mousemove', this.mouse.onMouseMove)
    this.reg(this.canvas, 'mouseup', this.mouse.onMouseUp)
    this.reg(this.canvas, 'mouseout', this.mouse.onMouseOut)
    this.reg(this.canvas, 'dblclick', this.mouse.onDoubleClick)

    // touch
    this.reg(this.canvas, 'touchstart', this.touch.onTouchStart)
    this.reg(this.canvas, 'touchend', this.touch.onTouchEnd)
    this.reg(this.canvas, 'touchmove', this.touch.onTouchMove)

    // keys
    this.reg(document, 'keydown', this.keyboard.onKeyDown)
    this.reg(document, 'keyup', this.keyboard.onKeyUp)

    // Disable right click menu
    this.reg(this.canvas, 'contextmenu', (e) => e.preventDefault())
  }

  unregister = () => {
    this.unregisters.forEach((f) => f())
    this.reset()
  }

  reset () {
    this.mouse.reset()
    this.keyboard.reset()
    this.touch.reset()
  }
}
