/**
 * @module viw-webgl-viewer/gizmos
 */
import * as THREE from 'three'
import { MathUtils } from 'three'
import { Renderer } from '../rendering/renderer'
import { Camera } from '../camera/camera'
import { Settings } from '../viewerSettings'
import { Input } from '../inputs/input'

/**
 * Manages the camera target gizmo
 */
export class GizmoOrbit {
  // Dependencies
  private _renderer: Renderer
  private _camera: Camera
  private _inputs: Input

  // Settings
  private _size: number = 1
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
  private _disconnectCamera: () => void

  // State
  private _timeout: ReturnType<typeof setTimeout> | undefined
  private _fadeEnd: number = 0
  private _active: boolean = true
  private _animation: number = 0

  constructor (
    renderer: Renderer,
    camera: Camera,
    input: Input,
    settings: Settings
  ) {
    this._renderer = renderer
    this._camera = camera
    this._inputs = input
    this.applySettings(settings)
    this.connect()
  }

  private connect () {
    const onMode = this._inputs.onPointerModeChanged.subscribe(() =>
      this.onUpdate()
    )
    const onMove = this._camera.onMoved.subscribe(() => this.onUpdate())
    const onChange = this._camera.onValueChanged.subscribe(() =>
      this.onUpdate()
    )
    this._disconnectCamera = () => {
      onMode()
      onMove()
      onChange()
    }
  }

  private onUpdate () {
    this.updateScale()
    this.setPosition(this._camera.target)
    this.show(true)
  }

  /**
   * Disposes all resources.
   */
  dispose () {
    cancelAnimationFrame(this._animation)
    clearTimeout(this._timeout)
    this._box?.dispose()
    this._wireframe?.dispose()
    this._material?.dispose()
    this._materialAlways?.dispose()
    this._disconnectCamera?.()
    this._box = undefined
    this._wireframe = undefined
    this._material = undefined
    this._materialAlways = undefined
    this._disconnectCamera = undefined

    if (this._gizmos) {
      this._renderer.remove(this._gizmos)
      this._gizmos = undefined
    }
  }

  /**
   * Orbit gizmo will only show when enabled is true.
   */
  get enabled () {
    return this._active
  }

  set enabled (value: boolean) {
    this._active = value
  }

  /**
   * Show/Hide the gizmo for a brief delay if the gizmo is actives.
   */
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
    this._renderer.needsUpdate = true
  }

  /**
   * Updates the position of the orbit gizmo
   */
  setPosition (position: THREE.Vector3) {
    this._gizmos?.position.copy(position)
    this.updateScale()
  }

  /**
   * Updates the size of the orbit gizmo
   */
  setSize (size: number) {
    this._size = size
  }

  /**
   * Updates opacity of the orbit gizmo
   * @opacity opacity of the non occluded part.
   * @opacityAlways opacity of the occluded part.
   */
  setOpacity (opacity: number, opacityAlways: number) {
    this._opacity = opacity
    this._opacityAlways = opacityAlways
    if (!this._gizmos) return
    this._material!.opacity = opacity
    this._materialAlways!.opacity = opacityAlways
  }

  /**
   * Updates color of the orbit gizmo
   */
  setColor (color: THREE.Color) {
    this._color = color
    if (!this._gizmos) return
    this._material!.color = color
    this._materialAlways!.color = color
  }

  applySettings (settings: Settings) {
    this._active = settings.camera.gizmo.enable
    this._fov = settings.camera.fov
    this.setColor(settings.camera.gizmo.color)
    this.setSize(settings.camera.gizmo.size)

    this.setOpacity(
      settings.camera.gizmo.opacity,
      settings.camera.gizmo.opacityAlways
    )
  }

  private updateScale () {
    if (!this._gizmos) return

    const frustrum = this._camera.frustrumSizeAt(this._gizmos.position)
    const min = Math.min(frustrum.x, frustrum.y)
    const h = min * this._size
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
