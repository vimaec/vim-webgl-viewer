/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { VimSettings, ViewerSettings } from './viewerSettings'
import { EnvironmentPlane } from './environmentPlane'

export class ViewerEnvironment {
  plane: EnvironmentPlane
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight

  constructor (settings: ViewerSettings) {
    this.plane = new EnvironmentPlane()
    this.skyLight = new THREE.HemisphereLight()
    this.sunLight = new THREE.DirectionalLight()
    this.applyViewerSettings(settings)
  }

  getElements (): THREE.Object3D[] {
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

  public applyVimSettings (settings: VimSettings, box: THREE.Box3) {
    // Plane
    this.plane.applyVimSettings(settings, box)
  }
}
