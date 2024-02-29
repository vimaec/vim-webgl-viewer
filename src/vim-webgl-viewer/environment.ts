/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { TextureEncoding, Settings } from './viewerSettings'
import { Box3 } from 'three'

/**
 * Manages the THREE.Mesh for the ground plane under the vims
 */
export class GroundPlane {
  mesh: THREE.Mesh

  private _source: string | undefined
  private _size: number = 1

  // disposable
  private _geometry: THREE.PlaneGeometry
  private _material: THREE.MeshBasicMaterial
  private _texture: THREE.Texture | undefined

  constructor () {
    this._geometry = new THREE.PlaneGeometry()
    this._material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false
    })
    this.mesh = new THREE.Mesh(this._geometry, this._material)
    // Makes ground plane be drawn first so that isolation material is drawn on top.
    this.mesh.renderOrder = -1
  }

  applyViewerSettings (settings: Settings) {
    this._size = settings.groundPlane.size
    // Visibily
    this.mesh.visible = settings.groundPlane.visible

    // Looks
    this.applyTexture(
      settings.groundPlane.encoding,
      settings.groundPlane.texture
    )
    this._material.color.copy(settings.groundPlane.color)
    this._material.opacity = settings.groundPlane.opacity
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

  applyTexture (encoding: 'url' | 'base64' | undefined, source: string) {
    // Check for changes
    if (source === this._source) return
    this._source = source

    // dispose previous texture
    this._texture?.dispose()
    this._texture = undefined
    // Bail if new texture url, is no texture
    if (!source || !encoding) return

    if (encoding === 'url') {
      // load texture
      const loader = new THREE.TextureLoader()
      this._texture = loader.load(source)
    }
    if (encoding === 'base64') {
      const image = new Image()
      image.src = source
      const txt = new THREE.Texture()
      this._texture = txt
      this._texture.image = image
      image.onload = () => {
        txt.needsUpdate = true
      }
    }
    if (!this._texture) {
      console.error('Failed to load texture: ' + source)
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
  sunLights: THREE.DirectionalLight[]
  private _groundPlane: GroundPlane

  get groundPlane () {
    return this._groundPlane.mesh
  }

  constructor (settings: Settings) {
    this._groundPlane = new GroundPlane()
    this.skyLight = new THREE.HemisphereLight()
    this.sunLights = []
    this.applySettings(settings)
  }

  loadGroundTexture (encoding: TextureEncoding, url: string) {
    this._groundPlane.applyTexture(encoding, url)
  }

  /**
   * Returns all three objects composing the environment
   */
  getObjects (): THREE.Object3D[] {
    return [this._groundPlane.mesh, this.skyLight, ...this.sunLights]
  }

  applySettings (settings: Settings) {
    // Plane
    this._groundPlane.applyViewerSettings(settings)

    // Skylight
    this.skyLight.color.copy(settings.skylight.skyColor)
    this.skyLight.groundColor.copy(settings.skylight.groundColor)
    this.skyLight.intensity = settings.skylight.intensity

    // Sunlights
    const count = settings.sunLights.length
    for (let i = 0; i < count; i++) {
      if (!this.sunLights[i]) {
        this.sunLights[i] = new THREE.DirectionalLight()
      }
      const color = settings.sunLights[i].color
      const pos = settings.sunLights[i].position
      const intensity = settings.sunLights[i].intensity
      if (color) {
        this.sunLights[i].color.copy(color)
      }
      if (pos) {
        this.sunLights[i].position.copy(pos)
      }
      if (intensity) {
        this.sunLights[i].intensity = intensity
      }
    }
  }

  /**
   * Adjust scale so that it matches box dimensions.
   */
  adaptToContent (box: Box3) {
    // Plane
    this._groundPlane.adaptToContent(box)
  }

  dispose () {
    this.sunLights.forEach((s) => s.dispose())
    this.skyLight.dispose()
    this._groundPlane.dispose()
  }
}

export interface IEnvironment {
  /**
   * The skylight in the scene.
   */
  skyLight: THREE.HemisphereLight

  /**
   * The array of directional lights in the scene.
   */
  sunLights: THREE.DirectionalLight[]

  /**
   * The ground plane under the model in the scene.
   */
  groundPlane: THREE.Mesh
}
