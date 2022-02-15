/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'

export type Vector3 = {
  x: number
  y: number
  z: number
}

export type ColorRGB = {
  r: number
  g: number
  b: number
}

export type ColorHSL = {
  h: number
  s: number
  l: number
}

/**
 * Plane under Scene related options
 */
export type PlaneOptions = {
  /** Enables/Disables plane under scene */
  show: boolean
  /** Local or remote texture url for plane */
  texture: string
  /** Opacity of the plane */
  opacity: number
  /** Color of the plane */
  color: ColorRGB
  /** Actual size is SceneRadius*size */
  size: number
}

/** Dom canvas related options */
export type CanvasOptions = {
  /** Canvas dom model id. If none provided a new canvas will be created */
  id: string
  /** Limits how often canvas will be resized if window is resized. */
  resizeDelay: number
}

/** Camera controls related options */
export type CameraControlsOptions = {
  /**
   * <p>Set true to start in orbit mode.</p>
   * <p>Camera has two modes: First person and orbit</p>
   * <p>First person allows to moves the camera around freely</p>
   * <p>Orbit rotates the camera around a focus point</p>
   */
  orbit: boolean
  /** Camera speed is scaled according to SceneRadius/sceneReferenceSize */
  vimReferenceSize: number
  /** Camera rotation speed factor */
  rotateSpeed: number
  orbitSpeed: number
  /** Camera movement speed factor */
  moveSpeed: number
}

/** Camera related options */
export type CameraOptions = {
  /** Near clipping plane distance */
  near: number
  /** Far clipping plane distance */
  far: number
  /** Fov angle in degrees */
  fov: number
  /** Zoom level */
  zoom: number
  /** See ControlOptions */
  controls: Partial<CameraControlsOptions>
  showGizmo: boolean
}

export type SunLightOptions = {
  position: Vector3
  color: ColorHSL
  intensity: number
}

export type SkyLightOptions = {
  skyColor: ColorHSL
  groundColor: ColorHSL
  intensity: number
}

/** Viewer related options independant from vims */
export type ViewerOptions = {
  /**
   * Webgl canvas related options
   */
  canvas: Partial<CanvasOptions>
  /**
   * Three.js camera related options
   */
  camera: Partial<CameraOptions>
  // background: Partial<BackgroundOptions>
  /**
   * Plane under scene related options
   */
  plane: Partial<PlaneOptions>
  /**
   * Skylight (hemisphere light) options
   */
  skylight: Partial<SkyLightOptions>
  /**
   * Sunlight (directional light) options
   */
  sunLight: Partial<SunLightOptions>
}

/**
 * <p>Wrapper around Viewer Options</p>
 * <p>Casts options values into related THREE.js type</p>
 * <p>Provides default values for options</p>
 */
export class ViewerSettings {
  public options: ViewerOptions

  constructor (options?: Partial<ViewerOptions>) {
    const fallback: ViewerOptions = {
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
          vimReferenceSize: 1,
          rotateSpeed: 1,
          orbitSpeed: 1,
          moveSpeed: 1
        },
        showGizmo: true
      },
      plane: {
        show: true,
        texture: null,
        opacity: 1,
        color: { r: 0xff, g: 0xff, b: 0xff },
        size: 3
      },
      skylight: {
        // skyColor: { h: 1, s: 1, l: 1 },
        skyColor: { h: 0.6, s: 1, l: 0.6 },
        groundColor: { h: 0.095, s: 1, l: 0.75 },
        // groundColor: { h: 1, s: 1, l: 1 },
        intensity: 0.6
        // intensity: 1
      },
      sunLight: {
        position: { x: -47.0, y: 22, z: -45 },
        // position: { x: 0, y: 0, z: -1000 },
        color: { h: 0.1, s: 1, l: 0.95 },
        // color: { h: 1, s: 1, l: 1 },
        intensity: 1
      }
    }

    this.options = options ? deepmerge(fallback, options, undefined) : fallback
  }

  // Canvas
  getCanvasResizeDelay = () => this.options.canvas.resizeDelay
  getCanvasId = () => this.options.canvas.id

  // Plane
  getPlaneShow = () => this.options.plane.show
  getPlaneColor = () => toRGBColor(this.options.plane.color)
  getPlaneTextureUrl = () => this.options.plane.texture
  getPlaneOpacity = () => this.options.plane.opacity
  getPlaneSize = () => this.options.plane.size

  // Skylight
  getSkylightColor = () => toHSLColor(this.options.skylight.skyColor)
  getSkylightGroundColor = () => toHSLColor(this.options.skylight.groundColor)
  getSkylightIntensity = () => this.options.skylight.intensity

  // Sunlight
  getSunlightColor = () => toHSLColor(this.options.sunLight.color)
  getSunlightPosition = () => toVec(this.options.sunLight.position)
  getSunlightIntensity = () => this.options.sunLight.intensity

  // Camera
  getCameraNear = () => this.options.camera.near
  getCameraFar = () => this.options.camera.far
  getCameraFov = () => this.options.camera.fov
  getCameraZoom = () => this.options.camera.zoom
  getCameraShowGizmo = () => this.options.camera.showGizmo

  // Camera Controls
  getCameraIsOrbit = () => this.options.camera.controls.orbit
  getCameraMoveSpeed = () => this.options.camera.controls.moveSpeed
  getCameraRotateSpeed = () => this.options.camera.controls.rotateSpeed
  getCameraOrbitSpeed = () => this.options.camera.controls.orbitSpeed
  getCameraReferenceVimSize = () =>
    this.options.camera.controls.vimReferenceSize
}

function toRGBColor (c: ColorRGB): THREE.Color {
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255)
}

function toHSLColor (obj: any): THREE.Color {
  return new THREE.Color().setHSL(obj.h, obj.s, obj.l)
}

function toVec (obj: Vector3): THREE.Vector3 {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}
