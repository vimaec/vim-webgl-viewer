/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { VimOptions } from '../vim-loader/vimSettings'
import { floor } from '../images'
import { GizmoOptions } from './gizmos/gizmoAxes'

export type TextureEncoding = 'url' | 'base64' | undefined
export { GizmoOptions } from './gizmos/gizmoAxes'

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

  export /**
   * Plane under Scene related options
   */
  type GroundPlane = {
    /** Enables/Disables plane under scene */
    visible: boolean
    encoding: TextureEncoding
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
    section: Partial<{
      strokeWidth: number
      strokeFalloff: number
      strokeColor: ColorRGB
    }>
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

    /**
     * Axes gizmo options
     */
    axes: Partial<GizmoOptions>
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
        visible: true,
        encoding: 'base64',
        texture: floor,
        opacity: 1,
        color: { r: 0xff, g: 0xff, b: 0xff },
        size: 5
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
        },
        section: {
          strokeWidth: 0.01,
          strokeFalloff: 0.65,
          strokeColor: { r: 0xf6, g: 0xf6, b: 0xf6 }
        }
      },
      axes: new GizmoOptions()
    }

    this.options = options ? deepmerge(fallback, options, undefined) : fallback
  }

  // Canvas
  getCanvasResizeDelay = () => this.options.canvas.resizeDelay!
  getCanvasId = () => this.options.canvas.id

  // Plane
  private get groundPlane () {
    return this.options.groundPlane
  }

  getGroundPlaneVisible = () => this.groundPlane.visible!
  getGroundPlaneColor = () => toRGBColor(this.groundPlane.color!)
  getGroundPlaneEncoding = () => this.groundPlane.encoding
  getGroundPlaneTexture = () => this.groundPlane.texture!
  getGroundPlaneOpacity = () => this.groundPlane.opacity!
  getGroundPlaneSize = () => this.groundPlane.size!

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

  // Material
  getHighlightColor = () => toRGBColor(this.highlight!.color!)
  getHighlightOpacity = () => this.highlight!.opacity!

  private get isolation () {
    return this.options.materials.isolation
  }

  getIsolationColor = () => toRGBColor(this.isolation!.color!)
  getIsolationOpacity = () => this.isolation!.opacity!

  private get section () {
    return this.options.materials.section
  }

  getSectionStrokeWidth = () => this.section!.strokeWidth!
  getSectionStrokeFalloff = () => this.section!.strokeFalloff!
  getSectionStrokeColor = () => toRGBColor(this.section!.strokeColor!)

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

  getAxesConfig = () => this.options.axes
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
