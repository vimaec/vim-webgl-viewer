import * as THREE from 'three'
import { ModelSettings, ViewerSettings } from './viewerSettings'

export class EnvironmentPlane {
  source: string
  mesh: THREE.Mesh

  // disposable
  geometry: THREE.PlaneBufferGeometry
  material: THREE.MeshBasicMaterial
  texture: THREE.Texture

  constructor () {
    this.geometry = new THREE.PlaneBufferGeometry()
    this.material = new THREE.MeshBasicMaterial({ transparent: true })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
  }

  applySettings (
    settings: ViewerSettings,
    modelSettings?: ModelSettings,
    box?: THREE.Box3
  ) {
    // Visibily
    this.mesh.visible = settings.getPlaneShow()

    // Looks
    this.applyTexture(settings.getPlaneTextureUrl())
    this.material.color.copy(settings.getPlaneColor())
    this.material.opacity = settings.getPlaneOpacity()

    if (!box || !modelSettings) return

    // Position
    const center = box.getCenter(new THREE.Vector3())
    const position = new THREE.Vector3(
      center.x,
      box.min.y - modelSettings.getObjectScale().y,
      center.z
    )
    this.mesh.position.copy(position)
    // Rotation
    const rotation = modelSettings.getObjectRotation()
    this.mesh.quaternion.copy(rotation)

    // Scale
    const sphere = box?.getBoundingSphere(new THREE.Sphere())
    const size = (sphere?.radius ?? 1) * settings.getPlaneSize()
    const scale = new THREE.Vector3(1, 1, 1).multiplyScalar(size)
    this.mesh.scale.copy(scale)
  }

  applyTexture (texUrl: string) {
    // Check for changes
    if (texUrl === this.source) return
    this.source = texUrl

    // dispose previous texture
    this.texture?.dispose()
    this.texture = null

    // Bail if new texture url, is no texture
    if (!texUrl) return

    // load texture
    const loader = new THREE.TextureLoader()
    this.texture = loader.load(texUrl)
    if (!this.texture) {
      console.error('Failed to load texture: ' + texUrl)
      return
    }

    // Apply texture
    this.material.map = this.texture
  }

  dispose () {
    this.geometry?.dispose()
    this.material?.dispose()
    this.texture?.dispose()

    this.geometry = null
    this.material = null
    this.texture = null
  }
}
