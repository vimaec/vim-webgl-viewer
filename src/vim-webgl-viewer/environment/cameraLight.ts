/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { ICamera } from '../camera/camera'

export class CameraLight {
  readonly light : THREE.DirectionalLight
  private readonly _camera : ICamera
  private _unsubscribe : (() => void) | undefined = undefined

  /**
   * The position of the light.
   */
  position: THREE.Vector3

  /**
   * The color of the light.
   */
  get color () {
    return this.light.color
  }

  set color (value: THREE.Color) {
    this.light.color = value
  }

  /**
   * The intensity of the light.
   */
  get intensity () {
    return this.light.intensity
  }

  set intensity (value: number) {
    this.light.intensity = value
  }

  /**
   * Whether the light follows the camera or not.
   */
  get followCamera () {
    return this._unsubscribe !== undefined
  }

  set followCamera (value: boolean) {
    if (this.followCamera === value) return

    this._unsubscribe?.()
    this._unsubscribe = undefined

    if (value) {
      this._unsubscribe = this._camera.onMoved.subscribe(() => this.updateLightPosition())
      this.updateLightPosition()
    }
  }

  constructor (
    camera: ICamera,
    options: {
      followCamera: boolean,
      position: THREE.Vector3,
      color: THREE.Color,
      intensity: number
    }
  ) {
    this._camera = camera
    this.position = options.position.clone()
    this.light = new THREE.DirectionalLight(options.color, options.intensity)
    this.followCamera = options.followCamera
  }

  /**
   * Updates the light's position based on the camera's quaternion.
   */
  private updateLightPosition () {
    this.light.position.copy(this.position).applyQuaternion(this._camera.quaternion)
  }

  /**
   * Disposes of the camera light.
   */
  dispose () {
    this._unsubscribe?.()
    this._unsubscribe = undefined
    this.light.dispose()
  }
}
