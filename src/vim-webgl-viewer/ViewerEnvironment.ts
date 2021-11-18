import * as THREE from 'three'
import { ViewerSettings } from './viewerSettings'
// import grid from '../../grid.png'

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

  // TODO Remove values
  static createDefault (): ViewerEnvironment {
    // Ground
    const plane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(1, 1),
      new THREE.MeshBasicMaterial()
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

  getElements (): THREE.Object3D[] {
    return [this.plane, this.skyLight, this.sunLight]
  }

  applySettings (settings: ViewerSettings, model: THREE.Box3) {
    // Plane
    if (model) {
      this.plane.visible = settings.getPlaneShow()
      // this.plane.position.copy(settings.getPlanePosition())
      const center = model.getCenter(new THREE.Vector3())
      const sphere = model.getBoundingSphere(new THREE.Sphere())
      this.plane.position.set(center.x, model.min.y, center.z)

      if (settings.raw.plane.texture) {
        const l = new THREE.TextureLoader()
        this.plane.material = new THREE.MeshBasicMaterial({
          map: l.load(settings.raw.plane.texture)
          // map: l.load(grid)
        })
      }

      this.plane.scale.set(
        sphere.radius * 3,
        sphere.radius * 3,
        sphere.radius * 3
      )
    }

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
