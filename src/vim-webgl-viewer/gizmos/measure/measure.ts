/**
 * @module viw-webgl-viewer/gizmos/measure
 */

import * as THREE from 'three'
import { InputScheme } from '../../inputs/input'
import { InputAction } from '../../raycaster'
import { Viewer } from '../../viewer'
import { MeasureFlow, MeasureStage } from './measureFlow'
import { MeasureGizmo } from './measureGizmo'

/**
 * Interacts with the measure tool.
 */
export interface IMeasure {
  /**
   * Start point of the current measure or undefined if no active measure.
   */
  get startPoint(): THREE.Vector3 | undefined

  /**
   * End point of the current measure or undefined if no active measure.
   */
  get endPoint(): THREE.Vector3 | undefined

  /**
   * Vector from start to end of the current measure or undefined if no active measure.
   */
  get measurement(): THREE.Vector3 | undefined

  /**
   * Stage of the current measure or undefined if no active measure.
   */
  get stage(): MeasureStage | undefined

  /**
   * Starts a new measure flow where the two next click are overriden.
   * Currently running flow if any will be aborted.
   * Promise is resolved if flow is succesfully completed, rejected otherwise.
   * Do not override viewer.onMouseClick while this flow is active.
   */
  start(onProgress?: () => void): Promise<void>

  /**
   * Aborts the current measure flow, fails the related promise.
   */
  abort(): void

  /**
   * Clears meshes.
   */
  clear(): void
}

/**
 * Manages measure flow and gizmos
 */
export class Measure implements IMeasure {
  // dependencies
  private _viewer: Viewer

  // resources
  private _meshes: MeasureGizmo | undefined

  // results
  private _startPos: THREE.Vector3 | undefined

  private _endPos: THREE.Vector3 | undefined
  private _measurement: THREE.Vector3 | undefined
  private _flow: MeasureFlow | undefined
  private _previousScheme: InputScheme

  /**
   * Start point of the current measure or undefined if no active measure.
   */
  get startPoint () {
    return this._startPos
  }

  /**
   * End point of the current measure or undefined if no active measure.
   */
  get endPoint () {
    return this._endPos
  }

  /**
   * Vector from start to end of the current measure or undefined if no active measure.
   */
  get measurement () {
    return this._measurement
  }

  /**
   * Stage of the current measure or undefined if no active measure.
   */
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

    this._flow = new MeasureFlow(this)
    this._previousScheme = this._viewer.inputs.scheme
    this._viewer.inputs.scheme = this._flow
    this._flow.onProgress = () => onProgress?.()

    return new Promise<void>((resolve, reject) => {
      if (this._flow) {
        this._flow.onComplete = (success: boolean) => {
          if (this._previousScheme) {
            this._viewer.inputs.scheme = this._previousScheme
            this._previousScheme = undefined
          }
          if (success) resolve()
          else {
            reject(new Error('Measurement Aborted'))
          }
        }
      }
    })
  }

  /**
   * Should be private.
   */
  onFirstClick (action: InputAction) {
    this.clear()
    this._meshes = new MeasureGizmo(this._viewer)
    this._startPos = action.raycast.position
    if (this._startPos) {
      this._meshes.start(this._startPos)
    }
  }

  /**
   * Should be private.
   */
  onMouseMove () {
    this._meshes?.hide()
  }

  /**
   * Should be private.
   */
  onMouseIdle (action: InputAction) {
    // Show markers and line on hit
    if (!action) {
      this._meshes?.hide()
      return
    }
    const position = action.raycast.position
    if (position && this._startPos) {
      this._measurement = action.object
        ? position.clone().sub(this._startPos)
        : undefined
    }

    if (action.object && position && this._startPos) {
      this._meshes?.update(this._startPos, position)
    } else {
      this._meshes?.hide()
    }
  }

  /**
   * Should be private.
   */
  onSecondClick (action: InputAction) {
    if (!action.object || !this._startPos) {
      return false
    }

    // Compute measurement vector component
    this._endPos = action.raycast.position
    if (!this._endPos) return false

    this._measurement = this._endPos.clone().sub(this._startPos)
    console.log(`Distance: ${this._measurement.length()}`)
    console.log(
      `
      X: ${this._measurement.x},
      Y: ${this._measurement.y},
      Z: ${this._measurement.z} 
      `
    )
    this._meshes?.finish(this._startPos, this._endPos)

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
