/**
 @module viw-webgl-viewer/gizmos/measure
*/

import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { MeshLine, MeshLineMaterial } from '../../../utils/meshLine'
import { Viewer } from '../../viewer'
import {
  createMeasureElement,
  MeasureStyle,
  MeasureElement
} from './measureHtml'
import { Camera } from '../../camera/camera'

/**
 * Wrapper for a two points line drawn using MeshLine
 */
class MeasureLine {
  mesh: THREE.Mesh
  label: CSS2DObject
  position: THREE.Vector3 | undefined
  length: number | undefined
  private _meshLine: any
  private _material: any
  private _materialAlways: any
  private _text: HTMLElement | undefined

  constructor (
    canvasSize: THREE.Vector2,
    color: THREE.Color,
    style: MeasureStyle
  ) {
    this._material = new MeshLineMaterial({
      sizeAttenuation: 0,
      lineWidth: 5,
      resolution: canvasSize,
      color
    })

    this._materialAlways = new MeshLineMaterial({
      lineWidth: 5,
      sizeAttenuation: 0,
      depthTest: false,
      transparent: true,
      opacity: 0.5,
      resolution: canvasSize,
      color
    })

    this._meshLine = new MeshLine()
    this.mesh = new THREE.Mesh(this._meshLine, [
      this._material,
      this._materialAlways
    ])

    const element = createMeasureElement(style)
    if (element.value) this._text = element.value
    this.label = new CSS2DObject(element.div)
    this.label.visible = false

    this._meshLine.geometry.addGroup(0, Infinity, 0)
    this._meshLine.geometry.addGroup(0, Infinity, 1)
    this.mesh.frustumCulled = false
  }

  setPoints (start: THREE.Vector3, end: THREE.Vector3) {
    this.position = start.clone().add(end).multiplyScalar(0.5)

    this._meshLine.setPoints([start, end])
    this.label.position.copy(this.position)

    this.length = start.distanceTo(end)
    this.label.visible = this.length > 0
    if (this._text) {
      this._text.textContent = `~${start.distanceTo(end).toFixed(2)}`
    }
  }

  dispose () {
    this._meshLine.dispose()
    this._material.dispose()
    this._materialAlways.dispose()
  }
}

/**
 * Markers meshes used for measure endpoints
 */
class MeasureMarker {
  readonly MARKER_SIZE = 0.01
  mesh: THREE.Mesh
  private _material: THREE.Material
  private _materialAlways: THREE.Material
  private _camera: Camera
  private disconnect: () => void

  constructor (color: THREE.Color, camera: Camera, viewer: Viewer) {
    this._material = new THREE.MeshBasicMaterial({
      color
    })

    this._materialAlways = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      depthTest: false,
      color: new THREE.Color(0, 0.75, 1)
    })

    const g = new THREE.SphereGeometry(1)
    g.addGroup(0, Infinity, 0)
    g.addGroup(0, Infinity, 1)
    this.mesh = new THREE.Mesh(g, [this._material, this._materialAlways])
    this.mesh.visible = false

    this.disconnect = camera.onMoved.subscribe(() => this.updateScale())
    this._camera = camera
    this.updateScale()
  }

  updateScale () {
    const scale =
      this._camera.frustrumSizeAt(this.mesh.position).y * this.MARKER_SIZE
    this.mesh.scale.set(scale, scale, scale)
    this.mesh.updateMatrix()
  }

  setPosition (position: THREE.Vector3) {
    this.mesh.position.copy(position)
    this.updateScale()
  }

  dispose () {
    this.mesh.geometry.dispose()
    this._material.dispose()
    this.disconnect()
  }
}

/**
 * Reprents all graphical elements associated with a measure.
 */
export class MeasureGizmo {
  private _viewer: Viewer
  private _startMarker: MeasureMarker
  private _endMarker: MeasureMarker
  private _line: MeasureLine
  private _lineX: MeasureLine
  private _lineY: MeasureLine
  private _lineZ: MeasureLine
  private _group: THREE.Group
  private _label: CSS2DObject
  private _html: MeasureElement
  private _animId: number | undefined

  constructor (viewer: Viewer) {
    this._viewer = viewer
    const canvasSize = this._viewer.viewport.getSize()

    this._startMarker = new MeasureMarker(
      new THREE.Color('#FFB700'),
      this._viewer.camera,
      this._viewer
    )
    this._endMarker = new MeasureMarker(
      new THREE.Color('#0590CC'),
      this._viewer.camera,
      this._viewer
    )

    this._line = new MeasureLine(canvasSize, new THREE.Color(1, 1, 1), 'Dist')
    this._lineX = new MeasureLine(canvasSize, new THREE.Color(1, 0, 0), 'X')
    this._lineY = new MeasureLine(canvasSize, new THREE.Color(0, 1, 0), 'Y')
    this._lineZ = new MeasureLine(canvasSize, new THREE.Color(0, 0, 1), 'Z')

    this._html = createMeasureElement('all')
    this._label = new CSS2DObject(this._html.div)
    this._label.visible = false

    this._group = new THREE.Group()
    this._group.name = 'GizmoMeasure'
    this._group.add(
      this._startMarker.mesh,
      this._endMarker.mesh,
      this._line.mesh,
      this._line.label,
      this._lineX.mesh,
      this._lineX.label,
      this._lineY.mesh,
      this._lineY.label,
      this._lineZ.mesh,
      this._lineZ.label,
      this._label
    )

    this._viewer.renderer.add(this._group)
    this._viewer.renderer.textEnabled = true
  }

