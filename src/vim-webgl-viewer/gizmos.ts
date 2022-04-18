/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { MathUtils } from 'three'
import { Renderer } from './renderer'
import { Camera } from './camera'
import { ViewerSettings } from './viewerSettings'

/**
 * Manages the camera target gizmo
 */
export class CameraGizmo {
  // Dependencies
  private _renderer: Renderer
  private _camera: Camera

  // Settings
  private _size: number = 0.01
  private _fov: number = 50
  private _color: THREE.Color = new THREE.Color('blue')
  private _opacity: number
  private _opacityAlways: number
  private _fadeDurationMs: number = 200
  private _showDurationMs: number = 1000

  // Resources
  private _box: THREE.BufferGeometry
  private _wireframe: THREE.BufferGeometry
  private _material: THREE.LineBasicMaterial
  private _materialAlways: THREE.LineBasicMaterial
  private _gizmos: THREE.Group

  // State
  private _timeout: ReturnType<typeof setTimeout>
  private _fadeEnd: number
  private _active: boolean

  constructor (renderer: Renderer, camera: Camera, settings: ViewerSettings) {
    this._renderer = renderer
    this._camera = camera
    this.applySettings(settings)
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
      this._timeout = setTimeout(() => this.fadeOut(), this._showDurationMs)
    }
  }

  fadeOut (fading?: boolean) {
    const now = new Date().getTime()

    if (!fading) {
      this._fadeEnd = now + this._fadeDurationMs
    }

    if (now > this._fadeEnd) {
      // restore opacity values and hide for good
      this._gizmos.visible = false
      this._material.opacity = this._opacity
      this._materialAlways.opacity = this._opacityAlways
    } else {
      // lerp and loop until fade is over
      requestAnimationFrame(() => this.fadeOut(true))
      const t = Math.pow((this._fadeEnd - now) / this._fadeDurationMs, 4)
      this._material.opacity = MathUtils.lerp(0, this._opacity, t)
      this._materialAlways.opacity = MathUtils.lerp(0, this._opacityAlways, t)
    }
  }

  setPosition (position: THREE.Vector3) {
    if (!this._gizmos) return
    this._gizmos.position.copy(position)
    this.updateScale()
  }

  setSize (size: number) {
    this._size = size
  }

  setOpacity (opacity: number, opacityAlways: number) {
    this._opacity = opacity
    this._opacityAlways = opacityAlways
    if (!this._gizmos) return
    this._material.opacity = opacity
    this._materialAlways.opacity = opacityAlways
  }

  setColor (color: THREE.Color) {
    this._color = color
    if (!this._gizmos) return
    this._material.color = color
    this._materialAlways.color = color
  }

  applySettings (settings: ViewerSettings) {
    this._active = settings.getCameraGizmoEnable()
    this._fov = settings.getCameraFov()
    this.setColor(settings.getCameraGizmoColor())
    this.setSize(settings.getCameraGizmoSize())
    this.setOpacity(
      settings.getCameraGizmoOpacity(),
      settings.getCameraGizmoOpacityAlways()
    )
  }

  private updateScale () {
    const dist = this._camera.camera.position
      .clone()
      .distanceTo(this._gizmos.position)
    // computes scale such that gizmo screen size remains constant
    const h = dist * Math.tan(MathUtils.degToRad(this._fov) * this._size)
    this._gizmos?.scale.set(h, h, h)
  }

  private createGizmo () {
    this._box = new THREE.SphereGeometry(1)
    this._wireframe = new THREE.WireframeGeometry(this._box)

    this._material = new THREE.LineBasicMaterial({
      depthTest: true,
      opacity: this._opacity,
      color: this._color,
      transparent: true
    })
    this._materialAlways = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: this._opacityAlways,
      color: this._color,
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
