/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { floor } from '../images'
import { GizmoOptions } from './gizmos/gizmoAxes'

export type TextureEncoding = 'url' | 'base64' | undefined
export { GizmoOptions } from './gizmos/gizmoAxes'

/**
 * Makes all field optional recursively
 * https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript
 */
export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P]
}

/** Viewer related options independant from vims */
export type Settings = {
  /**
   * Webgl canvas related options
   */
  canvas: {
    /** Canvas dom model id. If none provided a new canvas will be created */
    id: string | undefined
    /** Limits how often canvas will be resized if window is resized. */
    resizeDelay: number
  }
  /**
   * Three.js camera related options
   */
  camera: {
    /** Near clipping plane distance */
    near: number
    /** Far clipping plane distance */
    far: number
    /** Fov angle in degrees */
    fov: number
    /** Zoom level */
    zoom: number
    /** Camera controls related options */
    controls: {
      /**
       * <p>Set true to start in orbit mode.</p>
       * <p>Camera has two modes: First person and orbit</p>
       * <p>First person allows to moves the camera around freely</p>
       * <p>Orbit rotates the camera around a focus point</p>
       */
      orbit: boolean
      /** Camera speed is scaled according to SceneRadius/sceneReferenceSize */
      modelReferenceSize: number
      /** Camera rotation speed factor */
      rotateSpeed: number
      orbitSpeed: number
      /** Camera movement speed factor */
      moveSpeed: number
    }
    /** Camera gizmo related options */
    gizmo: {
      enable: boolean
      size: number
      color: THREE.Color
      opacity: number
      opacityAlways: number
    }
  }
  // background: Partial<BackgroundOptions>
  /**
   * Plane under scene related options
   */
  groundPlane: {
    /** Enables/Disables plane under scene */
    visible: boolean
    encoding: TextureEncoding
    /** Local or remote texture url for plane */
    texture: string
    /** Opacity of the plane */
    opacity: number
    /** Color of the plane */
    color: THREE.Color
    /** Actual size is SceneRadius*size */
    size: number
  }
  /**
   * Skylight (hemisphere light) options
   */
  skylight: {
    skyColor: THREE.Color
    groundColor: THREE.Color
    intensity: number
  }

  /**
   * Object highlight on click options
   */
  materials: {
    highlight: {
      color: THREE.Color
      opacity: number
    }
    isolation: {
      color: THREE.Color
      opacity: number
    }
    section: {
      strokeWidth: number
      strokeFalloff: number
      strokeColor: THREE.Color
    }
    outline: {
      intensity: number
      falloff: number
      blur: number
      color: THREE.Color
    }
  }

  /**
   * Axes gizmo options
   */
  axes: Partial<GizmoOptions>

  /**
   * Sunlight (directional light) options
   */
  sunLights: {
    position: THREE.Vector3
    color: THREE.Color
    intensity: number
  }[]

  rendering: {
    onDemand: boolean
  }
}

export type PartialSettings = RecursivePartial<Settings>

const defaultConfig: Settings = {
  canvas: {
    id: undefined,
    resizeDelay: 200
  },
  camera: {
    near: 0.01,
    far: 15000,
    fov: 50,
    zoom: 1,
    controls: {
      orbit: true,
      modelReferenceSize: 1,
      rotateSpeed: 1,
      orbitSpeed: 1,
      moveSpeed: 1
    },
    gizmo: {
      enable: true,
      size: 0.005,
      color: new THREE.Color(0xff, 0xff, 0xff),
      opacity: 0.5,
      opacityAlways: 0.125
    }
  },
  groundPlane: {
    visible: true,
    encoding: 'base64',
    texture: floor,
    opacity: 1,
    color: new THREE.Color(0xff, 0xff, 0xff),
    size: 5
  },
  skylight: {
    skyColor: new THREE.Color().setHSL(0.6, 1, 0.6),
    groundColor: new THREE.Color().setHSL(0.095, 1, 0.75),
    intensity: 0.8
  },
  sunLights: [
    {
      position: new THREE.Vector3(-45.0, 40, -23),
      color: new THREE.Color().setHSL(0.1, 1, 0.95),
      intensity: 0.8
    },
    {
      position: new THREE.Vector3(45.0, 40, 23),
      color: new THREE.Color().setHSL(0.1, 1, 0.95),
      intensity: 0.2
    }
  ],
  materials: {
    highlight: {
      color: new THREE.Color(0x6a, 0xd2, 0xff),
      opacity: 0.5
    },
    isolation: {
      color: new THREE.Color(0x40, 0x40, 0x40),
      opacity: 0.1
    },
    section: {
      strokeWidth: 0.01,
      strokeFalloff: 0.75,
      strokeColor: new THREE.Color(0xf6, 0xf6, 0xf6)
    },
    outline: {
      intensity: 3,
      falloff: 3,
      blur: 2,
      color: new THREE.Color(0, 1, 1)
    }
  },
  axes: new GizmoOptions(),
  rendering: {
    onDemand: true
  }
}

export function getConfig (options?: PartialSettings) {
  return options
    ? (deepmerge(defaultConfig, options, undefined) as Settings)
    : (defaultConfig as Settings)
}
