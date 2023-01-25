import { ISignal } from 'ste-signals'

/**
 * None : Frame from current position
 * Center : Cam.y = Object.y
 * number: Angle between the xz plane and the camera
 */
export type FrameAngle = 'none' | 'center' | number

export interface ICamera {
  /**
   * Three.js camera
   */
  camera: THREE.Camera
  /**
   * Multiplier for camera movements.
   */
  speed: number

  /**
   * True: Camera orbit around target mode.
   * False: First person free camera mode.
   */
  orbitMode: boolean

  /**
   * True: Orthographic camera.
   * False: Perspective camera.
   */
  orthographic: boolean

  /**
   * Current local velocity
   */
  localVelocity: THREE.Vector3

  /**
   * Moves the camera along all three axes.
   */
  move3(vector: THREE.Vector3): void

  /**
   * Moves the camera along two axes.
   */
  move2(vector: THREE.Vector2, axes: 'XY' | 'XZ'): void

  /**
   * Moves the camera along one axis.
   */
  move1(amount: number, axis: 'X' | 'Y' | 'Z'): void

  /**
   * Rotates the camera around the X or Y axis or both
   * @param vector where coordinates in range [-1, 1] for rotations of [-180, 180] degrees
   */
  rotate(vector: THREE.Vector2, lerp?: boolean): void

  /**
   * Moves the camera closer or farther away from orbit target.
   * @param amount movement size.
   */
  zoom(amount: number, lerp?: boolean): void

  /**
   * Moves the camera around the target so that it looks down given forward vector
   * @param forward direction vector
   */
  orbit(forward: THREE.Vector3, lerp?: boolean): void

  /**
   * Sets orbit mode target and moves camera accordingly
   */
  target(target: Object | THREE.Vector3, lerp?: boolean): void

  /**
   * Moves and rotates the camera so that target is well framed.
   * @param target Vim or Three object to frame, all to frame the whole scene, undefined has no effect.
   * @param angle None will not force any angle, Center will force camera.y = object.y, providing an angle will move the camera so it is looking down at object by the provided angle.
   * @param lerp Wether to lerp the camera over time or not.
   */
  frame(
    target: Object | THREE.Sphere | THREE.Box3 | 'all' | undefined,
    angle?: FrameAngle,
    lerp?: boolean
  ): void

  /**
   * Restore camera to initial values.
   */
  reset(): void

  /**
   * Returns the world height of the camera frustrum at given point
   */
  frustrumSizeAt(point: THREE.Vector3): THREE.Vector2

  /**
   * World forward of the camera.
   */
  get forward(): THREE.Vector3

  /**
   * Returns the position of the orbit center.
   */
  get orbitPosition(): THREE.Vector3

  /**
   * Signal dispatched when camera settings are updated.
   */
  get onValueChanged(): ISignal

  /**
   * Signal dispatched when camera is moved.
   */
  get onMoved(): ISignal
}

type Lerp = 'None' | 'Position' | 'Rotation' | 'Both'
