/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { ViewerSettings } from './viewerSettings'
import { Box3 } from 'three'

/**
 * Manages the THREE.Mesh for the ground plane under the vims
 */
export class GroundPlane {
  mesh: THREE.Mesh

  private _source: string

  private _size: number

  // disposable
  private _geometry: THREE.PlaneBufferGeometry
  private _material: THREE.MeshBasicMaterial
  private _texture: THREE.Texture

  constructor () {
    this._geometry = new THREE.PlaneBufferGeometry()
    this._material = new THREE.MeshBasicMaterial({ transparent: true })
    this.mesh = new THREE.Mesh(this._geometry, this._material)
  }

  applyViewerSettings (settings: ViewerSettings) {
    this._size = settings.getGroundPlaneSize()
    // Visibily
    this.mesh.visible = settings.getGroundPlaneShow()

    // Looks
    this.applyTexture(settings.getGroundPlaneTextureUrl())
    this._material.color.copy(settings.getGroundPlaneColor())
    this._material.opacity = settings.getGroundPlaneOpacity()
  }

  adaptToContent (box: THREE.Box3) {
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
    const size = (sphere?.radius ?? 1) * this._size
    const scale = new THREE.Vector3(1, 1, 1).multiplyScalar(size)
    this.mesh.scale.copy(scale)
  }

  applyTexture (texUrl: string) {
    // Check for changes
    if (texUrl === this._source) return
    this._source = texUrl

    // dispose previous texture
    this._texture?.dispose()
    this._texture = null

    // Bail if new texture url, is no texture
    if (!texUrl) return

    // load texture
    const loader = new THREE.TextureLoader()
    this._texture = loader.load(texUrl)
    if (!this._texture) {
      console.error('Failed to load texture: ' + texUrl)
      return
    }

    // Apply texture
    this._material.map = this._texture
  }

  dispose () {
    this._geometry?.dispose()
    this._material?.dispose()
    this._texture?.dispose()

    this._geometry = null
    this._material = null
    this._texture = null
  }
}

/**
 * Manages ground plane and lights that are part of the THREE.Scene to render but not part of the Vims.
 */
export class Environment {
  groundPlane: GroundPlane
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight

  constructor (settings: ViewerSettings) {
    this.groundPlane = new GroundPlane()
    this.skyLight = new THREE.HemisphereLight()
    this.sunLight = new THREE.DirectionalLight()
    this.applySettings(settings)
  }

  getObjects (): THREE.Object3D[] {
    return [this.groundPlane.mesh, this.skyLight, this.sunLight]
  }

  applySettings (settings: ViewerSettings) {
    // Plane
    this.groundPlane.applyViewerSettings(settings)

    // Skylight
    this.skyLight.color.copy(settings.getSkylightColor())
    this.skyLight.groundColor.copy(settings.getSkylightGroundColor())
    this.skyLight.intensity = settings.getSkylightIntensity()

    // Sunlight
    this.sunLight.color.copy(settings.getSunlightColor())
    this.sunLight.position.copy(settings.getSunlightPosition())
    this.sunLight.intensity = settings.getSunlightIntensity()
  }

  public adaptToContent (box: Box3) {
    // Plane
    this.groundPlane.adaptToContent(box)
  }
}