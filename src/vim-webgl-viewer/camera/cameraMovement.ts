/**
 * @module viw-webgl-viewer/camera
 */

import { Camera } from './camera'
import { Object } from '../../vim-loader/object'
import { IObject } from '../../vim-loader/objectInterface'
import * as THREE from 'three'
import { GizmoMarker } from '../gizmos/markers/gizmoMarker'
import { Vim } from '../../vim-loader/vim'

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

    // Clone to avoid side effect on argument
    const _direction = direction.clone()
    
    // Makes the azimuth be zero for vertical directions
    // This avoids weird spin around the axis.
    if(_direction.x === 0 && _direction.z ===0){
      _direction.x = this._camera.forward.x * 0.001
      _direction.z = this._camera.forward.z * 0.001
      _direction.normalize()
    }
    
    // Remove Y component.
    const flatForward = forward.clone().setY(0)
    const flatDirection = _direction.clone().setY(0)

    // Compute angle between vectors on a flat plane.
    const cross = flatForward.clone().cross(flatDirection)
    const clockwise = cross.y == 0 ? 1 : Math.sign(cross.y)
    const azimuth = flatForward.angleTo(flatDirection) * clockwise

    // Compute the declination angle between the two vectors.
    const angleForward = flatForward.angleTo(forward) * Math.sign(forward.y)
    const angleDirection = flatDirection.angleTo(_direction) * Math.sign(_direction.y)
    const declination = angleForward - angleDirection

    // Convert to degrees.
    const angle = new THREE.Vector2(-declination, azimuth)
    angle.multiplyScalar(180 / Math.PI)

    // Apply rotation.
    this.orbit(angle)
  }

  abstract target(target: Object | THREE.Vector3): void

  abstract reset(): void

  abstract set(position: THREE.Vector3, target?: THREE.Vector3)

    frame (
    target: IObject | Vim | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    forward?: THREE.Vector3
  ): void {
    
    if ((target instanceof GizmoMarker) || (target instanceof Object)) {
      target = target.getBoundingBox()
    }
    if ((target instanceof Vim) ) {
      target = target.scene.getBoundingBox()
    }
    if (target === 'all') {
      target = this._camera._scene.getBoundingBox()
    }
    if (target instanceof THREE.Box3) {
      target = target.getBoundingSphere(new THREE.Sphere())
    }
    if (target instanceof THREE.Sphere) {
      this.frameSphere(target, forward)
    }
  }

  protected frameSphere (sphere: THREE.Sphere, forward?: THREE.Vector3) {
    var direction = this.getNormalizedDirection(forward)
    // Compute best distance to frame sphere
    const fov = (this._camera.camPerspective.camera.fov * Math.PI) / 180
    const dist = (sphere.radius * 1.2) / Math.tan(fov / 2)

    const pos = direction.multiplyScalar(-dist).add(sphere.center)

    this.set(pos, sphere.center)
  }

  private getNormalizedDirection(forward?: THREE.Vector3){
    if(!forward){
      return this._camera.forward
    }
    if(forward.x ===0 && forward.y === 0 && forward.z ===0){
      return this._camera.forward
    }
    return forward.clone().normalize()
  }
}
