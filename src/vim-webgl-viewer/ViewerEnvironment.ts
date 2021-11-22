import * as THREE from 'three'
import { ModelSettings, ViewerSettings } from './viewerSettings'
import { EnvironmentPlane } from './EnvironmentPlane'

/*
Vim Viewer
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
export class ViewerEnvironment {
  plane: EnvironmentPlane
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight

  constructor (
    plane: EnvironmentPlane,
    skyLight: THREE.HemisphereLight,
    sunLight: THREE.DirectionalLight
  ) {
    this.plane = plane
    this.skyLight = skyLight
    this.sunLight = sunLight
  }

  // TODO Remove values
  static createDefault (): ViewerEnvironment {
    // Plane
    const plane = new EnvironmentPlane()

    // Lights
    const skyLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)
    skyLight.color.setHSL(0.6, 1, 0.6)
    skyLight.groundColor.setHSL(0.095, 1, 0.75)
    skyLight.position.set(0, 50, 0)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.color.setHSL(0.1, 1, 0.95)
    sunLight.position.set(-1, 1.75, 1)
    sunLight.position.multiplyScalar(30)

    return new ViewerEnvironment(plane, skyLight, sunLight)
  }

  getElements (): THREE.Object3D[] {
    return [this.plane.mesh, this.skyLight, this.sunLight]
  }

  applySettings (
    settings: ViewerSettings,
    modelSettings?: ModelSettings,
    box?: THREE.Box3
  ) {
    // Plane
    this.plane.applySettings(settings, modelSettings, box)

    // Skylight
    this.skyLight.color.copy(settings.getSkylightColor())
    this.skyLight.groundColor.copy(settings.getSkylightGroundColor())
    this.skyLight.intensity = settings.getSkylightIntensity()

    // Sunlight
    this.sunLight.color.copy(settings.getSunlightColor())
    this.sunLight.position.copy(settings.getSunlightPosition())
    this.sunLight.intensity = settings.getSunlightIntensity()
  }
}
