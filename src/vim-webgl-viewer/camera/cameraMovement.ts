/**
 * @module viw-webgl-viewer/camera
 */

import { Camera } from './camera'
import { Object } from '../../vim'
import * as THREE from 'three'

export abstract class CameraMovement {
  protected _camera: Camera

  constructor (camera: Camera) {
    this._camera = camera
  }

  abstract move3(vector: THREE.Vector3): void

  move2 (vector: THREE.Vector2, axes: 'XY' | 'XZ'): void {
    const direction =
      axes === 'XY'
        ? new THREE.Vector3(-vector.x, vector.y, 0)
        : axes === 'XZ'
          ? new THREE.Vector3(-vector.x, 0, vector.y)
          : undefined

    if (direction) this.move3(direction)
  }

  move1 (amount: number, axis: 'X' | 'Y' | 'Z'): void {
    const direction = new THREE.Vector3(
      axis === 'X' ? -amount : 0,
      axis === 'Y' ? amount : 0,
      axis === 'Z' ? amount : 0
    )

    this.move3(direction)
  }

  abstract rotate(angle: THREE.Vector2): void

  abstract zoom(amount: number): void

  abstract setDistance(dist: number): void

  abstract orbit(vector: THREE.Vector2): void

  orbitTowards (direction: THREE.Vector3) {
    const forward = this._camera.forward

    // Compute angle between vectors on a flat plane.
    const flatP = forward.clone().setY(0)
    const flatT = direction.clone().setY(0)
    const azimuth = flatP.angleTo(flatT) * Math.sign(flatP.cross(flatT).y)

    // Compute difference between angles infered by elevation.
    const declination = Math.asin(direction.y) - Math.asin(forward.y)

    // convert to degress
    const angle = new THREE.Vector2(declination, azimuth)
    angle.multiplyScalar(180 / Math.PI)

    this.orbit(angle)
  }

  abstract target(target: Object | THREE.Vector3): void

  abstract reset(): void

  abstract set(position: THREE.Vector3, target?: THREE.Vector3)

  frame (
    target: Object | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    forward?: THREE.Vector3
  ): void {
    console.log('FRAME')
    if (target instanceof Object) {
      target = target.getBoundingBox()
    }
    if (target === 'all') {
      target = this._camera._scene.getBoundingBox()
      console.log(target)
    }
    if (target instanceof THREE.Box3) {
      target = target.getBoundingSphere(new THREE.Sphere())
    }
    if (target instanceof THREE.Sphere) {
      this.frameSphere(target, forward ?? this._camera.forward)
    }
  }

  protected frameSphere (sphere: THREE.Sphere, forward: THREE.Vector3) {
    // Compute best distance to frame sphere
    const fov = (this._camera.camPerspective.camera.fov * Math.PI) / 180
    const dist = (sphere.radius * 1.2) / Math.tan(fov / 2)

    const pos = forward.clone().multiplyScalar(-dist).add(sphere.center)

    this.set(pos, sphere.center)
  }
}
