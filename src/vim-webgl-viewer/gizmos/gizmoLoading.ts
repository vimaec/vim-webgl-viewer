/**
 @module viw-webgl-viewer/gizmos/sectionBox
*/

import { Viewer } from '../viewer'

/**
 * Gizmo for section box, it acts as a proxy between renderer and user.
 */
export class GizmoLoading {
  // dependencies
  private _viewer: Viewer
  private _spinner: HTMLElement
  private _visible: boolean

  constructor (viewer: Viewer) {
    this._viewer = viewer
    // this._spinner = this.createSpinner()
    this._spinner = this.createBar()
    this._viewer.viewport.canvas.parentElement.appendChild(this._spinner)
  }

  private createSpinner () {
    const div = document.createElement('div')
    div.className = 'lds-roller'
    for (let i = 0; i < 8; i++) {
      div.appendChild(document.createElement('div'))
    }
    return div
  }

  private createBar () {
    const div = document.createElement('span')
    div.className = 'loader'
    return div
  }

  /**
   * When true the loading gizmo will be rendered
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
      this._viewer.viewport.canvas.parentElement.removeChild(this._spinner)
      this._visible = false
    }
  }

  /** Removes gizmo from rendering and inputs and dispose all resources. */
  dispose () {
    this.visible = false
  }
}
