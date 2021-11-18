/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'

export const defaultSettings = {
  default: {
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
      color: { h: 0.6, s: 1, l: 0.6 },
      groundColor: { h: 0.095, s: 1, l: 0.75 },
      intensity: 0.6
    },
    sunLight: {
      position: { x: -47.0, y: 22, z: -45 },
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

export class ViewerSettings {
  raw: any

  constructor (raw: any) {
    this.raw = deepmerge(defaultSettings.default, raw, undefined)
  }

  getPlaneShow = () => this.raw.plane.show
  getPlanePosition = () => this.raw.plane.position
  getPlaneColor = () => toRGBColor(this.raw.plane.material.color)
  getBackgroundColor = () => toRGBColor(this.raw.background.color)

  getObjectMatrix = () =>
    new THREE.Matrix4().compose(
      this.getObjectPosition(),
      this.getObjectRotation(),
      this.getObjectScale()
    )

  getSkylightColor = () => toHSLColor(this.raw.skylight.color)
  getSkylightGroundColor = () => toHSLColor(this.raw.skylight.groundColor)
  getSkylightIntensity = () => this.raw.skylight.intensity

  getSunlightColor = () => toHSLColor(this.raw.sunLight.color)
  getSunlightPosition = () => toVec(this.raw.sunLight.position)
  getSunlightIntensity = () => this.raw.sunLight.intensity

  getObjectPosition = () => toVec(this.raw.object.position)
  getObjectRotation = () => toQuaternion(this.raw.object.rotation)
  getObjectScale = () => scalarToVec(this.raw.object.scale)

  getColor = () => toRGBColor(this.raw.object.material.color)
  getFlatShading = () => this.raw.object.material.flatShading
  getEmissive = () => toRGBColor(this.raw.object.material.emissive)
  getSpecular = () => toRGBColor(this.raw.object.material.specular)
  getWireframe = () => this.raw.object.material.wireframe
  getShininess = () => this.raw.object.material.shininess

  updateMaterial (material: THREE.MeshPhongMaterial) {
    material.color = this.getColor() ?? material.color
    material.flatShading = this.getFlatShading() ?? material.flatShading

    material.emissive = this.getEmissive() ?? material.emissive
    material.specular = this.getSpecular() ?? material.specular

    material.wireframe = this.getWireframe() ?? material.wireframe
    material.shininess = this.getShininess() ?? material.shininess
  }
}

function isRGBColor (obj: any): boolean {
  return typeof obj === 'object' && 'r' in obj && 'g' in obj && 'b' in obj
}

function toRGBColor (c: any): THREE.Color {
  if (!isRGBColor(c)) {
    throw new Error('Not a RGB color')
  }
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255)
}
function isHSLColor (obj: any): boolean {
  return typeof obj === 'object' && 'h' in obj && 's' in obj && 'l' in obj
}

function toHSLColor (obj: any): THREE.Color {
  if (!isHSLColor(obj)) {
    throw new Error('Not a HSL color')
  }
  const color = new THREE.Color()
  color.setHSL(obj.h, obj.s, obj.l)
  return color
}

function isVector (obj: any): boolean {
  return typeof obj === 'object' && 'x' in obj && 'y' in obj && 'z' in obj
}
export function toVec (obj: any): THREE.Vector3 {
  if (!isVector(obj)) {
    throw new Error('Not a vector')
  }
  return new THREE.Vector3(obj.x, obj.y, obj.z)
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

function toQuaternion (rot: THREE.Vector3): THREE.Quaternion {
  const q = new THREE.Quaternion()
  q.setFromEuler(toEuler(rot))
  return q
}
