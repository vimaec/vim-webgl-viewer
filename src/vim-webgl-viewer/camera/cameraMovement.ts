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

  abstract orbitTowards(direction: THREE.Vector3)

  abstract target(target: Object | THREE.Vector3): void

  abstract reset(): void

  abstract set(position: THREE.Vector3, target?: THREE.Vector3)

  frame (
    target: Object | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    angle?: number
  ): void {
    if (target instanceof Object) {
      target = target.getBoundingBox()
    }
    if (target === 'all') {
      target = this._camera._scene.getBoundingBox()
    }
    if (target instanceof THREE.Box3) {
      target = target.getBoundingSphere(new THREE.Sphere())
    }
    if (target instanceof THREE.Sphere) {
      this.frameSphere(target, angle)
    }
  }

  protected abstract frameSphere(
    sphere: THREE.Sphere,
    angle: number | undefined
  )
}
