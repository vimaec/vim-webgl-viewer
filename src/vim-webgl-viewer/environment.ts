/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { ViewerSettings } from './settings'
import { Box3 } from 'three'

/**
 * Manages the THREE.Mesh for the ground plane under the vims
 */
class GroundPlane {
  source: string
  mesh: THREE.Mesh
  size: number

  // disposable
  geometry: THREE.PlaneBufferGeometry
  material: THREE.MeshBasicMaterial
  texture: THREE.Texture

  constructor () {
    this.geometry = new THREE.PlaneBufferGeometry()
    this.material = new THREE.MeshBasicMaterial({ transparent: true })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
  }

  applyViewerSettings (settings: ViewerSettings) {
    this.size = settings.getGroundPlaneSize()
    // Visibily
    this.mesh.visible = settings.getGroundPlaneShow()

    // Looks
    this.applyTexture(settings.getGroundPlaneTextureUrl())
    this.material.color.copy(settings.getGroundPlaneColor())
    this.material.opacity = settings.getGroundPlaneOpacity()
  }

  fitToContent (box: THREE.Box3) {
    // Position
    const center = box.getCenter(new THREE.Vector3())
    const position = new THREE.Vector3(
      center.x,
      box.min.y - Math.abs(box.min.y) * 0.01,
      center.z
    )
    this.mesh.position.copy(position)
    // Rotation
    // Face up, rotate by 270 degrees around x
    this.mesh.quaternion.copy(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(1.5 * Math.PI, 0, 0))
    )

    // Scale
    const sphere = box?.getBoundingSphere(new THREE.Sphere())
    const size = (sphere?.radius ?? 1) * this.size
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

/**
 * Manages ground plane and lights that are part of the THREE.Scene to render but not part of the Vims.
 */
export class Environment {
  plane: GroundPlane
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight

  constructor (settings: ViewerSettings) {
    this.plane = new GroundPlane()
    this.skyLight = new THREE.HemisphereLight()
    this.sunLight = new THREE.DirectionalLight()
    this.applyViewerSettings(settings)
  }

  getObjects (): THREE.Object3D[] {
    return [this.plane.mesh, this.skyLight, this.sunLight]
  }

  applyViewerSettings (settings: ViewerSettings) {
    // Plane
    this.plane.applyViewerSettings(settings)

    // Skylight
    this.skyLight.color.copy(settings.getSkylightColor())
    this.skyLight.groundColor.copy(settings.getSkylightGroundColor())
    this.skyLight.intensity = settings.getSkylightIntensity()

    // Sunlight
    this.sunLight.color.copy(settings.getSunlightColor())
    this.sunLight.position.copy(settings.getSunlightPosition())
    this.sunLight.intensity = settings.getSunlightIntensity()
  }

  public fitToContent (box: Box3) {
    // Plane
    this.plane.fitToContent(box)
  }
}
