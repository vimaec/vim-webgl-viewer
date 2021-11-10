/**
 @author VIM / https://vimaec.com
*/

export const ViewerSettings = {
  default: {
    showGui: true,
    showStats: true,
    camera: {
      near: 0.1,
      far: 15000,
      fov: 50,
      zoom: 1,
      rotate: 1.0,
      controls: {
        speed: 0.1,
        shiftMultiplier: 5.0,
        zoomSpeed: 0.2,
        rotateSpeed: 0.01,
        panSpeed: 0.1
      }
    },
    background: {
      color: { r: 0x72, g: 0x64, b: 0x5b }
    },
    plane: {
      show: true,
      material: {
        color: { r: 0x99, g: 0x99, b: 0x99 },
        specular: { r: 0x10, g: 0x10, b: 0x10 }
      },
      position: {
        x: 0,
        y: 0,
        z: 0
      }
    },
    skylight: {
      skyColor: { h: 0.6, s: 1, l: 0.6 },
      groundColor: { h: 0.095, s: 1, l: 0.75 },
      intensity: 0.6
    },
    sunLight: {
      position: { x: -1 * 30, y: 1.75 * 30, z: 1 * 30 },
      color: { h: 0.1, s: 1, l: 0.95 },
      intensity: 1
    },
    object: {
      scale: 0.01,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: {
        color: { r: 0x00, g: 0x55, b: 0xff },
        emissive: { r: 0x00, g: 0x00, b: 0x00 },
        specular: { r: 0x11, g: 0x11, b: 0x11 },
        flatShading: true,
        shininess: 30,
        wireframe: false
      }
    }
  }
}
