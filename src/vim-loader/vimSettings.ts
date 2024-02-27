/**
 * @module vim-loader
 */

import deepmerge from 'deepmerge'
import { Transparency } from './geometry'
import * as THREE from 'three'

export type FileType = 'vim' | 'vimx' | undefined

/**
 * Represents settings for configuring the behavior and rendering of a vim object.
 */
export type VimSettings = {
  
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
   * Matrix representation of position, rotation and scale
   * Setting this will override position, rotation and scale
   */
  matrix: THREE.Matrix4

  /**
   * Defines how to draw or not to draw objects according to their transparency
   */
  transparency: Transparency.Mode

  /** Set to true to get verbose http logs. */
  verboseHttp: boolean
  

  // VIMX

  /**
   * Specifies file type (vim or vimx) if it cannot or should not be infered from file extension.
   */
  fileType: FileType

  /** Set to true to stream geometry to the scene. Only supported with vimx file. */
  progressive: boolean

  /**
   * Defines the time in miliseconds between each scene refresh in progressive loading.
   */
  progressiveInterval: number

  // LEGACY

  /** Set to true to use legacy loading pipeline. */
  legacy: boolean
  /** Instance indices of objects to load. All objects are loaded if no value provided in legacy pipeline. */
  legacyInstances: number[]
  /** Set to true to not download strings in legacy pipeline. */
  legacyNoStrings: boolean
  /** Set to true to not download element/geometry map in legacy pipeline */
  legacyNoMap: boolean
  /** Set to true to not download header in legacy pipeline. */
  legacyNoHeader: boolean
/** Set to true to load and display rooms. */
  legacyLoadRooms: boolean
}

export const defaultConfig: VimSettings = {
  legacyInstances: undefined,
  position: new THREE.Vector3(),
  rotation: new THREE.Vector3(),
  scale: 1,
  matrix: undefined,
  transparency: 'all',
  verboseHttp: false,

  // progressive
  fileType: undefined,
  legacy: false,
  progressive: false,
  progressiveInterval: 1000,

  legacyNoStrings: false,
  legacyNoMap: false,
  legacyNoHeader: false,
  legacyLoadRooms: false
  
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

  merge.matrix = merge.matrix ?? new THREE.Matrix4().compose(
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
