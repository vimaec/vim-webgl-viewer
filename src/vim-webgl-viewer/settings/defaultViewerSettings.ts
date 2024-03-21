import * as THREE from 'three'
import { floor } from '../../images'
import { GizmoOptions } from '../gizmos/gizmoAxes'
import { Settings } from './viewerSettings'

export type TextureEncoding = 'url' | 'base64' | undefined
export { GizmoOptions } from '../gizmos/gizmoAxes'


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
      moveSpeed: 1,
      scrollSpeed: 1.5
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
