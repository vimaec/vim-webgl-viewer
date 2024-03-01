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
   * The positional offset for the vim object.
   */
  position: THREE.Vector3
  
  /**
   * The XYZ rotation applied to the vim object.
   */
  rotation: THREE.Vector3

  /**
   * The scaling factor applied to the vim object.
   */
  scale: number

  /**
   * The matrix representation of the vim object's position, rotation, and scale.
   * Setting this will override individual position, rotation, and scale properties.
   */
  matrix: THREE.Matrix4

  /**
   * Determines whether objects are drawn based on their transparency.
   */
  transparency: Transparency.Mode

  /** 
   * Set to true to enable verbose HTTP logging.
   */
  verboseHttp: boolean
  
  // VIMX

  /**
   * Specifies the file type (vim or vimx) if it cannot or should not be inferred from the file extension.
   */
  fileType: FileType

  /** 
   * Set to true to stream geometry to the scene. Only supported with vimx files.
   */
  progressive: boolean

  /**
   * The time in milliseconds between each scene refresh during progressive loading.
   */
  progressiveInterval: number

  // LEGACY

  /** 
   * Set to true to use the legacy loading pipeline.
   */
  legacy: boolean

  /** 
   * The instance indices of objects to load. All objects are loaded if no value is provided in the legacy pipeline.
   */
  legacyInstances: number[]

  /** 
   * Set to true to prevent downloading strings in the legacy pipeline.
   */
  legacyNoStrings: boolean

  /** 
   * Set to true to prevent downloading the element/geometry map in the legacy pipeline.
   */
  legacyNoMap: boolean

  /** 
   * Set to true to prevent downloading the header in the legacy pipeline.
   */
  legacyNoHeader: boolean

  /** 
   * Set to true to load and display rooms in the legacy pipeline.
   */
  legacyLoadRooms: boolean
}

/**
 * Default configuration settings for a vim object.
 */
export const defaultConfig: VimSettings = {
  position: new THREE.Vector3(),
  rotation: new THREE.Vector3(),
  scale: 1,
  matrix: undefined,
  transparency: 'all',
  verboseHttp: false,

  // progressive
  fileType: undefined,
  progressive: false,
  progressiveInterval: 1000,

  //legacy
  legacy: false,
  legacyInstances: undefined,
  legacyNoStrings: false,
  legacyNoMap: false,
  legacyNoHeader: false,
  legacyLoadRooms: false
}

/**
 * Represents a partial configuration of settings for a vim object.
 */
export type VimPartialSettings = Partial<VimSettings>

/**
 * Wraps Vim options, converting values to related THREE.js types and providing default values.
 * @param {VimPartialSettings} [options] - Optional partial settings for the Vim object.
 * @returns {VimSettings} The complete settings for the Vim object, including defaults.
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
