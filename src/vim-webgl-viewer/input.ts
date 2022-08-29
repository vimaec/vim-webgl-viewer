/**
 * @module viw-webgl-viewer
 */

import { Viewer } from './viewer'
import { KeyboardHandler, KEYS } from './keyboard'
import { TouchHandler } from './touch'
import { MouseHandler } from './mouse'
import { InputAction } from './raycaster'

export type PointerMode = 'orbit' | 'look' | 'pan' | 'dolly' | 'zone'

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

  private _mode: PointerMode
  private _altMode: PointerMode

  /**
   * Returns the last main mode (orbit, look) that was active.
   */
  get altPointerMode () {
    return this._altMode
  }

  /**
   * Returns current pointer mode.
   */
  get pointerMode () {
    return this._mode
  }

  /**
   * Changes pointer interaction mode. Look mode will set camera orbitMode to false.
   */
  set pointerMode (value: PointerMode) {
    if (value === this._mode) return

    if (value === 'look') this._altMode = 'orbit'
    else if (value === 'orbit') this._altMode = 'look'
    else this._altMode = this._mode

    this._viewer.camera.orbitMode = value !== 'look'
    this._mode = value
    this.onPointerModeChanged?.()
  }

  /**
   * Callback when pointer interaction mode changes.
   */
  onPointerModeChanged: (() => void) | undefined

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

  /**
   * Callback when mouse and camera have been idle for some time.
   * default behaviour with your custom logic.
   */
  onKeyAction: ((key: number) => boolean) | undefined

  constructor (viewer: Viewer) {
    this._viewer = viewer

    this.keyboard = new KeyboardHandler(viewer)
    this.mouse = new MouseHandler(viewer)
    this.touch = new TouchHandler(viewer)
    this.onMainAction = this.defaultAction
    this.onKeyAction = this.defaultKeyAction
    this.pointerMode = 'orbit'
    this._altMode = 'look'
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
  public defaultAction = (action: InputAction) => {
    const camera = this._viewer.camera
    const selection = this._viewer.selection

    if (!action?.object) {
      selection.select(undefined)
      if (action.type === 'double') {
        camera.frame('all', 'none', camera.defaultLerpDuration)
      }
      return
    }

    if (action.modifier !== 'none') {
      selection.toggle(action.object)
    } else {
      selection.select(action.object)
    }

    if (action.type === 'double') {
      camera.frame(action.object, 'none', camera.defaultLerpDuration)
    }

    action.object.getBimElement().then((e) => {
      e?.set('Index', action.object?.element)
      console.log(e)
    })
  }

  defaultKeyAction (key: number) {
    const camera = this._viewer.camera
    const selection = this._viewer.selection
    switch (key) {
      case KEYS.KEY_O:
        camera.orthographic = !camera.orthographic
        return true
      case KEYS.KEY_ADD:
      case KEYS.KEY_OEM_PLUS:
        camera.speed += 1
        return true
      case KEYS.KEY_SUBTRACT:
      case KEYS.KEY_OEM_MINUS:
        camera.speed -= 1
        return true
      case KEYS.KEY_F8:
      case KEYS.KEY_SPACE:
        this._viewer.inputs.pointerMode = this._viewer.inputs.altPointerMode
        return true
      case KEYS.KEY_HOME:
        camera.frame('all', 45, camera.defaultLerpDuration)
        return true
      // Selection
      case KEYS.KEY_ESCAPE:
        selection.clear()
        return true
      case KEYS.KEY_Z:
      case KEYS.KEY_F:
        if (selection.count > 0) {
          camera.frame(
            selection.getBoundingBox(),
            'center',
            camera.defaultLerpDuration
          )
        } else {
          camera.frame('all', 'center', camera.defaultLerpDuration)
        }
        return true
      default:
        return false
    }
  }
}
