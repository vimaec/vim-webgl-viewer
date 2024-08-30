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
import { CameraLight } from './cameraLight'
/**
 * Manages ground plane and lights that are part of the THREE.Scene to render but not part of the Vims.
 */
export class Environment {
  private readonly _renderer: Renderer
  private readonly _camera: ICamera

  /**
   * The skylight in the scene.
   */
  readonly skyLight: THREE.HemisphereLight

  /**
   * The array of directional lights in the scene.
   */
  readonly sunLights: ReadonlyArray<CameraLight>

  /**
   * The ground plane under the model in the scene.
   */
  readonly groundPlane: GroundPlane

  /*
   * The skybox in the scene.
   */
  readonly skybox: Skybox

  constructor (camera:ICamera, renderer: Renderer, viewerMaterials: ViewerMaterials, settings: ViewerSettings) {
    this._camera = camera
    this._renderer = renderer

    this.groundPlane = new GroundPlane(settings)
    this.skyLight = this.createSkyLight(settings)
    this.skybox = new Skybox(camera, renderer, viewerMaterials, settings)
    this.sunLights = this.createSunLights(settings)

    this.setupRendererListeners()
    this.addObjectsToRenderer()
  }

  /**
   * Returns all three objects composing the environment
   */
  private getObjects (): ReadonlyArray<THREE.Object3D> {
    return [this.groundPlane.mesh, this.skyLight, ...this.sunLights.map(l => l.light), this.skybox.mesh]
  }

  private createSkyLight (settings: ViewerSettings): THREE.HemisphereLight {
    const { skyColor, groundColor, intensity } = settings.skylight
    return new THREE.HemisphereLight(skyColor, groundColor, intensity)
  }

  private createSunLights (settings: ViewerSettings): ReadonlyArray<CameraLight> {
    return settings.sunlights.map((s) =>
      new CameraLight(this._camera, s)
    )
  }

  private addObjectsToRenderer (): void {
    this.getObjects().forEach((o) => this._renderer.add(o))
  }

  private setupRendererListeners (): void {
    this._renderer.onBoxUpdated.subscribe(() => {
      const box = this._renderer.getBoundingBox()
      this.groundPlane.adaptToContent(box)
    })
  }

  /**
   * Dispose of all resources.
   */
  dispose (): void {
    this.getObjects().forEach((o) => this._renderer.remove(o))
    this.sunLights.forEach((s) => s.dispose())
    this.skyLight.dispose()
    this.groundPlane.dispose()
    this.skybox.dispose()
  }
}
