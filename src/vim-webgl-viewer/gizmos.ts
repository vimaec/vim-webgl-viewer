/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { MathUtils } from 'three'
import { Renderer } from './renderer'
import { ViewerSettings } from './viewerSettings'

/**
 * Manages the camera target gizmo
 */
export class CameraGizmo {
  // Dependencies
  private _renderer: Renderer
  private _camera: THREE.Camera

  // Settings
  private _scale: number
  private _fov: number

  // Resources
  private _box: THREE.BufferGeometry
  private _wireframe: THREE.BufferGeometry
  private _material: THREE.Material
  private _materialAlways: THREE.Material
  private _gizmos: THREE.Group

  // State
  private _timeout: ReturnType<typeof setTimeout>
  private _active: boolean

  constructor (renderer: Renderer, camera: THREE.Camera) {
    this._renderer = renderer
    this._camera = camera
  }

  dispose () {
    clearTimeout(this._timeout)

    this._box.dispose()
    this._wireframe.dispose()
    this._material.dispose()
    this._materialAlways.dispose()
    this._box = undefined
    this._wireframe = undefined
    this._material = undefined
    this._materialAlways = undefined

    this._renderer.remove(this._gizmos)
    this._gizmos = undefined
  }

  show (show: boolean = true) {
    if (!this._active) return

    if (!this._gizmos) {
      this.createGizmo()
    }

    clearTimeout(this._timeout)
    this._gizmos.visible = show
    // Hide after one second since last request
    if (show) {
      this._timeout = setTimeout(() => (this._gizmos.visible = false), 1000)
    }
  }

  setPosition (position: THREE.Vector3) {
    if (!this._gizmos) return
    this._gizmos.position.copy(position)
    this.updateScale()
  }

  applySettings (settings: ViewerSettings) {
    this._active = settings.getCameraShowGizmo()
    this._fov = settings.getCameraFov()
  }

  private updateScale () {
    const dist = this._camera.position.clone().distanceTo(this._gizmos.position)
    const h = dist * Math.tan(MathUtils.degToRad(this._fov) / 100)
    this._gizmos?.scale.set(h, h, h)
  }

  private createGizmo () {
    this._box = new THREE.SphereGeometry(1)
    this._wireframe = new THREE.WireframeGeometry(this._box)

    this._material = new THREE.LineBasicMaterial({
      depthTest: true,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    this._materialAlways = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.05,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })

    // Add to scene as group
    this._gizmos = new THREE.Group()
    this._gizmos.add(new THREE.LineSegments(this._wireframe, this._material))
    this._gizmos.add(
      new THREE.LineSegments(this._wireframe, this._materialAlways)
    )
    this._renderer.add(this._gizmos)
    this.updateScale()
  }
}
