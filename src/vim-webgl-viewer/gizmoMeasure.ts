/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { HitTestResult } from '../vim'
import { Viewer } from './viewer'
import * as ML from 'three.meshline'
import { Vector2 } from 'three'

/**
 * Wrapper for a two points line drawn using MeshLine
 */
class MeasureLine {
  mesh: THREE.Mesh
  private _meshLine: any
  private _material: any
  private _materialAlways: any

  constructor (
    canvasSize: THREE.Vector2,
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: THREE.Color
  ) {
    this._material = new ML.MeshLineMaterial({
      sizeAttenuation: 0,
      lineWidth: 5,
      resolution: canvasSize,
      color: color
    })

    this._materialAlways = new ML.MeshLineMaterial({
      lineWidth: 5,
      sizeAttenuation: 0,
      depthTest: false,
      transparent: true,
      opacity: 0.5,
      resolution: canvasSize,
      color: color
    })

    this._meshLine = new ML.MeshLine()
    this._meshLine.setPoints([start, end])
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

  constructor (position: THREE.Vector3 = new THREE.Vector3()) {
    this._material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0, 0.75, 1)
    })

    this._materialAlways = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      depthTest: false,
      color: new THREE.Color(0, 0.75, 1)
    })

    const g = new THREE.SphereGeometry(0.75)
    g.addGroup(0, Infinity, 0)
    g.addGroup(0, Infinity, 1)
    this.mesh = new THREE.Mesh(g, [this._material, this._materialAlways])
    this.mesh.position.copy(position)
  }

  setPosition (position: THREE.Vector3) {
    this.mesh.position.copy(position)
  }

  dispose () {
    this.mesh.geometry.dispose()
    this._material.dispose()
  }
}

type Stage = 'ready' | 'active' | 'done' | undefined

/**
 * Manages measure flow and gizmos
 */
export class GizmoMeasure {
  // dependencies
  private _viewer: Viewer

  // resources
  private _startMarker: MeasureMarker
  private _endMarker: MeasureMarker
  private _line: MeasureLine
  private _lineX: MeasureLine
  private _lineY: MeasureLine
  private _lineZ: MeasureLine

  // state

  private _lastRaycast: number
  private removeMouseListener: () => void
  private oldClick: (hit: HitTestResult) => void
  private onClear: () => void

  // results
  private _startPos: THREE.Vector3
  private _endPos: THREE.Vector3
  private _measurement: THREE.Vector3

  get startPoint () {
    return this._startPos
  }

  get endPoint () {
    return this._endPos
  }

  get measurement () {
    return this._measurement
  }

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  /**
   * Starts a new measure flow where the two next click are overriden.
   * Currently running flow if any will be aborted.
   * Promise is resolved if flow is succesfully completed, rejected otherwise.
   * Do not override viewer.onMouseClick while this flow is active.
   */
  async measure (onProgress?: (stage: Stage) => void) {
    this.clear()

    // Start Marker
    this._startMarker = new MeasureMarker()
    this._startMarker.mesh.visible = false
    this._viewer.renderer.add(this._startMarker.mesh)

    this.oldClick = this._viewer.onMouseClick

    onProgress?.('ready')
    this.registerMouse(this.onMouseMoveReady.bind(this))
    return new Promise<void>((resolve, reject) => {
      this.onClear = () => {
        onProgress?.(undefined)
        reject(new Error('Aborted'))
      }

      // Override next two clicks then reverts
      this._viewer.onMouseClick = (hit) => {
        // Wait until valid first click.
        if (!hit.object) return
        this.onFirstClick(hit)
        onProgress?.('active')
        this.registerMouse(this.onMouseMoveActive.bind(this))
        this._viewer.onMouseClick = (hit) => {
          this.onClear = undefined

          // Restore normal click behavior
          this._viewer.onMouseClick = this.oldClick
          this.oldClick = undefined

          const success = this.onSecondClick(hit)
          if (success) {
            onProgress?.('done')
            resolve()
          } else {
            onProgress?.(undefined)
            reject(new Error('Canceled'))
          }
        }
      }
    })
  }

