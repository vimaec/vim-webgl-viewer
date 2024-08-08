/**
 @module viw-webgl-viewer/gizmos/sectionBox
*/

import { Viewer } from '../viewer'

/**
 * The loading indicator gizmo.
 */
export class GizmoLoading {
  // dependencies
  private _viewer: Viewer
  private _spinner: HTMLElement
  private _visible: boolean

  constructor (viewer: Viewer) {
    this._viewer = viewer
    this._spinner = this.createBar()
    this._visible = false
  }

  private createBar () {
    const div = document.createElement('span')
    div.className = 'loader'
    return div
  }

  /**
   * Indicates whether the loading gizmo will be rendered.
   */
  get visible () {
    return this._visible
  }

  set visible (value: boolean) {
    if (!this._visible && value) {
      this._viewer.viewport.canvas.parentElement.appendChild(this._spinner)
      this._visible = true
    }
    if (this._visible && !value) {
      this._spinner.parentElement.removeChild(this._spinner)
      this._visible = false
    }
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this.visible = false
  }
}
