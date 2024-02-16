import { Viewer } from '../viewer'
import { GizmoAxes } from './gizmoAxes'
import { GizmoGrid, Grid } from './gizmoGrid'
import { GizmoLoading } from './gizmoLoading'
import { GizmoOrbit } from './gizmoOrbit'
import { GizmoRectangle } from './gizmoRectangle'
import { Measure } from './measure/measure'
import { SectionBox } from './sectionBox/sectionBox'
import { GizmoMarkers } from './markers/gizmoMarkers'

export class Gizmos {
  viewer: Viewer
  measure: Measure
  section: SectionBox
  loading: GizmoLoading
  grid: GizmoGrid
  orbit: GizmoOrbit
  rectangle: GizmoRectangle
  axes: GizmoAxes
  markers: GizmoMarkers

  constructor (viewer: Viewer) {
    this.viewer = viewer
    this.measure = new Measure(viewer)
    this.section = new SectionBox(viewer)
    this.loading = new GizmoLoading(viewer)
    this.grid = new GizmoGrid(viewer.renderer, viewer.materials)
    this.orbit = new GizmoOrbit(
      viewer.renderer,
      viewer.camera,
      viewer.inputs,
      viewer.settings
    )
    this.rectangle = new GizmoRectangle(viewer)
    this.axes = new GizmoAxes(viewer.camera, viewer.settings.axes)
    this.markers = new GizmoMarkers(viewer)
    viewer.viewport.canvas.parentElement?.prepend(this.axes.canvas)
  }

  dispose () {
    this.viewer.viewport.canvas.parentElement?.removeChild(this.axes.canvas)
    this.measure.clear()
    this.section.dispose()
    this.loading.dispose()
    this.grid.dispose()
    this.orbit.dispose()
    this.rectangle.dispose()
    this.axes.dispose()
  }
}