  private onFirstClick (hit: HitTestResult) {
    this._startPos = hit.position

    // Line
    this._line = new MeasureLine(
      new Vector2().fromArray(this._viewer.viewport.getSize()),
      hit.position,
      hit.position,
      new THREE.Color(1, 1, 1)
    )
    this._viewer.renderer.add(this._line.mesh)

    // Start Marker
    this._endMarker = new MeasureMarker(hit.position)
    this._viewer.renderer.add(this._endMarker.mesh)
  }

  private registerMouse (callBack: (e: MouseEvent) => void) {
    this.removeMouseListener?.()
    window.addEventListener('mousemove', callBack)
    this.removeMouseListener = () => {
      window.removeEventListener('mousemove', callBack)
      this.removeMouseListener = undefined
    }
  }

  private mouseRaycast (event: MouseEvent) {
    // Cap the number of raycast per seconds
    const time = Date.now()
    if (time - this._lastRaycast < 20) return
    this._lastRaycast = time

    const position = new THREE.Vector2(event.offsetX, event.offsetY)
    return this._viewer.raycaster.screenRaycast(position)
  }

  private onMouseMoveReady (event: MouseEvent) {
    const hit = this.mouseRaycast(event)
    if (!hit) return

    if (hit.object) {
      this._startMarker.setPosition(hit.position)
    }
    this._startMarker.mesh.visible = !!hit.object
  }

  private onMouseMoveActive (event: MouseEvent) {
    const hit = this.mouseRaycast(event)
    if (!hit) return

    // Show markers and line on hit
    if (hit.object) {
      this._line.setPoints(this._startPos, hit.position)
      this._endMarker.setPosition(hit.position)
    }

    this._endMarker.mesh.visible = !!hit.object
    this._line.mesh.visible = !!hit.object
  }

  private onSecondClick (hit: HitTestResult) {
    if (!hit.object) {
      this.clear()
      console.log('No point selected. Aborting measurement.')
      return false
    }

    this.removeMouseListener?.()

    this._endPos = hit.position
    const canvasSize = new Vector2().fromArray(this._viewer.viewport.getSize())
    this._measurement = this._endPos.clone().sub(this._startPos)
    const endX = this._startPos
      .clone()
      .setX(this._startPos.x + this._measurement.x)
    const endY = endX.clone().setY(endX.y + this._measurement.y)

    console.log(`Distance: ${this._measurement.length()}`)
    console.log(
      `
      X: ${this._measurement.x},
      Y: ${this._measurement.y},
      Z: ${this._measurement.z} 
      `
    )

    this._line.setPoints(this._startPos, this._endPos)

    this._lineX = new MeasureLine(
      canvasSize,
      this._startPos,
      endX,
      new THREE.Color(1, 0, 0)
    )
    this._viewer.renderer.add(this._lineX.mesh)

    this._lineY = new MeasureLine(
      canvasSize,
      endX,
      endY,
      new THREE.Color(0, 1, 0)
    )
    this._viewer.renderer.add(this._lineY.mesh)

    this._lineZ = new MeasureLine(
      canvasSize,
      endY,
      this._endPos,
      new THREE.Color(0, 0, 1)
    )
    this._viewer.renderer.add(this._lineZ.mesh)
    return true
  }

  /**
   * Cancels the current measure flow, fails the related promise and dispose all resources.
   */
  clear () {
    if (this.oldClick) {
      this._viewer.onMouseClick = this.oldClick
      this.oldClick = undefined
    }
    this.removeMouseListener?.()
    this.removeMouseListener = undefined

    this._startPos = undefined
    this._endPos = undefined
    this._measurement = undefined

    if (this._startMarker) {
      this._viewer.renderer.remove(this._startMarker.mesh)
      this._startMarker.dispose()
    }

    if (this._endMarker) {
      this._viewer.renderer.remove(this._endMarker.mesh)
      this._endMarker.dispose()
    }

    if (this._line) {
      this._viewer.renderer.remove(this._line.mesh)
      this._line.dispose()
    }
    if (this._lineX) {
      this._viewer.renderer.remove(this._lineX.mesh)
      this._lineX.dispose()
    }

    if (this._lineY) {
      this._viewer.renderer.remove(this._lineY.mesh)
      this._lineY.dispose()
    }

    if (this._lineZ) {
      this._viewer.renderer.remove(this._lineZ.mesh)
      this._lineZ.dispose()
    }
    this.onClear?.()
    this.onClear = undefined
  }
}
