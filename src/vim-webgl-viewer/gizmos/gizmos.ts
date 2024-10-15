import { Viewer } from '../viewer'
import { GizmoAxes } from './axes/gizmoAxes'
import { GizmoLoading } from './gizmoLoading'
import { GizmoOrbit } from './gizmoOrbit'
import { GizmoRectangle } from './gizmoRectangle'
import { IMeasure, Measure } from './measure/measure'
import { SectionBox } from './sectionBox/sectionBox'
import { GizmoMarkers } from './markers/gizmoMarkers'
import { Camera } from '../camera/camera'
import { Plans2D } from './plans2D'

/**
 * Represents a collection of gizmos used for various visualization and interaction purposes within the viewer.
 */
export class Gizmos {
  private readonly viewer: Viewer

  /**
   * The interface to start and manage measure tool interaction.
   */
  get measure () {
    return this._measure as IMeasure
  }

  private readonly _measure: Measure

  /**
   * The section box gizmo.
   */
  readonly section: SectionBox

  /**
   * The loading indicator gizmo.
   */
  readonly loading: GizmoLoading

  /**
   * The camera orbit target gizmo.
   */
  readonly orbit: GizmoOrbit

  /**
   * Rectangle Gizmo used for rectangle selection.
   */
  readonly rectangle: GizmoRectangle

  /**
   * The axis gizmos of the viewer.
   */
  readonly axes: GizmoAxes

  /**
   * The interface for adding and managing sprite markers in the scene.
   */
  readonly markers: GizmoMarkers

  readonly plans : Plans2D

  constructor (viewer: Viewer, camera : Camera) {
    this.viewer = viewer
    this._measure = new Measure(viewer)
    this.section = new SectionBox(viewer)
    this.loading = new GizmoLoading(viewer)
    this.orbit = new GizmoOrbit(
      viewer.renderer,
      camera,
      viewer.inputs,
      viewer.settings
    )
    this.rectangle = new GizmoRectangle(viewer)
    this.axes = new GizmoAxes(camera, viewer.viewport, viewer.settings.axes)
    this.markers = new GizmoMarkers(viewer)
    this.plans = new Plans2D(viewer)
    viewer.viewport.canvas.parentElement?.prepend(this.axes.canvas)
  }

  updateAfterCamera () {
    this.axes.update()
  }

  /**
   * Disposes of all gizmos.
   */
  dispose () {
    this.viewer.viewport.canvas.parentElement?.removeChild(this.axes.canvas)
    this._measure.clear()
    this.section.dispose()
    this.loading.dispose()
    this.orbit.dispose()
    this.rectangle.dispose()
    this.axes.dispose()
  }
}
