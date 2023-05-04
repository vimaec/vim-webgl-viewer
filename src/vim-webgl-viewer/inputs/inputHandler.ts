/**
 * @module viw-webgl-viewer/inputs
 */

import { Viewer } from '../viewer'

/**
 * Base class for various input handlers.
 * It provides convenience to register to and unregister from events.
 */
export class InputHandler {
  protected _viewer: Viewer
  protected _unregisters: Function[] = []

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  protected reg = (
    // eslint-disable-next-line no-undef
    handler: DocumentAndElementEventHandlers | Window,
    type: string,
    listener: (event: any) => void
  ) => {
    handler.addEventListener(type, listener)
    this._unregisters.push(() => handler.removeEventListener(type, listener))
  }

  /**
   * Register handler to related browser events
   * Prevents double registrations
   */
  register () {
    if (this._unregisters.length > 0) return
    this.addListeners()
  }

  protected addListeners () {}

  /**
   * Unregister handler from related browser events
   * Prevents double unregistration
   */
  unregister () {
    this._unregisters.forEach((f) => f())
    this._unregisters.length = 0
    this.reset()
  }

  /**
   * Reset handler states such as button down, drag, etc.
   */
  reset () {}
}
