import { Viewer } from '../../viewer'
import * as THREE from 'three'
import { BoxMesh, BoxOutline, BoxHighlight } from './sectionBoxGizmo'
import { BoxInputs } from './sectionBoxInputs'
import { SignalDispatcher } from 'ste-signals'
import { SimpleEventDispatcher } from 'ste-simple-events'

/**
 * Gizmo for section box, it acts as a proxy between renderer and user.
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
  private _clip: boolean
  private _show: boolean
  private _interactive: boolean

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
   * When true the section gizmo will section the model with clipping planes.
   */
  get clip () {
    return this._clip
  }

  set clip (value: boolean) {
    if (value === this._clip) return
    this._clip = value
    this.renderer.section.active = value
    this._onStateChanged.dispatch()
  }

  /**
   * When true the section gizmo will react to user inputs.
   */
  get interactive () {
    return this._interactive
  }

  set interactive (value: boolean) {
    if (value === this.interactive) return
    if (!this._interactive && value) this._inputs.register()
    if (this._interactive && !value) this._inputs.unregister()
    this._interactive = value
    this._highlight.visible = false
    this._onStateChanged.dispatch()
  }

  /**
   * When true the section gizmo will be rendered.
   */
  get visible () {
    return this._show
  }

  set visible (value: boolean) {
    if (value === this.visible) return
    this._show = value
    this._cube.visible = value
    this._outline.visible = value
    this._highlight.visible = value
    if (value) this.update()
    this._onStateChanged.dispatch()
  }

  /**
   * Sets the section gizmo size to match given box
   */
  public fitBox (box: THREE.Box3) {
    this._cube.fitBox(box)
    this._outline.fitBox(box)
    this.renderer.section.fitBox(box)
    this._onBoxConfirm.dispatch(this.box)
  }

  /**
   * Call this if there were direct changes to renderer.section
   */
  update () {
    this.fitBox(this.section.box)
    this._highlight.highlight(this.section.box, this._normal)
  }

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