/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { InputAction } from '../../raycaster'
import { Viewer } from '../../viewer'
import { MeasureFlow, MeasureStage } from './measureFlow'
import { MeasureGizmo } from './measureGizmo'

/**
 * Interacts with the measure tool.
 */
export interface IMeasure {
  get startPoint()
  get endPoint()
  get measurement()

  get stage(): MeasureStage | undefined
  start(onProgress?: () => void): Promise<void>
  abort()
}

/**
 * Manages measure flow and gizmos
 */
export class Measure implements IMeasure {
  // dependencies
  private _viewer: Viewer

  // resources
  private _meshes: MeasureGizmo

  // results
  private _startPos: THREE.Vector3
  private _endPos: THREE.Vector3
  private _measurement: THREE.Vector3
  private _flow: MeasureFlow

  get startPoint () {
    return this._startPos
  }

  get endPoint () {
    return this._endPos
  }

  get measurement () {
    return this._measurement
  }

  get stage (): MeasureStage | undefined {
    return this._flow?.stage
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
  async start (onProgress?: () => void) {
    this.abort()

    this._meshes = new MeasureGizmo(this._viewer)
    this._flow = new MeasureFlow(this)
    this._viewer.inputs.strategy = this._flow
    this._flow.onProgress = onProgress

    return new Promise<void>((resolve, reject) => {
      this._flow.onComplete = (success: boolean) => {
        this._viewer.inputs.strategy = undefined
        if (success) resolve()
        else {
          this.clear()
          reject(new Error('Measurement Aborted'))
        }
      }
    })
  }

  onFirstClick (action: InputAction) {
    this.clear()
    this._meshes = new MeasureGizmo(this._viewer)
    this._startPos = action.raycast.position
    this._meshes.start(this._startPos)
  }

  onMouseMove () {
    this._meshes.hide()
  }

  onMouseIdle (action: InputAction) {
    // Show markers and line on hit
    const position = action.raycast.position

    this._measurement = action.object
      ? position.clone().sub(this._startPos)
      : undefined

    if (action.object) {
      this._meshes.update(this._startPos, position)
    } else {
      this._meshes.hide()
    }
  }

  onSecondClick (action: InputAction) {
    if (!action.object) {
      return false
    }

    // Compute measurement vector component
    this._endPos = action.raycast.position
    this._measurement = this._endPos.clone().sub(this._startPos)
    console.log(`Distance: ${this._measurement.length()}`)
    console.log(
      `
      X: ${this._measurement.x},
      Y: ${this._measurement.y},
      Z: ${this._measurement.z} 
      `
    )
    this._meshes.finish(this._startPos, this._endPos)

    return true
  }

  /**
   * Aborts the current measure flow, fails the related promise.
   */
  abort () {
    this._flow?.abort()
    this._flow = undefined

    this._startPos = undefined
    this._endPos = undefined
    this._measurement = undefined
  }

  /**
   * Clears meshes.
   */
  clear () {
    this._meshes?.dispose()
    this._meshes = undefined
  }
}
