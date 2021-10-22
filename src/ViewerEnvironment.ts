import * as THREE from 'three'
import { updateMaterial, toVec } from './viewer'

/*
Vim Viewer
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
export class ViewerEnvironment {
  plane: THREE.Mesh
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight

  constructor (
    plane: THREE.Mesh,
    skyLight: THREE.HemisphereLight,
    sunLight: THREE.DirectionalLight
  ) {
    this.plane = plane
    this.skyLight = skyLight
    this.sunLight = sunLight
  }

  static createDefault (): ViewerEnvironment {
    // Ground
    const plane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(1000, 1000),
      new THREE.MeshPhongMaterial()
    )
    plane.rotation.x = -Math.PI / 2

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

  addToScene (scene: THREE.Scene) {
    scene.add(this.plane)
    scene.add(this.skyLight)
    scene.add(this.sunLight)
  }

  applySettings (settings: any) {
    this.plane.visible = settings.plane.show
    if (this.plane.material instanceof THREE.MeshPhongMaterial) {
      updateMaterial(this.plane.material, settings.plane.material)
    }
    this.plane.position.copy(toVec(settings.plane.position))

    this.skyLight.color.setHSL(
      settings.skylight.skyColor.h,
      settings.skylight.skyColor.s,
      settings.skylight.skyColor.l
    )
    this.skyLight.groundColor.setHSL(
      settings.skylight.groundColor.h,
      settings.skylight.groundColor.s,
      settings.skylight.groundColor.l
    )
    this.skyLight.intensity = settings.skylight.intensity
    this.sunLight.color.setHSL(
      settings.sunLight.color.h,
      settings.sunLight.color.s,
      settings.sunLight.color.l
    )

    this.sunLight.position.set(
      settings.sunLight.position.x,
      settings.sunLight.position.y,
      settings.sunLight.position.z
    )
    this.sunLight.intensity = settings.sunLight.intensity
  }
}
