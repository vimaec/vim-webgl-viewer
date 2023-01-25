/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../../vim-loader/scene'
import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'
import { VimMaterials } from '../../vim-loader/materials/materials'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { SimpleEventDispatcher } from 'ste-simple-events'
import { Vim } from '../../vim'

import { Camera } from '../camera/camera'
import { RenderingSection } from './renderingSection'
import { RenderingComposer } from './renderingComposer'
import { Settings } from '../viewerSettings'

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  /**
   * Three webgl renderer
   */
  renderer: THREE.WebGLRenderer
  /**
   * Three sample ui renderer
   */
  textRenderer: CSS2DRenderer

  /**
   * Interface to interact with section box directly without using the gizmo.
   */
  section: RenderingSection

  /**
   * Set to false to disable antialiasing. Default is true.
   */
  antialias: boolean = true

  private _scene: RenderScene
  private _viewport: Viewport
  private _camera: Camera
  private _composer: RenderingComposer
  private _materials: VimMaterials
  private _onSceneUpdate = new SimpleEventDispatcher<Vim>()
  private _renderText: boolean | undefined
  private _needsUpdate: boolean
  private _skipAntialias: boolean

  /**
   * Set this to true to cause a re-render of the scene.
   * Can only be set to true, Cleared on each render.
   */
  get needsUpdate () {
    return this._needsUpdate
  }

  set needsUpdate (value: boolean) {
    this._needsUpdate = this._needsUpdate || value
  }

  /**
   * Set this to true to cause the next render to ignore antialiasing
   * Useful for expensive operations such as section box.
   * Can only be set to true, Cleared on each render.
   */
  get skipAntialias () {
    return this._skipAntialias
  }

  set skipAntialias (value: boolean) {
    this._skipAntialias = this._skipAntialias || value
  }

  constructor (
    scene: RenderScene,
    viewport: Viewport,
    materials: VimMaterials,
    camera: Camera,
    config: Settings
  ) {
    this._viewport = viewport
    this._scene = scene
    this._materials = materials
    this._camera = camera

    this.renderer = new THREE.WebGLRenderer({
      canvas: viewport.canvas,
      antialias: true,
      precision: 'highp', // 'lowp', 'mediump', 'highp'
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    })

    this.textRenderer = this._viewport.createTextRenderer()
    this.textEnabled = false

    this._composer = new RenderingComposer(
      this.renderer,
      scene,
      viewport,
      materials,
      camera
    )
    this._composer.onDemand = config.rendering.onDemand

    this.section = new RenderingSection(this, this._materials)

    this.fitViewport()
    this._viewport.onResize.subscribe(() => this.fitViewport())
    this._camera.onValueChanged.sub(() => {
      this._composer.camera = this._camera.camera
      this.needsUpdate = true
    })
    this._materials.onUpdate.sub(() => (this.needsUpdate = true))
  }

  /**
   * Removes all objects from rendering and dispose the WEBGL Context
   */
  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this._composer.dispose()
  }

  /**
   * Event called at the end of frame for each vim in which an object changed visibility.
   */
  get onSceneUpdated () {
    return this._onSceneUpdate.asEvent()
  }

  /** 2D renderer will render to screen when this is true. */
  get textEnabled () {
    return this._renderText ?? false
  }

  set textEnabled (value: boolean) {
    if (value === this._renderText) return
    this.needsUpdate = true
    this._renderText = value
    this.textRenderer.domElement.style.display = value ? 'block' : 'none'
  }

  /**
   * Returns the bounding box encompasing all rendererd objects.
   * @param target box in which to copy result, a new instance is created if undefined.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._scene.getBoundingBox(target)
  }

  /**
   * Render what is in camera.
   */
  render () {
    this._scene.getUpdatedScenes().forEach((s) => {
      this.needsUpdate = true
      if (s.vim) this._onSceneUpdate.dispatch(s.vim)
    })

    this._composer.outlines = this._scene.hasOutline()
    this._composer.render(
      this.needsUpdate,
      this.antialias && !this.skipAntialias && !this._camera.hasMoved
    )
    this._needsUpdate = false
    this.skipAntialias = false

    if (this.textEnabled) {
      this.textRenderer.render(this._scene.scene, this._camera.camera)
    }

    this._scene.clearUpdateFlags()
  }

  /**
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    this._scene.add(target)
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    this._scene.remove(target)
  }

  /**
   * Removes all rendered objects
   */
  clear () {
    this._scene.clear()
  }

  /** Set the target sample count on the rendering target. Higher number will increase quality. */
  get samples () {
    return this._composer.samples
  }

  set samples (value: number) {
    this._composer.samples = value
  }

  private fitViewport = () => {
    const size = this._viewport.getParentSize()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(size.x, size.y)
    this._composer.setSize(size.x, size.y)
    this.textRenderer.setSize(size.x, size.y)
    this.needsUpdate = true
  }
}