  private _animate () {
    this._animId = requestAnimationFrame(() => this._animate())

    const lx = this.screenDist(this._line.position, this._lineX.position)
    const ly = this.screenDist(this._line.position, this._lineY.position)
    const lz = this.screenDist(this._line.position, this._lineZ.position)
    const xy = this.screenDist(this._lineX.position, this._lineY.position)
    const xz = this.screenDist(this._lineX.position, this._lineZ.position)
    const yz = this.screenDist(this._lineY.position, this._lineZ.position)

    let conflicts = 0
    if (lx !== undefined && lx < 0.1) conflicts++
    if (ly !== undefined && ly < 0.1) conflicts++
    if (lz !== undefined && lz < 0.1) conflicts++
    if (xy !== undefined && xy < 0.1) conflicts++
    if (xz !== undefined && xz < 0.1) conflicts++
    if (yz !== undefined && yz < 0.1) conflicts++

    const collapse = conflicts > 1
    this._label.visible = collapse
    this._line.label.visible = !collapse
    this._lineX.label.visible = !collapse
    this._lineY.label.visible = !collapse
    this._lineZ.label.visible = !collapse
  }

  private screenDist (
    first: THREE.Vector3 | undefined,
    second: THREE.Vector3 | undefined
  ) {
    if (!first || !second) return
    const length = first.distanceTo(second)
    const ratio = length / this._viewer.camera.frustrumSizeAt(first).y
    return ratio
  }

  /**
   * Sets up a new measure
   */
  start (start: THREE.Vector3) {
    // Set start marker
    this._startMarker.setPosition(start)
    this._startMarker.mesh.visible = true
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Hides existing measure.
   */
  hide () {
    if (this._line) {
      this._line.mesh.visible = false
      this._line.label.visible = false
    }
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Updates current measure
   */
  update (start: THREE.Vector3, pos: THREE.Vector3) {
    if (this._line) {
      this._line.setPoints(start, pos)
      this._line.mesh.visible = true
    }
    this._viewer.renderer.needsUpdate = true
  }

  /**
   * Finishes current measure.
   */
  finish (start: THREE.Vector3, end: THREE.Vector3) {
    this._line.mesh.visible = true

    // Set start marker
    this._startMarker.setPosition(start)

    // Set end marker
    this._endMarker.setPosition(end)
    this._endMarker.mesh.visible = true

    // Compute measurement vector component
    const delta = end.clone().sub(start)
    const endX = start.clone().setX(start.x + delta.x)
    const endY = endX.clone().setY(endX.y + delta.y)

    // Add measurement lines meshes
    this._line.setPoints(start, end)
    this._lineX.setPoints(start, endX)
    this._lineY.setPoints(endX, endY)
    this._lineZ.setPoints(endY, end)

    // Set Measurement labels in case of collapse
    this._label.position.copy(this._line.label.position)
    if (this._html.values.dist) {
      this._html.values.dist.textContent = this._line.length?.toFixed(2) ?? ''
    }
    if (this._html.values.x) {
      this._html.values.x.textContent = this._lineX.length?.toFixed(2) ?? ''
    }
    if (this._html.values.y) {
      this._html.values.y.textContent = this._lineY.length?.toFixed(2) ?? ''
    }
    if (this._html.values.z) {
      this._html.values.z.textContent = this._lineZ.length?.toFixed(2) ?? ''
    }

    // Start update of collapse.
    this._animate()
    this._viewer.renderer.needsUpdate = true
    return true
  }

  /**
   * Disposes all resources.
   */
  dispose () {
    if (this._animId !== undefined) cancelAnimationFrame(this._animId)
    // A quirk of css2d object is they need to be removed individually.
    this._group.remove(this._label)
    this._group.remove(this._line.label)
    this._group.remove(this._lineX.label)
    this._group.remove(this._lineY.label)
    this._group.remove(this._lineZ.label)

    this._viewer.renderer.remove(this._group)

    this._startMarker.dispose()
    this._endMarker.dispose()
    this._line.dispose()
    this._lineX.dispose()
    this._lineY.dispose()
    this._lineZ.dispose()
    this._viewer.renderer.textEnabled = false
  }
}
