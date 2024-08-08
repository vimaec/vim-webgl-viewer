import * as THREE from 'three'
import { floor } from '../../images'
import { AxesSettings } from '../gizmos/axes/axesSettings'
import { ViewerSettings } from './viewerSettings'

/**
 * Defines the default values for the VIM Viewer settings.
 */
export const defaultViewerSettings: ViewerSettings = {
  canvas: {
    id: undefined,
    resizeDelay: 200
  },
  camera: {
    orthographic: false,
    allowedMovement: new THREE.Vector3(1, 1, 1),
    allowedRotation: new THREE.Vector2(1, 1),
    near: 0.001,
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
      color: new THREE.Color(0x444444),
      opacity: 0.3,
      opacityAlways: 0.02
    }
  },
  background: { color: new THREE.Color(0xc1c2c6) },
  skybox: {
    skyColor: new THREE.Color(0xade1e6), // Light sky blue pastel
    groundColor: new THREE.Color(0xd1b17f), // Light earthy brown pastel
    sharpness: 2
  },
  groundPlane: {
    visible: false,
    encoding: 'base64',
    texture: floor,
    opacity: 1,
    color: new THREE.Color(0xffffff),
    size: 5
  },
  skylight: {
    skyColor: new THREE.Color(0xffffff),
    groundColor: new THREE.Color(0xffffff),
    intensity: 0.8
  },
  sunLights: [
    {
      position: new THREE.Vector3(-45.0, 40, -23),
      color: new THREE.Color(0xffffff),
      intensity: 0.8
    },
    {
      position: new THREE.Vector3(45.0, 40, 23),
      color: new THREE.Color(0xffffff),
      intensity: 0.2
    }
  ],
  materials: {
    standard: {
      color: new THREE.Color('#cccccc')
    },
    highlight: {
      color: new THREE.Color(0x6ad2ff),
      opacity: 0.5
    },
    isolation: {
      color: new THREE.Color('#4E525C'),
      opacity: 0.08
    },
    section: {
      strokeWidth: 0.01,
      strokeFalloff: 0.75,
      strokeColor: new THREE.Color(0xf6f6f6)
    },
    outline: {
      intensity: 3,
      falloff: 3,
      blur: 2,
      color: new THREE.Color(0x00ffff)
    }
  },
  axes: new AxesSettings(),
  rendering: {
    onDemand: true
  }
}
