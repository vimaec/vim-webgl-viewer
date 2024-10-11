/**
 @module viw-webgl-viewer/gizmos/sectionBox
*/

import { Viewer } from '../../viewer'
import * as THREE from 'three'
import { BoxMesh, BoxOutline, BoxHighlight } from './sectionBoxGizmo'
import { BoxInputs } from './sectionBoxInputs'
import { SignalDispatcher } from 'ste-signals'
import { SimpleEventDispatcher } from 'ste-simple-events'

/**
 * Gizmo for section box, serving as a proxy between the renderer and the user.
 */
export class SectionBox {
  // dependencies
  private _viewer: Viewer

  // resources
  private _inputs: BoxInputs
  private _cube: BoxMesh
  private _outline: BoxOutline
  private _highlight: BoxHighlight

  // State
  private _normal: THREE.Vector3
  private _clip: boolean | undefined = undefined
  private _visible: boolean | undefined = undefined
  private _interactive: boolean | undefined = undefined

  private _onStateChanged = new SignalDispatcher()
  private _onBoxConfirm = new SimpleEventDispatcher<THREE.Box3>()
  private _onHover = new SimpleEventDispatcher<boolean>()

  /**
   * Signal dispatched when clip, show, or interactive are updated.
   */
  get onStateChanged () {
    return this._onStateChanged.asEvent()
  }

  /**
   * Signal dispatched when user is done manipulating the box.
   */
  get onBoxConfirm () {
    return this._onBoxConfirm.asEvent()
  }

  /**
   * Signal dispatched with true when pointer enters box and false when pointer leaves.
   */
  get onHover () {
    return this._onHover.asEvent()
  }

  private get renderer () {
    return this._viewer.renderer
  }

  private get section () {
    return this._viewer.renderer.section
  }

  constructor (viewer: Viewer) {
    this._viewer = viewer

    this._normal = new THREE.Vector3()

    this._cube = new BoxMesh()
    this._outline = new BoxOutline()
    this._highlight = new BoxHighlight()

    this.renderer.add(this._cube)
    this.renderer.add(this._outline)
    this.renderer.add(this._highlight)

    this._inputs = new BoxInputs(
      viewer,
      this._cube,
      this._viewer.renderer.section.box
    )
    this._inputs.onFaceEnter = (normal) => {
      this._normal = normal
      if (this.visible) this._highlight.highlight(this.section.box, normal)
      this._onHover.dispatch(normal.x !== 0 || normal.y !== 0 || normal.z !== 0)
      this.renderer.needsUpdate = true
    }

    this._inputs.onBoxStretch = (box) => {
      this.renderer.section.fitBox(box)
      this.update()
    }
    this._inputs.onBoxConfirm = (box) => this._onBoxConfirm.dispatch(box)

    this.clip = false
    this.visible = false
    this.interactive = false
    this.update()
  }

  /**
   * Section bounding box, to update the box use fitBox.
   */
  get box () {
    return this.section.box
  }

  /**
   * Determines whether the section gizmo will section the model with clipping planes.
   */
  get clip () {
    return this._clip ?? false
  }

  set clip (value: boolean) {
    if (value === this._clip) return
    this._clip = value
    this.renderer.section.active = value
    this._onStateChanged.dispatch()
  }

  /**
   * Determines whether the gizmo reacts to user inputs.
   */
  get interactive () {
    return this._interactive ?? false
  }

  set interactive (value: boolean) {
    if (value === this._interactive) return
    if (!this._interactive && value) this._inputs.register()
    if (this._interactive && !value) this._inputs.unregister()
    this._interactive = value
    this._highlight.visible = false
    this.renderer.needsUpdate = true
    this._onStateChanged.dispatch()
  }

  /**
   * Determines whether the gizmo will be rendered.
   */
  get visible () {
    return this._visible ?? false
  }

  set visible (value: boolean) {
    if (value === this._visible) return
    this._visible = value
    this._cube.visible = value
    this._outline.visible = value
    this._highlight.visible = value
    if (value) this.update()
    this.renderer.needsUpdate = true
    this._onStateChanged.dispatch()
  }

  /**
   * Sets the section gizmo size to match the given box.
   * @param {THREE.Box3} box - The box to match the section gizmo size to.
   * @param {number} [padding=1] - The padding to apply to the box.
   */
  public fitBox (box: THREE.Box3, padding = 1) {
    if (!box) return
    const b = box.expandByScalar(padding)
    this._cube.fitBox(b)
    this._outline.fitBox(b)
    this.renderer.section.fitBox(b)
    this._onBoxConfirm.dispatch(this.box)
    this.renderer.needsUpdate = true
  }

  /**
   * Call this if there were direct changes to renderer.section
   */
  update () {
    this.fitBox(this.section.box, 0)
    this._highlight.highlight(this.section.box, this._normal)
    this.renderer.needsUpdate = true
  }

  /**
   * Removes gizmo from rendering and inputs and dispose all resources.
   */
  dispose () {
    this.renderer.remove(this._cube)
    this.renderer.remove(this._outline)
    this.renderer.remove(this._highlight)

    this._inputs.unregister()
    this._cube.dispose()
    this._outline.dispose()
    this._highlight.dispose()
  }
}
