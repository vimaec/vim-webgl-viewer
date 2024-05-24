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

  /**
   * Moves the camera by the specified 3D vector.
   * @param {THREE.Vector3} vector - The 3D vector representing the direction and distance of movement.
   */
  abstract move3(vector: THREE.Vector3): void

  /**
   * Moves the camera in a specified 2D direction within a plane defined by the given axes.
   * @param {THREE.Vector2} vector - The 2D vector representing the direction of movement.
   * @param {'XY' | 'XZ'} axes - The axes defining the plane of movement ('XY' or 'XZ').
   */
  move2 (vector: THREE.Vector2, axes: 'XY' | 'XZ'): void {
    const direction =
      axes === 'XY'
        ? new THREE.Vector3(-vector.x, vector.y, 0)
        : axes === 'XZ'
          ? new THREE.Vector3(-vector.x, 0, vector.y)
          : undefined

    if (direction) this.move3(direction)
  }

  /**
   * Moves the camera along a specified axis by a given amount.
   * @param {number} amount - The amount to move the camera.
   * @param {'X' | 'Y' | 'Z'} axis - The axis along which to move the camera ('X', 'Y', or 'Z').
   */
  move1 (amount: number, axis: 'X' | 'Y' | 'Z'): void {
    const direction = new THREE.Vector3(
      axis === 'X' ? -amount : 0,
      axis === 'Y' ? amount : 0,
      axis === 'Z' ? amount : 0
    )

    this.move3(direction)
  }

  /**
   * Rotates the camera by the specified angles.
   * @param {THREE.Vector2} angle - The 2D vector representing the rotation angles around the X and Y axes.
   */
  abstract rotate(angle: THREE.Vector2): void

  /**
   * Changes the distance between the camera and its target by a specified factor.
   * @param {number} amount - The factor by which to change the distance (e.g., 0.5 for halving the distance, 2 for doubling the distance).
   */
  abstract zoom(amount: number): void

  /**
   * Sets the distance between the camera and its target to the specified value.
   * @param {number} dist - The new distance between the camera and its target.
   */
  abstract setDistance(dist: number): void

  /**
   * Orbits the camera around its target by the given angle while maintaining the distance.
   * @param {THREE.Vector2} vector - The 2D vector representing the orbit angles around the X and Y axes.
   */
  abstract orbit(vector: THREE.Vector2): void

  /**
   * Orbits the camera around its target to align with the given direction.
   * @param {THREE.Vector3} direction - The direction towards which the camera should be oriented.
   */
  orbitTowards (direction: THREE.Vector3) {
    const forward = this._camera.forward

    // Clone to avoid side effect on argument
    const _direction = direction.clone()

    // Makes the azimuth be zero for vertical directions
    // This avoids weird spin around the axis.
    if (_direction.x === 0 && _direction.z === 0) {
      _direction.x = this._camera.forward.x * 0.001
      _direction.z = this._camera.forward.z * 0.001
      _direction.normalize()
    }

    // Remove Y component.
    const flatForward = forward.clone().setY(0)
    const flatDirection = _direction.clone().setY(0)

    // Compute angle between vectors on a flat plane.
    const cross = flatForward.clone().cross(flatDirection)
    const clockwise = cross.y === 0 ? 1 : Math.sign(cross.y)
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

  /**
   * Rotates the camera without moving so that it looks at the specified target.
   * @param {Object | THREE.Vector3} target - The target object or position to look at.
   */
  abstract target(target: Object | THREE.Vector3): void

  /**
   * Resets the camera to its last saved position and orientation.
   */
  abstract reset(): void

  /**
   * Moves both the camera and its target to the given positions.
   * @param {THREE.Vector3} position - The new position of the camera.
   * @param {THREE.Vector3 | undefined} [target] - The new position of the target (optional).
   */
  abstract set(position: THREE.Vector3, target?: THREE.Vector3)

  /**
   * Sets the camera's orientation and position to focus on the specified target.
   * @param {IObject | Vim | THREE.Sphere | THREE.Box3 | 'all' | undefined} target - The target object, or 'all' to frame all objects.
   * @param {THREE.Vector3} [forward] - Optional forward direction after framing.
   */
  frame (
    target: IObject | Vim | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    forward?: THREE.Vector3
  ): void {
    if ((target instanceof GizmoMarker) || (target instanceof Object)) {
      target = target.getBoundingBox()
    }
    if ((target instanceof Vim)) {
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
    const direction = this.getNormalizedDirection(forward)
    // Compute best distance to frame sphere
    const fov = (this._camera.camPerspective.camera.fov * Math.PI) / 180
    const dist = (sphere.radius * 1.2) / Math.tan(fov / 2)

    const pos = direction.multiplyScalar(-dist).add(sphere.center)

    this.set(pos, sphere.center)
  }

  private getNormalizedDirection (forward?: THREE.Vector3) {
    if (!forward) {
      return this._camera.forward
    }
    if (forward.x === 0 && forward.y === 0 && forward.z === 0) {
      return this._camera.forward
    }
    return forward.clone().normalize()
  }
}
