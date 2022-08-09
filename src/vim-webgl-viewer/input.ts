/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
import { KeyboardHandler } from './keyboard'
import { TouchHandler } from './touch'
import { MouseHandler } from './mouse'
import { InputAction } from './raycaster'

/**
 * Manages and registers all viewer user inputs for mouse, keyboard and touch
 */
export class Input {
  // Dependencies
  private _viewer: Viewer

  /**
   * Touch input handler
   */
  touch: TouchHandler
  /**
   * Mouse input handler
   */
  mouse: MouseHandler
  /**
   * Keyboard input handler
   */
  keyboard: KeyboardHandler

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  onMainAction: ((hit: InputAction) => void) | undefined

  /**
   * Callback when mouse and camera have been idle for some time.
   * default behaviour with your custom logic.
   */
  onIdleAction: ((hit: InputAction) => void) | undefined

  constructor (viewer: Viewer) {
    this._viewer = viewer

    this.keyboard = new KeyboardHandler(viewer)
    this.mouse = new MouseHandler(viewer)
    this.touch = new TouchHandler(viewer)
    this.onMainAction = this.defaultAction
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

  /**
   * Default action behaviour on mouse click or touch tap.
   */
  public defaultAction (action: InputAction) {
    const camera = this._viewer.camera
    const selection = this._viewer.selection

    console.log(action)
    if (!action?.object) {
      selection.select(undefined)
      if (action.type === 'double') {
        camera.frame('all', false, camera.defaultLerpDuration)
      }
      return
    }

    selection.select(action.object)

    if (action.type === 'double') {
      camera.frame(action.object, false, camera.defaultLerpDuration)
    }

    action.object.getBimElement().then((e) => {
      e.set('Index', action.object.element)
      console.log(e)
    })
  }
}
