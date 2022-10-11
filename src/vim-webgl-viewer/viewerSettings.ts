/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { VimOptions } from '../vim-loader/vimSettings'

export namespace ViewerOptions {
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
  export type GroundPlane = {
    /** Enables/Disables plane under scene */
    visible: boolean
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
  export type Canvas = {
    /** Canvas dom model id. If none provided a new canvas will be created */
    id: string
    /** Limits how often canvas will be resized if window is resized. */
    resizeDelay: number
  }

  /** Camera controls related options */
  export type CameraControls = {
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

  /** Camera Gizmo related options */
  export type CameraGizmo = {
    enable: boolean
    size: number
    color: ColorRGB
    opacity: number
    opacityAlways: number
  }

  /** Camera related options */
  export type Camera = {
    /** Near clipping plane distance */
    near: number
    /** Far clipping plane distance */
    far: number
    /** Fov angle in degrees */
    fov: number
    /** Zoom level */
    zoom: number
    /** See ControlOptions */
    controls: Partial<CameraControls>
    /** See CameraGizmo */
    gizmo: Partial<CameraGizmo>
  }

  export type SunLight = {
    position: VimOptions.Vector3
    color: ColorHSL
    intensity: number
  }

  export type SkyLight = {
    skyColor: ColorHSL
    groundColor: ColorHSL
    intensity: number
  }

  export type ColorRGBA = {
    color: ColorRGB
    opacity: number
  }

  export type Materials = {
    highlight: Partial<ColorRGBA>
    isolation: Partial<ColorRGBA>
  }

  /** Viewer related options independant from vims */
  export type Root = {
    /**
     * Webgl canvas related options
     */
    canvas: Partial<Canvas>
    /**
     * Three.js camera related options
     */
    camera: Partial<Camera>
    // background: Partial<BackgroundOptions>
    /**
     * Plane under scene related options
     */
    groundPlane: Partial<GroundPlane>
    /**
     * Skylight (hemisphere light) options
     */
    skylight: Partial<SkyLight>
    /**
     * Sunlight (directional light) options
     */
    sunLights: Partial<SunLight[]>

    /**
     * Object highlight on click options
     */
    materials: Partial<Materials>
  }
}

/**
 * <p>Wrapper around Viewer Options</p>
 * <p>Casts options values into related THREE.js type</p>
 * <p>Provides default values for options</p>
 */
export class ViewerSettings {
  public options: ViewerOptions.Root

  constructor (options?: Partial<ViewerOptions.Root>) {
    const fallback: ViewerOptions.Root = {
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
        gizmo: {
          enable: true,
          size: 0.005,
          color: { r: 0xff, g: 0xff, b: 0xff },
          opacity: 0.5,
          opacityAlways: 0.125
        }
      },
      groundPlane: {
        visible: false,
        texture: undefined,
        opacity: 1,
        color: { r: 0xff, g: 0xff, b: 0xff },
        size: 3
      },
      skylight: {
        skyColor: { h: 0.6, s: 1, l: 0.6 },
        groundColor: { h: 0.095, s: 1, l: 0.75 },
        intensity: 0.8
      },
      sunLights: [
        {
          position: { x: -45.0, y: 40, z: -23 },
          color: { h: 0.1, s: 1, l: 0.95 },
          intensity: 0.8
        },
        {
          position: { x: 45.0, y: 40, z: 23 },
          color: { h: 0.1, s: 1, l: 0.95 },
          intensity: 0.2
        }
      ],
      materials: {
        highlight: {
          color: { r: 0x6a, g: 0xd2, b: 0xff },
          opacity: 0.5
        },
        isolation: {
          color: { r: 0x40, g: 0x40, b: 0x40 },
          opacity: 0.1
        }
      }
    }

    this.options = options ? deepmerge(fallback, options, undefined) : fallback
  }

  // Canvas
  getCanvasResizeDelay = () => this.options.canvas.resizeDelay!
  getCanvasId = () => this.options.canvas.id

  // Plane
  getGroundPlaneVisible = () => this.options.groundPlane.visible!
  getGroundPlaneColor = () => toRGBColor(this.options.groundPlane.color!)
  getGroundPlaneTextureUrl = () => this.options.groundPlane.texture!
  getGroundPlaneOpacity = () => this.options.groundPlane.opacity!
  getGroundPlaneSize = () => this.options.groundPlane.size!

  // Skylight
  getSkylightColor = () => toHSLColor(this.options.skylight.skyColor!)
  getSkylightGroundColor = () => toHSLColor(this.options.skylight.groundColor!)

  getSkylightIntensity = () => this.options.skylight.intensity!

  // Sunlight
  getSunlightCount = () => this.options.sunLights.length
  getSunlightColor = (index: number) => {
    const color = this.options.sunLights[index]?.color
    return color ? toHSLColor(color) : undefined
  }

  getSunlightPosition = (index: number) => {
    const pos = this.options.sunLights[index]?.position
    return pos ? toVec(pos) : undefined
  }

  getSunlightIntensity = (index: number) =>
    this.options.sunLights[index]?.intensity

  private get highlight () {
    return this.options.materials.highlight
  }

  getHighlightColor = () => toRGBColor(this.highlight!.color!)
  getHighlightOpacity = () => this.highlight!.opacity!

  private get isolation () {
    return this.options.materials.isolation
  }

  getIsolationColor = () => toRGBColor(this.isolation!.color!)
  getIsolationOpacity = () => this.isolation!.opacity!

  // Camera
  private get camera () {
    return this.options.camera
  }

  getCameraNear = () => this.camera.near!
  getCameraFar = () => this.camera.far!
  getCameraFov = () => this.camera.fov!
  getCameraZoom = () => this.camera.zoom!
  getCameraGizmoEnable = () => this.camera.gizmo!.enable!
  getCameraGizmoSize = () => this.camera.gizmo!.size!
  getCameraGizmoColor = () => toRGBColor(this.camera.gizmo!.color!)
  getCameraGizmoOpacity = () => this.camera.gizmo!.opacity!
  getCameraGizmoOpacityAlways = () => this.camera.gizmo!.opacityAlways!

  // Camera Controls
  private get cameraControls () {
    return this.camera.controls!
  }

  getCameraIsOrbit = () => this.cameraControls.orbit!
  getCameraMoveSpeed = () => this.cameraControls.moveSpeed!
  getCameraRotateSpeed = () => this.cameraControls.rotateSpeed!
  getCameraOrbitSpeed = () => this.cameraControls.orbitSpeed!
  getCameraReferenceVimSize = () => this.cameraControls.vimReferenceSize!
}

function toRGBColor (c: ViewerOptions.ColorRGB): THREE.Color {
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255)
}

function toHSLColor (obj: ViewerOptions.ColorHSL): THREE.Color {
  return new THREE.Color().setHSL(obj.h, obj.s, obj.l)
}

function toVec (obj: VimOptions.Vector3): THREE.Vector3 {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}
