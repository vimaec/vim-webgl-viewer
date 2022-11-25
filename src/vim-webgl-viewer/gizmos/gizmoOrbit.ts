/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { MathUtils } from 'three'
import { Renderer } from '../rendering/renderer'
import { Camera } from '../camera'
import { ViewerSettings } from '../viewerSettings'

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
  private _opacity: number = 0.2
  private _opacityAlways: number = 0.5
  private _fadeDurationMs: number = 200
  private _showDurationMs: number = 1000

  // Resources
  private _box: THREE.BufferGeometry | undefined
  private _wireframe: THREE.BufferGeometry | undefined
  private _material: THREE.LineBasicMaterial | undefined
  private _materialAlways: THREE.LineBasicMaterial | undefined
  private _gizmos: THREE.LineSegments | undefined

  // State
  private _timeout: ReturnType<typeof setTimeout> | undefined
  private _fadeEnd: number = 0
  private _active: boolean = true
  private _animation: number = 0

  constructor (renderer: Renderer, camera: Camera, settings: ViewerSettings) {
    this._renderer = renderer
    this._camera = camera
    this.applySettings(settings)
  }

  dispose () {
    cancelAnimationFrame(this._animation)
    clearTimeout(this._timeout)

    this._box?.dispose()
    this._wireframe?.dispose()
    this._material?.dispose()
    this._materialAlways?.dispose()
    this._box = undefined
    this._wireframe = undefined
    this._material = undefined
    this._materialAlways = undefined

    if (this._gizmos) {
      this._renderer.remove(this._gizmos)
      this._gizmos = undefined
    }
  }

  get enabled () {
    return this._active
  }

  set enabled (value: boolean) {
    this._active = value
  }

  show (show: boolean = true) {
    if (!this._active) return

    if (!this._gizmos) {
      this.createGizmo()
    }

    clearTimeout(this._timeout)
    this._gizmos!.visible = show
    // Hide after one second since last request
    if (show) {
      this._timeout = setTimeout(() => this.fadeOut(), this._showDurationMs)
    }
  }

  private fadeOut (fading?: boolean) {
    const now = new Date().getTime()

    if (!fading) {
      this._fadeEnd = now + this._fadeDurationMs
    }

    if (now > this._fadeEnd) {
      // restore opacity values and hide for good
      this._gizmos!.visible = false
      this._material!.opacity = this._opacity
      this._materialAlways!.opacity = this._opacityAlways
    } else {
      // lerp and loop until fade is over
      this._animation = requestAnimationFrame(() => this.fadeOut(true))
      const t = Math.pow((this._fadeEnd - now) / this._fadeDurationMs, 4)
      this._material!.opacity = MathUtils.lerp(0, this._opacity, t)
      this._materialAlways!.opacity = MathUtils.lerp(0, this._opacityAlways, t)
    }
  }

  setPosition (position: THREE.Vector3) {
    this._gizmos?.position.copy(position)
    this.updateScale()
  }

  setSize (size: number) {
    this._size = size
  }

  setOpacity (opacity: number, opacityAlways: number) {
    this._opacity = opacity
    this._opacityAlways = opacityAlways
    if (!this._gizmos) return
    this._material!.opacity = opacity
    this._materialAlways!.opacity = opacityAlways
  }

  setColor (color: THREE.Color) {
    this._color = color
    if (!this._gizmos) return
    this._material!.color = color
    this._materialAlways!.color = color
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
    if (!this._gizmos) return
    const dist = this._camera.camera.position
      .clone()
      .distanceTo(this._gizmos.position)
    let h = 0
    const cam = this._camera.camera
    if (cam instanceof THREE.OrthographicCamera) {
      const dx = cam.right - cam.left
      const dy = cam.top - cam.bottom
      h = Math.min(dx, dy) * this._size
    } else {
      // computes scale such that gizmo screen size remains constant
      h = dist * Math.tan(MathUtils.degToRad(this._fov) * this._size)
    }
    this._gizmos.scale.set(h, h, h)
  }

  private createGizmo () {
    this._box = new THREE.SphereGeometry(1)
    this._wireframe = new THREE.WireframeGeometry(this._box)
    this._wireframe.addGroup(0, Infinity, 0)
    this._wireframe.addGroup(0, Infinity, 1)

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
    this._gizmos = new THREE.LineSegments(this._wireframe, [
      this._material,
      this._materialAlways
    ])

    this._renderer.add(this._gizmos)
    this.updateScale()
  }
}
