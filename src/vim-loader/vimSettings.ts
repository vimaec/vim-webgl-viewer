/**
 * @module vim-loader
 */

import deepmerge from 'deepmerge'
import { Transparency } from './geometry'
import * as THREE from 'three'

/**
 * Config object for loading a vim
 */
export type VimSettings = {
  /** Instance indices of objects to load. All objects are loaded if no value provided. */
  instances: number[]
  /**
   * Position offset for the vim
   */
  position: THREE.Vector3
  /**
   * Rotation for the vim
   */
  rotation: THREE.Vector3
  /**
   * Scale factor for the vim
   */
  scale: number

  /**
   * Matrix representation of position, rotation scale
   */
  matrix: THREE.Matrix4

  /**
   * Defines how to draw or not to draw objects according to their transparency
   */
  transparency: Transparency.Mode

  /**
   * Set to true to load room geometry.
   */
  loadRooms: boolean

  /** Set to true to get verbose http logs. */
  loghttp: boolean

  /**
   * Forces the viewer to download the whole data at once.
   * Otherwise bim data will be requested on per need basis.
   */
  streamBim: boolean

  /** EXPERIMENTAL: Set to true to get geometry from a REST server. */
  restApi: string
  /** EXPERIMENTAL: Set to true to stream geometry. Can be really slow on big models. */
  streamGeometry: boolean
  /** EXPERIMENTAL: Set to true to not download strings. */
  noStrings: boolean
  /** EXPERIMENTAL: Set to true to not download element/geometry map */
  noMap: boolean
  /** EXPERIMENTAL: Set to true to not download header. */
  noHeader: boolean
}

export const defaultConfig: VimSettings = {
  instances: undefined,
  loadRooms: false,
  position: new THREE.Vector3(),
  rotation: new THREE.Vector3(),
  scale: 1,
  matrix: new THREE.Matrix4(),
  transparency: 'all',

  restApi: undefined,
  streamBim: false,
  streamGeometry: false,
  noStrings: false,
  noMap: false,
  noHeader: false,
  loghttp: false
}

export type VimPartialSettings = Partial<VimSettings>
/**
 * <p>Wrapper around Vim Options.</p>
 * <p>Casts options values into related THREE.js type</p>
 * <p>Provides default values for options</p>
 */
export function getFullSettings (options?: VimPartialSettings) {
  const merge = options
    ? deepmerge(defaultConfig, options, undefined)
    : defaultConfig

  merge.transparency = Transparency.isValid(merge.transparency!)
    ? merge.transparency
    : 'all'

  merge.matrix = new THREE.Matrix4().compose(
    merge.position,
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        (merge.rotation.x * Math.PI) / 180,
        (merge.rotation.y * Math.PI) / 180,
        (merge.rotation.z * Math.PI) / 180
      )
    ),
    new THREE.Vector3(merge.scale, merge.scale, merge.scale)
  )

  return merge
}
