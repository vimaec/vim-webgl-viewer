import * as THREE from 'three'
import { MeshLine, MeshLineMaterial } from '../../../utils/meshLine'
import { Viewer } from '../../viewer'

/**
 * Wrapper for a two points line drawn using MeshLine
 */
class MeasureLine {
  mesh: THREE.Mesh
  private _meshLine: any
  private _material: any
  private _materialAlways: any

  constructor (canvasSize: THREE.Vector2, color: THREE.Color) {
    this._material = new MeshLineMaterial({
      sizeAttenuation: 0,
      lineWidth: 5,
      resolution: canvasSize,
      color: color
    })

    this._materialAlways = new MeshLineMaterial({
      lineWidth: 5,
      sizeAttenuation: 0,
      depthTest: false,
      transparent: true,
      opacity: 0.5,
      resolution: canvasSize,
      color: color
    })

    this._meshLine = new MeshLine()
    this.mesh = new THREE.Mesh(this._meshLine, [
      this._material,
      this._materialAlways
    ])
    this._meshLine.geometry.addGroup(0, Infinity, 0)
    this._meshLine.geometry.addGroup(0, Infinity, 1)
    this.mesh.frustumCulled = false
  }

  setPoints (start: THREE.Vector3, end: THREE.Vector3) {
    this._meshLine.setPoints([start, end])
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
  mesh: THREE.Mesh
  private _material: THREE.Material
  private _materialAlways: THREE.Material

  constructor (color: THREE.Color) {
    this._material = new THREE.MeshBasicMaterial({
      color: color
    })

    this._materialAlways = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      depthTest: false,
      color: new THREE.Color(0, 0.75, 1)
    })

    const g = new THREE.SphereGeometry(0.25)
    g.addGroup(0, Infinity, 0)
    g.addGroup(0, Infinity, 1)
    this.mesh = new THREE.Mesh(g, [this._material, this._materialAlways])
  }

  setPosition (position: THREE.Vector3) {
    this.mesh.position.copy(position)
  }

  dispose () {
    this.mesh.geometry.dispose()
    this._material.dispose()
  }
}

export class MeasureGizmo {
  private _viewer: Viewer
  private _startMarker: MeasureMarker
  private _endMarker: MeasureMarker
  private _line: MeasureLine
  private _lineX: MeasureLine
  private _lineY: MeasureLine
  private _lineZ: MeasureLine
  private _group: THREE.Group

  constructor (viewer: Viewer) {
    this._viewer = viewer
    const canvasSize = this._viewer.viewport.getSize()

    this._startMarker = new MeasureMarker(new THREE.Color('#FFB700'))
    this._endMarker = new MeasureMarker(new THREE.Color('#0590CC'))

    this._line = new MeasureLine(canvasSize, new THREE.Color(1, 1, 1))
    this._lineX = new MeasureLine(canvasSize, new THREE.Color(1, 0, 0))
    this._lineY = new MeasureLine(canvasSize, new THREE.Color(0, 1, 0))
    this._lineZ = new MeasureLine(canvasSize, new THREE.Color(0, 0, 1))

    this._group = new THREE.Group()
    this._group.name = 'GizmoMeasure'
    this._group.add(
      this._startMarker.mesh,
      this._endMarker.mesh,
      this._line.mesh,
      this._lineX.mesh,
      this._lineY.mesh,
      this._lineZ.mesh
    )

    this._viewer.renderer.add(this._group)
  }

  start (start: THREE.Vector3) {
    // Set start marker
    this._startMarker.setPosition(start)
  }

  hide () {
    if (this._line) this._line.mesh.visible = false
  }

  update (start: THREE.Vector3, pos: THREE.Vector3) {
    if (this._line) {
      this._line.setPoints(start, pos)
      this._line.mesh.visible = true
    }
  }

  finish (start: THREE.Vector3, end: THREE.Vector3) {
    this._line.mesh.visible = true

    // Set start marker
    this._startMarker.setPosition(start)

    // Set end marker
    this._endMarker.setPosition(end)

    // Compute measurement vector component
    const delta = end.clone().sub(start)
    const endX = start.clone().setX(start.x + delta.x)
    const endY = endX.clone().setY(endX.y + delta.y)

    // Add measurement lines meshes
    this._line.setPoints(start, end)
    this._lineX.setPoints(start, endX)
    this._lineY.setPoints(endX, endY)
    this._lineZ.setPoints(endY, end)
    return true
  }

  dispose () {
    this._viewer.renderer.remove(this._group)
    this._startMarker.dispose()
    this._endMarker.dispose()
    this._line.dispose()
    this._lineX.dispose()
    this._lineY.dispose()
    this._lineZ.dispose()
  }
}
