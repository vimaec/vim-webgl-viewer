/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { StandardMaterial } from './standardMaterial'
import { createMaskMaterial } from './maskMaterial'
import { createIsolationMaterial } from './isolationMaterial'
import { OutlineMaterial } from './outlineMaterial'
import { ViewerConfig } from '../../vim-webgl-viewer/viewerSettings'

/**
 * Defines the materials to be used by the vim loader and allows for material injection.
 */
export class VimMaterials {
  /**
   * Material used for opaque model geometry
   */
  opaque: StandardMaterial
  /**
   * Material used for transparent model geometry
   */
  transparent: StandardMaterial
  /**
   * Material used when creating wireframe geometry of the model
   */
  wireframe: THREE.LineBasicMaterial
  /**
   * Material used to show traces of hidden objects
   */
  isolation: THREE.Material
  /**
   * Material used to filter out what is not selected for selection outline effect.
   */
  mask: THREE.ShaderMaterial
  /**
   * Material used for selection outline effect.
   */
  outline: OutlineMaterial

  private _clippingPlanes: THREE.Plane[] | null
  private _sectionStrokeWitdh: number = 0.01
  private _sectionStrokeFallof: number = 0.75
  private _sectionStrokeColor: THREE.Color = new THREE.Color(0xf6, 0xf6, 0xf6)
  private _focusIntensity: number = 0.75
  private _focusColor: THREE.Color = new THREE.Color(1, 1, 1)

  constructor (
    opaque?: StandardMaterial,
    transparent?: StandardMaterial,
    wireframe?: THREE.LineBasicMaterial,
    isolation?: THREE.Material,
    mask?: THREE.ShaderMaterial,
    outline?: OutlineMaterial
  ) {
    this.opaque = opaque ?? new StandardMaterial(createOpaque())
    this.transparent = transparent ?? new StandardMaterial(createTransparent())
    this.wireframe = wireframe ?? createWireframe()
    this.isolation = isolation ?? createIsolationMaterial()
    this.mask = mask ?? createMaskMaterial()
    this.outline = outline ?? new OutlineMaterial()
  }

  /** Update material settings from config */
  applySettings (settings: ViewerConfig) {
    this.wireframeColor = settings.materials.highlight.color
    this.wireframeOpacity = settings.materials.highlight.opacity

    this.sectionStrokeWitdh = settings.materials.section.strokeWidth
    this.sectionStrokeFallof = settings.materials.section.strokeFalloff
    this.sectionStrokeColor = settings.materials.section.strokeColor

    this.outlineIntensity = settings.materials.outline.intensity
    this.outlineFalloff = settings.materials.outline.falloff
    this.outlineBlur = settings.materials.outline.blur
    this.outlineColor = settings.materials.outline.color
  }

  /**
   * Color intensity of focus effect on hover.
   */
  get focusIntensity () {
    return this._focusIntensity
  }

  set focusIntensity (value: number) {
    this._focusIntensity = value
    this.opaque.focusIntensity = value
    this.transparent.focusIntensity = value
  }

  /**
   * Color of focus effect on hover.
   */
  get focusColor () {
    return this._focusColor
  }

  set focusColor (value: THREE.Color) {
    this._focusColor = value
    this.opaque.focusColor = value
    this.transparent.focusColor = value
  }

  /**
   * Default color for wireframe meshes.
   */
  get wireframeColor () {
    return this.wireframe.color
  }

  set wireframeColor (value: THREE.Color) {
    this.wireframe.color = value
  }

  /**
   * Default opacity for wireframe meshes.
   */
  get wireframeOpacity () {
    return this.wireframe.opacity
  }

  set wireframeOpacity (value: number) {
    this.wireframe.opacity = value
  }

  /**
   * Applies clipping planes to all relevent materials
   */
  get clippingPlanes () {
    return this._clippingPlanes
  }

  set clippingPlanes (value: THREE.Plane[] | null) {
    this._clippingPlanes = value
    this.opaque.clippingPlanes = value
    this.transparent.clippingPlanes = value
    this.wireframe.clippingPlanes = value
    this.isolation.clippingPlanes = value
    this.mask.clippingPlanes = value
  }

  /**
   * Width of the stroke effect where the section box intersects the model.
   */
  get sectionStrokeWitdh () {
    return this._sectionStrokeWitdh
  }

  set sectionStrokeWitdh (value: number) {
    this._sectionStrokeWitdh = value
    this.opaque.sectionStrokeWitdh = value
    this.transparent.sectionStrokeWitdh = value
  }

  /**
   * Gradient of the stroke effect where the section box intersects the model.
   */
  get sectionStrokeFallof () {
    return this._sectionStrokeFallof
  }

  set sectionStrokeFallof (value: number) {
    this._sectionStrokeFallof = value
    this.opaque.sectionStrokeFallof = value
    this.transparent.sectionStrokeFallof = value
  }

  /**
   * Color of the stroke effect where the section box intersects the model.
   */
  get sectionStrokeColor () {
    return this._sectionStrokeColor
  }

  set sectionStrokeColor (value: THREE.Color) {
    this._sectionStrokeColor = value
    this.opaque.sectionStrokeColor = value
    this.transparent.sectionStrokeColor = value
  }

  /**
   * Size of the blur convolution on on the selection outline effect
   */
  get outlineBlur () {
    return this.outline.strokeBlur
  }

  set outlineBlur (value: number) {
    this.outline.strokeBlur = value
  }

  /**
   * Gradient of the the selection outline effect
   */
  get outlineFalloff () {
    return this.outline.strokeBias
  }

  set outlineFalloff (value: number) {
    this.outline.strokeBias = value
  }

  /**
   * Intensity of the the selection outline effect
   */
  get outlineIntensity () {
    return this.outline.strokeMultiplier
  }

  set outlineIntensity (value: number) {
    this.outline.strokeMultiplier = value
  }

  /**
   * Color of the the selection outline effect
   */
  get outlineColor () {
    return this.outline.color
  }

  set outlineColor (value: THREE.Color) {
    this.outline.color = value
  }

  /** dispose all materials. */
  dispose () {
    this.opaque.dispose()
    this.transparent.dispose()
    this.wireframe.dispose()
    this.isolation.dispose()
    this.mask.dispose()
    this.outline.dispose()
  }
}

/**
 * Creates a non-custom instance of phong material as used by the vim loader
 * @returns a THREE.MeshPhongMaterial
 */
export function createOpaque () {
  return new THREE.MeshPhongMaterial({
    color: 0x999999,
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
    shininess: 5
  })
}

/**
 * Creates a new instance of the default loader transparent material
 * @returns a THREE.MeshPhongMaterial
 */
export function createTransparent () {
  const mat = createOpaque()
  mat.transparent = true
  mat.shininess = 70
  return mat
}

/**
 * Creates a new instance of the default wireframe material
 * @returns a THREE.LineBasicMaterial
 */
export function createWireframe () {
  const material = new THREE.LineBasicMaterial({
    depthTest: false,
    opacity: 1,
    color: new THREE.Color(0x0000ff),
    transparent: true
  })
  return material
}
