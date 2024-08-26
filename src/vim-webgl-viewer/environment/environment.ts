/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { ViewerSettings } from '../settings/viewerSettings'
import { ICamera } from '../camera/camera'
import { ViewerMaterials } from '../../vim-loader/materials/viewerMaterials'
import { GroundPlane } from './groundPlane'
import { Skybox } from './skybox'
import { Renderer } from '../rendering/renderer'

/**
 * Manages ground plane and lights that are part of the THREE.Scene to render but not part of the Vims.
 */
export class Environment {
  private readonly _renderer: Renderer

  /**
   * The skylight in the scene.
   */
  readonly skyLight: THREE.HemisphereLight

  /**
   * The array of directional lights in the scene.
   */
  readonly sunLights: THREE.DirectionalLight[]

  /**
   * The ground plane under the model in the scene.
   */
  readonly groundPlane: GroundPlane

  /*
   * The skybox in the scene.
   */
  readonly skybox: Skybox

  constructor (camera:ICamera, renderer: Renderer, viewerMaterials: ViewerMaterials, settings: ViewerSettings) {
    this._renderer = renderer
    this._renderer.onBoxUpdated.subscribe((_) => {
      const box = this._renderer.getBoundingBox()
      this.groundPlane.adaptToContent(box)
    })

    this.groundPlane = new GroundPlane(settings)
    this.skyLight = new THREE.HemisphereLight(
      settings.skylight.skyColor,
      settings.skylight.groundColor,
      settings.skylight.intensity
    )
    this.skybox = new Skybox(camera, renderer, viewerMaterials, settings)

    this.sunLights = this._createLights(settings)
    camera.onMoved.subscribe(() => {
      this.sunLights.forEach((s, i) => {
        if (settings.sunlights[i].followCamera) {
          s.position.copy(settings.sunlights[i].position)
          s.position.applyQuaternion(camera.quaternion)
        }
      })
    })
    this.getObjects().forEach((o) => this._renderer.add(o))
  }

  /**
   * Returns all three objects composing the environment
   */
  private getObjects (): THREE.Object3D[] {
    return [this.groundPlane.mesh, this.skyLight, ...this.sunLights, this.skybox.mesh]
  }

  private _createLights (settings: ViewerSettings) {
    const lights : THREE.DirectionalLight[] = []
    const count = settings.sunlights.length
    for (let i = 0; i < count; i++) {
      if (!lights[i]) {
        lights[i] = new THREE.DirectionalLight(
          settings.sunlights[i].color,
          settings.sunlights[i].intensity
        )
      }
      const pos = lights[i].position
      if (pos) {
        lights[i].position.copy(pos)
      }
    }
    return lights
  }

  /**
   * Dispose of all resources.
   */
  dispose () {
    this.getObjects().forEach((o) => this._renderer.remove(o))
    this.sunLights.forEach((s) => s.dispose())
    this.skyLight.dispose()
    this.groundPlane.dispose()
  }
}
