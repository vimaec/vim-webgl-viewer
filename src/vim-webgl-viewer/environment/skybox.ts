/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { ViewerSettings } from '../settings/viewerSettings'
import { ICamera } from '../camera/camera'
import { ViewerMaterials } from '../../vim-loader/materials/viewerMaterials'
import { SkyboxMaterial } from '../../vim-loader/materials/skyboxMaterial'
import { Renderer } from '../rendering/renderer'

export class Skybox {
  readonly mesh : THREE.Mesh

  /**
   * Whether the skybox is enabled or not.
   */
  get enable () {
    return this.mesh.visible
  }

  /**
   * Whether the skybox is enabled or not.
   */
  set enable (value: boolean) {
    this.mesh.visible = value
    this._renderer.needsUpdate = true
  }

  /**
   * The color of the sky.
   */
  get skyColor () {
    return this._material.skyColor
  }

  set skyColor (value: THREE.Color) {
    this._material.skyColor = value
    this._renderer.needsUpdate = true
  }

  /**
   * The color of the ground.
   */
  get groundColor () {
    return this._material.groundColor
  }

  set groundColor (value: THREE.Color) {
    this._material.groundColor = value
    this._renderer.needsUpdate = true
  }

  /**
   * The sharpness of the gradient transition between the sky and the ground.
   */
  get sharpness () {
    return this._material.sharpness
  }

  set sharpness (value: number) {
    this._material.sharpness = value
    this._renderer.needsUpdate = true
  }

  private readonly _plane : THREE.PlaneGeometry
  private readonly _material : SkyboxMaterial
  private readonly _renderer: Renderer

  constructor (camera: ICamera, renderer : Renderer, materials: ViewerMaterials, settings: ViewerSettings) {
    this._renderer = renderer
    this._plane = new THREE.PlaneGeometry()
    this._material = materials.skyBox
    this.mesh = new THREE.Mesh(this._plane, materials.skyBox)
    this.enable = settings.skybox.enable

    camera.onMoved.subscribe(() => {
      this.mesh.position.copy(camera.position).add(camera.forward)
      this.mesh.quaternion.copy(camera.quaternion)
      const size = camera.frustrumSizeAt(this.mesh.position)
      this.mesh.scale.set(size.x, size.y, 1)
    })
  }

  dispose () {
    this._plane.dispose()
  }
}
