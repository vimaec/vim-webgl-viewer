import * as THREE from 'three'
import { ViewerSettings } from './viewerSettings'

export class EnvironmentPlane {
  source: string
  mesh: THREE.Mesh

  // disposable
  geometry: THREE.PlaneBufferGeometry
  material: THREE.MeshBasicMaterial
  texture: THREE.Texture

  constructor () {
    this.geometry = new THREE.PlaneBufferGeometry()
    this.material = new THREE.MeshBasicMaterial()
    this.mesh = new THREE.Mesh(this.geometry, this.material)
  }

  applySettings (settings: ViewerSettings, box: THREE.Box3) {
    // Visibily
    this.mesh.visible = settings.raw.plane.show
    // Texture
    this.applyTexture(settings.raw.plane.texture)
    // Color
    this.material.color.set(settings.getPlaneColor())

    // Position
    const center =
      box?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3(0, 0, 0)
    const position = new THREE.Vector3(
      center.x,
      box.min.y - settings.getObjectScale().y,
      center.z
    )
    this.mesh.position.copy(position)
    // Rotation
    const rotation = settings.getObjectRotation()
    this.mesh.quaternion.copy(rotation)

    // Scale
    const sphere = box?.getBoundingSphere(new THREE.Sphere())
    const size = (sphere?.radius ?? 1) * settings.raw.plane.size
    const scale = new THREE.Vector3(1, 1, 1).multiplyScalar(size)
    this.mesh.scale.copy(scale)

    // this.mesh.matrix.compose(position, rotation, scale)
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
