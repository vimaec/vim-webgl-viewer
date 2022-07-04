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

  private _source: string | undefined
  private _size: number = 1

  // disposable
  private _geometry: THREE.PlaneBufferGeometry
  private _material: THREE.MeshBasicMaterial
  private _texture: THREE.Texture | undefined

  constructor () {
    this._geometry = new THREE.PlaneBufferGeometry()
    this._material = new THREE.MeshBasicMaterial({ transparent: true })
    this.mesh = new THREE.Mesh(this._geometry, this._material)
  }

  applyViewerSettings (settings: ViewerSettings) {
    this._size = settings.getGroundPlaneSize()
    // Visibily
    this.mesh.visible = settings.getGroundPlaneVisible()

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
    this._texture = undefined

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

    this._texture = undefined
  }
}

/**
 * Manages ground plane and lights that are part of the THREE.Scene to render but not part of the Vims.
 */
export class Environment {
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight
  private _groundPlane: GroundPlane

  get groundPlane () {
    return this._groundPlane.mesh
  }

  constructor (settings: ViewerSettings) {
    this._groundPlane = new GroundPlane()
    this.skyLight = new THREE.HemisphereLight()
    this.sunLight = new THREE.DirectionalLight()
    this.applySettings(settings)
  }

  /**
   * Returns all three objects composing the environment
   */
  getObjects (): THREE.Object3D[] {
    return [this._groundPlane.mesh, this.skyLight, this.sunLight]
  }

  applySettings (settings: ViewerSettings) {
    // Plane
    this._groundPlane.applyViewerSettings(settings)

    // Skylight
    this.skyLight.color.copy(settings.getSkylightColor())
    this.skyLight.groundColor.copy(settings.getSkylightGroundColor())
    this.skyLight.intensity = settings.getSkylightIntensity()

    // Sunlight
    this.sunLight.color.copy(settings.getSunlightColor())
    this.sunLight.position.copy(settings.getSunlightPosition())
    this.sunLight.intensity = settings.getSunlightIntensity()
  }

  /**
   * Adjust scale so that it matches box dimensions.
   */
  adaptToContent (box: Box3) {
    // Plane
    this._groundPlane.adaptToContent(box)
  }

  dispose () {
    this.sunLight.dispose()
    this.skyLight.dispose()
    this._groundPlane.dispose()
  }
}

export interface IEnvironment {
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight
  groundPlane: THREE.Mesh
}
