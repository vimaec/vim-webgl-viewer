/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { TextureEncoding, ViewerSettings } from '../settings/viewerSettings'

/**
 * Manages the THREE.Mesh for the ground plane under the vims
 */
export class GroundPlane {
  readonly mesh: THREE.Mesh

  private _source: string | undefined
  private _size: number = 1

  /**
   * Whether the ground plane is visible or not.
   */
  get visible () {
    return this.mesh.visible
  }

  set visible (value: boolean) {
    this.mesh.visible = value
  }

  // disposable
  private _geometry: THREE.PlaneGeometry
  private _material: THREE.MeshBasicMaterial
  private _texture: THREE.Texture | undefined

  constructor (settings : ViewerSettings) {
    this._geometry = new THREE.PlaneGeometry()
    this._material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false
    })
    this.mesh = new THREE.Mesh(this._geometry, this._material)
    // Makes ground plane be drawn first so that isolation material is drawn on top.
    this.mesh.renderOrder = -1

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

  applyTexture (encoding: TextureEncoding, source: string) {
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
