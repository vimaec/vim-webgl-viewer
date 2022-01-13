import * as THREE from 'three'
import { ModelSettings, ViewerSettings } from './viewerSettings'
import { EnvironmentPlane } from './environmentPlane'

/*
Vim Viewer
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
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

  public applyModelSettings (settings: ModelSettings, box: THREE.Box3) {
    // Plane
    this.plane.applyModelSettings(settings, box)
  }
}
