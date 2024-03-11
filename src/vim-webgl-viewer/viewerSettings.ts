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
    /**
     * Canvas dom model id. If none provided a new canvas will be created
     * Default: undefined.
     */
    id: string | undefined

    /**
     * Limits how often canvas will be resized if window is resized in ms.
     * Default: 200
     */
    resizeDelay: number
  }
  /**
   * Three.js camera related options
   */
  camera: {
    /**
     * Start with orthographic camera
     * Default: false
     */
    orthographic: boolean

    /**
     * Vector3 of 0 or 1 to enable/disable movement along each axis
     * Default: THREE.Vector3(1, 1, 1)
     */
    allowedMovement: THREE.Vector3

    /**
     * Vector2 of 0 or 1 to enable/disable rotation around x or y.
     * Default: THREE.Vector2(1, 1)
     */
    allowedRotation: THREE.Vector2

    /**
     * Near clipping plane distance
     * Default: 0.01
     */
    near: number

    /**
     * Far clipping plane distance
     * Default: 15000
     */
    far: number

    /**
     * Fov angle in degrees
     * Default: 50
     */
    fov: number

    /**
     * Camera zoom level
     * Default: 1
     */
    zoom: number

    /**
     * Initial forward vector of the camera
     * THREE.Vector3(1, -1, 1)
     */
    forward: THREE.Vector3

    /** Camera controls related options */
    controls: {
      /**
       * <p>Set true to start in orbit mode.</p>
       * <p>Camera has two modes: First person and orbit</p>
       * <p>First person allows to moves the camera around freely</p>
       * <p>Orbit rotates the camera around a focus point</p>
       * Default: true
       */
      orbit: boolean

      /**
       * Camera rotation speed factor
       * Default: 1
       */
      rotateSpeed: number
      
      /**
       * Camera orbit rotation speed factor.
       * Default: 1
       */
      orbitSpeed: number

      /**
       * Camera movement speed factor
       * Default: 1
       */
      moveSpeed: number
    }

    /** Camera gizmo related options */
    gizmo: {
      /**
      * Enables/Disables camera gizmo.
      * Default: true
      */
      enable: boolean

      /**
      * Size of camera gizmo.
      * Default: 0.01
      */
      size: number

      /**
      * Color of camera gizmo.
      * Default: THREE.Color(255, 255, 255)
      */
      color: THREE.Color

      /** 
      * Opacity of the camera gizmo.
      * Default: 0.5
      */
      opacity: number

      /**
      * Opacity of the camera gizmo when behind objects.
      * Default: 0.125
      */
      opacityAlways: number
    }
  }
  /**
   * Rendering background options
   */
  background: {
    /** 
     * Color of the cavas background
     * Default: THREE.Color('#96999f')
     */
    color: THREE.Color
  }
  /**
   * Ground plane under the scene options.
   */
  groundPlane: {
    /**
    * Enables/Disables plane under scene
    * Default: true
    */
    visible: boolean

    /**
    * Controls how the texture will be retrieved using the texture field.
    * Default: base64
    */
    encoding: TextureEncoding

    /**
    * Local or remote texture url for plane
    * Default: Vim halo ground provided with the viewer.
    */
    texture: string

    /**
    * Opacity of the plane
    * Default: 1
    */
    opacity: number

    /**
    * Color of the plane
    * Default: THREE.Color(0xff, 0xff, 0xff)
    */
    color: THREE.Color

    /**
    * Size of the ground plane relative to the model
    * Default: 5
    */
    size: number
  }

/**
* Object highlight on click options
*/
materials: {
  /**
  * Highlight on hover options
  */
  highlight: {
    /**
    * Highlight color
    * Default: rgb(106, 210, 255)
    */
    color: THREE.Color
    /**
    * Highlight opacity
    * Default: 0.5
    */
    opacity: number
  }
  /**
  * Isolation material options
  */
  isolation: {
    /**
    * Isolation material color
    * Default: rgb(78, 82, 92)
    */
    color: THREE.Color
    /**
    * Isolation material opacity
    * Default: 0.08
    */
    opacity: number
  }
  /**
  * Section box intersection highlight options
  */
  section: {
    /**
    * Intersection highlight stroke width.
    * Default: 0.01
    */
    strokeWidth: number;
    /**
    * Intersection highlight stroke falloff.
    * Default: 0.75
    */
    strokeFalloff: number;
    /**
    * Intersection highlight stroke color.
    * Default: rgb(246, 246, 246)
    */
    strokeColor: THREE.Color;
  }
  /**
  * Selection outline options
  */
  outline: {
    /**
    * Selection outline intensity.
    * Default: 3
    */
    intensity: number;
    /**
    * Selection outline falloff.
    * Default: 3
    */
    falloff: number;
    /**
    * Selection outline blur.
    * Default: 2
    */
    blur: number;
    /**
    * Selection outline color.
    * Default: rgb(0, 255, 255)
    */
    color: THREE.Color;
  }
}

  /**
   * Axes gizmo options
   */
  axes: Partial<GizmoOptions>

  /**
   * Skylight (hemisphere light) options
   */
  skylight: {
    /**
    * Skylight sky Color.
    * Default: THREE.Color(153, 204, 255)
    */
    skyColor: THREE.Color

    /**
    * Skylight ground color.
    * Default: THREE.Color(242, 213, 181)
    */
    groundColor: THREE.Color

    /**
    * Skylight intensity.
    * Default: 0.8
    */
    intensity: number
  }
  /**
   * Sunlight (directional light) options
   * Two Blue-Green lights at odd angles. See defaultViewerSettings.
   */
  sunLights: {
    /** Light position. */
    position: THREE.Vector3;
    /** Light color. */
    color: THREE.Color;
    /** Light intensity. */
    intensity: number;
  }[]

  rendering: {
    /**
     * Enable on-demand rendering which wait for changes before rendering to the canvas.
     * Default: true
     */
    onDemand: boolean
  }
}

export type PartialSettings = RecursivePartial<Settings>

export const defaultViewerSettings: Settings = {
  canvas: {
    id: undefined,
    resizeDelay: 200
  },
  camera: {
    orthographic: false,
    allowedMovement: new THREE.Vector3(1, 1, 1),
    allowedRotation: new THREE.Vector2(1, 1),
    near: 0.01,
    far: 15000,
    fov: 50,
    zoom: 1,
    // 45 deg down looking down z.
    forward: new THREE.Vector3(1, -1, 1),
    controls: {
      orbit: true,
      rotateSpeed: 1,
      orbitSpeed: 1,
      moveSpeed: 1
    },

    gizmo: {
      enable: true,
      size: 0.01,
      color: new THREE.Color(0xff, 0xff, 0xff),
      opacity: 0.5,
      opacityAlways: 0.125
    }
  },
  background: { color: new THREE.Color('#96999f') },
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
      color: new THREE.Color('#4E525C'),
      opacity: 0.08
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

export function getSettings (options?: PartialSettings) {
  return options
    ? (deepmerge(defaultViewerSettings, options, undefined) as Settings)
    : (defaultViewerSettings as Settings)
}
