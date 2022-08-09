/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
import { KeyboardHandler } from './keyboard'
import { TouchHandler } from './touch'
import { MouseHandler } from './mouse'
import { RaycastResult } from './raycaster'

/**
 * Manages and registers all viewer user inputs for mouse, keyboard and touch
 */
export class Input {
  // Dependencies
  private _canvas: HTMLCanvasElement

  // State
  touch: TouchHandler
  mouse: MouseHandler
  keyboard: KeyboardHandler

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  onMainAction: (hit: RaycastResult) => {} | undefined

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  onIdle: (hit: RaycastResult) => {} | undefined

  constructor (viewer: Viewer) {
    this._canvas = viewer.viewport.canvas

    this.keyboard = new KeyboardHandler(viewer)
    this.mouse = new MouseHandler(viewer)
    this.touch = new TouchHandler(viewer)
  }

  /**
   * Register inputs handlers for default viewer behavior
   */
  registerAll () {
    this.keyboard.register()
    this.mouse.register()
    this.touch.register()
  }

  /**
   * Unregisters all input handlers
   */
  unregisterAll = () => {
    this.mouse.unregister()
    this.keyboard.unregister()
    this.touch.unregister()
  }

  /**
   * Resets all input state
   */
  resetAll () {
    this.mouse.reset()
    this.keyboard.reset()
    this.touch.reset()
  }
}
