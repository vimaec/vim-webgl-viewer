/**
 * @module vim-loader
 */

import deepmerge from 'deepmerge'
import { cloneDeep } from 'lodash-es'
import { Transparency } from './geometry'
import * as THREE from 'three'

export namespace VimOptions {
  export type Vector3 = {
    x: number
    y: number
    z: number
  }

  /**
   * Config object for loading a vim
   */
  export type Root = {
    /**
     * Position offset for the vim
     */
    position?: Vector3
    /**
     * Rotation for the vim
     */
    rotation?: Vector3
    /**
     * Scale factor for the vim
     */
    scale?: number

    /**
     * Defines how to draw or not to draw objects according to their transparency
     */
    transparency?: Transparency.Mode

    /**
     * Forces the viewer to download the whole data at once.
     * Otherwise bim data will be requested on per need basis.
     */
    forceDownload?: boolean
  }
}

/**
 * <p>Wrapper around Vim Options.</p>
 * <p>Casts options values into related THREE.js type</p>
 * <p>Provides default values for options</p>
 */
export class VimSettings {
  private options: VimOptions.Root

  constructor (options?: Partial<VimOptions.Root>) {
    const fallback: VimOptions.Root = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      transparency: 'all',
      forceDownload: false
    }

    this.options = options ? deepmerge(fallback, options, undefined) : fallback
    this.options.transparency = Transparency.isValid(this.options.transparency!)
      ? this.options.transparency
      : 'all'
  }

  getOptions = () => cloneDeep(this.options) as VimOptions.Root

  getPosition = () => toVec(this.options.position!)
  getRotation = () => toQuaternion(this.options.rotation!)
  getScale = () => scalarToVec(this.options.scale!)
  getMatrix = () =>
    new THREE.Matrix4().compose(
      this.getPosition(),
      this.getRotation(),
      this.getScale()
    )

  getTransparency = () => this.options.transparency!
  getForceDownload = () => this.options.forceDownload!
}

function toVec (obj: VimOptions.Vector3): THREE.Vector3 {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}

function toQuaternion (rot: VimOptions.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(toEuler(toVec(rot)))
}

function scalarToVec (x: number): THREE.Vector3 {
  return new THREE.Vector3(x, x, x)
}

function toEuler (rot: THREE.Vector3): THREE.Euler {
  return new THREE.Euler(
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180
  )
}
