import * as THREE from 'three'
import { SphereGeometry } from 'three'
import { ViewerRenderer } from './viewerRenderer'
import { ViewerCamera } from './viewerCamera'
import { ViewerSettings } from './viewerSettings'
import { DEG2RAD } from 'three/src/math/MathUtils'

export class CameraGizmo {
  // Dependencies
  camera: ViewerCamera
  renderer: ViewerRenderer

  // Settings
  scale: number
  fov: number

  // Resources
  box: THREE.BufferGeometry
  wireframe: THREE.BufferGeometry
  material: THREE.Material
  materialAlways: THREE.Material
  gizmos: THREE.Group

  // State
  timeout: ReturnType<typeof setTimeout>
  active: boolean

  constructor (camera: ViewerCamera, renderer: ViewerRenderer) {
    this.camera = camera
    this.renderer = renderer
  }

  show (show: boolean = true) {
    if (!this.active) return

    if (!this.gizmos) {
      this.createGizmo()
    }

    clearTimeout(this.timeout)
    this.gizmos.visible = show
    // Hide after one second since last request
    if (show) {
      this.timeout = setTimeout(() => (this.gizmos.visible = false), 1000)
    }
  }

  update (position: THREE.Vector3) {
    this.gizmos?.position.copy(position)
  }

  applyViewerSettings (settings: ViewerSettings) {
    this.active = settings.getCameraShowGizmo()
    this.fov = settings.getCameraFov()
  }

  applyModelSettings (factor: number) {
    this.setScale((Math.tan((DEG2RAD * this.fov) / 2) * factor) / 10)
  }

  setScale (scale: number = 1) {
    this.gizmos?.scale.set(scale, scale, scale)
    this.scale = scale
  }

  createGizmo () {
    this.box = new SphereGeometry(1)
    this.wireframe = new THREE.WireframeGeometry(this.box)

    this.material = new THREE.LineBasicMaterial({
      depthTest: true,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    this.materialAlways = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.05,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })

    // Add to scene as group
    this.gizmos = new THREE.Group()
    this.gizmos.add(new THREE.LineSegments(this.wireframe, this.material))
    this.gizmos.add(new THREE.LineSegments(this.wireframe, this.materialAlways))
    this.renderer.addObject(this.gizmos)

    this.setScale(this.scale)
  }

  dispose () {
    this.box.dispose()
    this.wireframe.dispose()
    this.material.dispose()
    this.materialAlways.dispose()
    this.box = null
    this.wireframe = null
    this.material = null
    this.materialAlways = null

    this.renderer.removeObject(this.gizmos)
    this.gizmos = null
  }
}
