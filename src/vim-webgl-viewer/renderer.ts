/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../vim-loader/scene'
import { Viewport } from './viewport'
import { RenderScene } from './renderScene'
import { IMaterialLibrary, VimMaterials } from '../vim-loader/materials'
import { ViewerSettings } from './viewerSettings'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { SimpleEventDispatcher } from 'ste-simple-events'
import { Vim } from '../vim'
import { CustomOutlinePass } from './selectionOutlinePass'

import { Camera } from './camera'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'

class Section {
  private _renderer: THREE.WebGLRenderer

  private _materials: IMaterialLibrary
  private _active: boolean = true

  readonly box: THREE.Box3 = new THREE.Box3(
    new THREE.Vector3(-100, -100, -100),
    new THREE.Vector3(100, 100, 100)
  )

  private maxX: THREE.Plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0))
  private minX: THREE.Plane = new THREE.Plane(new THREE.Vector3(1, 0, 0))
  private maxY: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, -1, 0))
  private minY: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
  private maxZ: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, -1))
  private minZ: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
  private planes: THREE.Plane[] = [
    this.maxX,
    this.minX,
    this.maxY,
    this.minY,
    this.maxZ,
    this.minZ
  ]

  constructor (renderer: THREE.WebGLRenderer, materials: IMaterialLibrary) {
    this._renderer = renderer
    this._materials = materials
  }

  fitBox (box: THREE.Box3) {
    this.maxX.constant = box.max.x
    this.minX.constant = -box.min.x
    this.maxY.constant = box.max.y
    this.minY.constant = -box.min.y
    this.maxZ.constant = box.max.z
    this.minZ.constant = -box.min.z
    this.box.copy(box)
  }

  set active (value: boolean) {
    // Has to be null and not undefined because some three code depends on it.
    const p = value ? this.planes : null
    this._materials.opaque.clippingPlanes = p
    this._materials.transparent.clippingPlanes = p
    this._materials.wireframe.clippingPlanes = p
    this._materials.isolation.clippingPlanes = p
    this._materials.focus.clippingPlanes = p
    this._materials.outline.clippingPlanes = p
    this._renderer.localClippingEnabled = value
    this._active = value
  }

  get active () {
    return this._active
  }
}

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  renderer: THREE.WebGLRenderer
  textRenderer: CSS2DRenderer
  viewport: Viewport
  scene: RenderScene
  section: Section
  materials: VimMaterials
  camera: Camera

  selectionComposer: EffectComposer
  selectionTarget: THREE.WebGLRenderTarget
  sceneComposer: EffectComposer
  sceneTarget: THREE.WebGLRenderTarget
  depthTexture: THREE.DepthTexture
  outlinePass: any

  private _onVisibilityChanged = new SimpleEventDispatcher<Vim>()
  get onVisibilityChanged () {
    return this._onVisibilityChanged.asEvent()
  }

  /** 2D renderer will be rendered when this is true. */
  private _renderText: boolean | undefined
  get renderText () {
    return this._renderText ?? false
  }

  set renderText (value: boolean) {
    if (value === this._renderText) return
    this._renderText = value
    this.textRenderer.domElement.style.display = value ? 'block' : 'none'
  }

  constructor (
    scene: RenderScene,
    viewport: Viewport,
    materials: VimMaterials,
    camera: Camera
  ) {
    this.viewport = viewport

    this.scene = scene
    this.materials = materials
    this.camera = camera
    this.renderer = new THREE.WebGLRenderer({
      canvas: viewport.canvas,
      antialias: false,
      precision: 'highp', // 'lowp', 'mediump', 'highp'
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    })

    this.section = new Section(this.renderer, this.materials)
    this.textRenderer = this.viewport.createTextRenderer()
    this.renderText = false

    this.fitViewport()
    this.viewport.onResize(() => this.fitViewport())

    this.renderer.setPixelRatio(window.devicePixelRatio)

    const size = this.viewport.getSize()

    // Composer for regular scene rendering
    this.sceneTarget = new THREE.WebGLRenderTarget(size.x, size.y)

    this.sceneComposer = new EffectComposer(this.renderer, this.sceneTarget)
    this.sceneComposer.renderToScreen = false
    this.sceneComposer.addPass(
      new RenderPass(this.scene.scene, this.camera.camera)
    )

    // Composer for selection effect
    this.depthTexture = new THREE.DepthTexture(size.x, size.y)
    this.selectionTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      depthTexture: this.depthTexture,
      depthBuffer: true
    })
    this.selectionComposer = new EffectComposer(
      this.renderer,
      this.selectionTarget
    )

    // Render only selected objects
    this.selectionComposer.addPass(
      new RenderPass(this.scene.scene, this.camera.camera, materials.outline)
    )

    // Render higlight from selected object on top of regular scene
    this.outlinePass = new CustomOutlinePass(
      new THREE.Vector2(size.x, size.y),
      this.scene.scene,
      this.camera.camera
    )
    this.selectionComposer.addPass(this.outlinePass)

    // Insert the result of scene composer into the outline composer
    const uniforms = this.outlinePass.fsQuad.material.uniforms
    uniforms.sceneColorBuffer.value = this.sceneComposer.readBuffer.texture

    // Lastly a antialiasing pass to replace browser AA.
    const effectFXAA = new ShaderPass(FXAAShader)
    effectFXAA.uniforms.resolution.value.set(1 / size.x, 1 / size.y)
    this.selectionComposer.addPass(effectFXAA)
  }

  /**
   * Removes all objects from rendering and dispose the WEBGL Context
   */
  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this.sceneTarget.dispose()
    this.selectionTarget.dispose()
    this.depthTexture.dispose()
  }

  /**
   * Returns the bounding box encompasing all rendererd objects.
   * @param target box in which to copy result, a new instance is created if undefined.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this.scene.getBoundingBox(target)
  }

  /**
   * Render what is in camera.
   */
  render (camera: THREE.Camera) {
    this.sceneComposer.render()
    this.selectionComposer.render()

    if (this.renderText) {
      this.textRenderer.render(this.scene.scene, camera)
    }

    this.scene.getUpdatedScenes().forEach((s) => {
      if (s.vim) this._onVisibilityChanged.dispatch(s.vim)
    })
    this.scene.clearUpdateFlags()
  }

  /**
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    this.scene.add(target)
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    this.scene.remove(target)
  }

  /**
   * Removes all rendered objects
   */
  clear () {
    this.scene.clear()
  }

  /** Update material settings from config */
  applyMaterialSettings (settings: ViewerSettings) {
    this.materials.applyWireframeSettings(
      settings.getHighlightColor(),
      settings.getHighlightOpacity()
    )
    this.materials.applySectionSettings(
      settings.getSectionStrokeWidth(),
      settings.getSectionStrokeFalloff(),
      settings.getSectionStrokeColor()
    )
  }

  private fitViewport = () => {
    const size = this.viewport.getParentSize()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(size.x, size.y)
    this.textRenderer.setSize(size.x, size.y)
  }
}
