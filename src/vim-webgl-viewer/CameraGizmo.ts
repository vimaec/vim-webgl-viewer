import * as THREE from 'three'
import { SphereGeometry } from 'three'
import { ViewerRenderer } from './viewerRenderer'
import { ViewerCamera } from './viewerCamera'
import { ViewerSettings } from './viewerSettings'
import { DEG2RAD } from 'three/src/math/MathUtils'

export class CameraGizmo {
  // Dependencies
  camera: ViewerCamera
  render: ViewerRenderer

  // Settings
  scale: number

  // Resources
  box: THREE.BufferGeometry
  wireframe: THREE.BufferGeometry
  material: THREE.Material
  materialAlways: THREE.Material
  gizmos: THREE.Group

  // State
  timeout: number

  constructor (camera: ViewerCamera, render: ViewerRenderer) {
    this.camera = camera
    this.render = render
  }

  show () {
    if (!this.gizmos) {
      this.createGizmo()
    }

    // Show for one second since last request
    this.gizmos.visible = true
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => (this.gizmos.visible = false), 1000)
  }

  update (position: THREE.Vector3) {
    this.gizmos?.position.copy(position)
  }

  applySettings (settings: ViewerSettings, factor: number) {
    this.setScale(
      (Math.tan((DEG2RAD * settings.getCameraFov()) / 2) * factor) / 10
    )
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
    this.render.addToScene(this.gizmos)

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

    this.render.remove(this.gizmos)
    this.gizmos = null
  }
}
