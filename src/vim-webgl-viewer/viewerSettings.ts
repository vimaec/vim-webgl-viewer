/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'

export const defaultViewerSettings = {
  camera: {
    near: 0.1,
    far: 15000,
    fov: 50,
    zoom: 1,
    rotate: 1.0,
    controls: {
      modelReferenceSize: 1,
      rotateSpeed: 1,
      moveSpeed: 1
    }
  },
  background: {
    color: { r: 0x72, g: 0x64, b: 0x5b }
  },
  plane: {
    show: true,
    texture: null,
    opacity: 1,
    color: { r: 0xff, g: 0xff, b: 0xff },
    size: 3
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
  }
}

export const defaultModelSettings = {
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

export class ModelSettings {
  data: any

  constructor (options: any) {
    this.data = deepmerge(defaultModelSettings, options, undefined)
  }

  getURL = () => this.data.url
  getObjectPosition = () => toVec(this.data.position)
  getObjectRotation = () => toQuaternion(this.data.rotation)
  getObjectScale = () => scalarToVec(this.data.scale)
  getObjectMatrix = () =>
    new THREE.Matrix4().compose(
      this.getObjectPosition(),
      this.getObjectRotation(),
      this.getObjectScale()
    )

  getColor = () => toRGBColor(this.data.material.color)
  getFlatShading = () => this.data.material.flatShading
  getEmissive = () => toRGBColor(this.data.material.emissive)
  getSpecular = () => toRGBColor(this.data.material.specular)
  getWireframe = () => this.data.material.wireframe
  getShininess = () => this.data.material.shininess

  updateMaterial (material: THREE.MeshPhongMaterial) {
    material.color = this.getColor() ?? material.color
    material.flatShading = this.getFlatShading() ?? material.flatShading

    material.emissive = this.getEmissive() ?? material.emissive
    material.specular = this.getSpecular() ?? material.specular

    material.wireframe = this.getWireframe() ?? material.wireframe
    material.shininess = this.getShininess() ?? material.shininess
  }
}

export class ViewerSettings {
  raw: any

  constructor (raw: any) {
    this.raw = deepmerge(defaultViewerSettings, raw, undefined)
  }

  getPlaneColor = () => toRGBColor(this.raw.plane.color)
  getBackgroundColor = () => toRGBColor(this.raw.background.color)

  getSkylightColor = () => toHSLColor(this.raw.skylight.color)
  getSkylightGroundColor = () => toHSLColor(this.raw.skylight.groundColor)
  getSkylightIntensity = () => this.raw.skylight.intensity

  getSunlightColor = () => toHSLColor(this.raw.sunLight.color)
  getSunlightPosition = () => toVec(this.raw.sunLight.position)
  getSunlightIntensity = () => this.raw.sunLight.intensity

  getCameraMoveSpeed = () => this.raw.camera.controls.moveSpeed
  getCameraRotateSpeed = () => this.raw.camera.controls.rotateSpeed
  getCameraReferenceModelSize = () =>
    this.raw.camera.controls.modelReferenceSize
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
