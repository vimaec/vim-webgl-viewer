/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Scene } from '../../vim-loader/scene'
import { Viewport } from '../viewport'
import { RenderScene } from '../renderScene'
import { VimMaterials } from '../../vim-loader/materials'
import { ViewerSettings } from '../viewerSettings'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { SimpleEventDispatcher } from 'ste-simple-events'
import { Vim } from '../../vim'

import { Camera } from '../camera'
import { RenderingSection } from './renderingSection'
import { SelectionRenderer } from './selectionRenderer'
import { StandardRenderer } from './standardRenderer'

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer {
  renderer: THREE.WebGLRenderer
  textRenderer: CSS2DRenderer
  viewport: Viewport
  scene: RenderScene
  materials: VimMaterials
  camera: Camera

  section: RenderingSection
  selectionRenderer: SelectionRenderer
  standardRenderer: StandardRenderer

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

    this.textRenderer = this.viewport.createTextRenderer()
    this.renderText = false

    this.selectionRenderer = new SelectionRenderer(
      this.renderer,
      scene,
      viewport,
      materials,
      camera
    )

    this.standardRenderer = new StandardRenderer(
      this.renderer,
      scene,
      viewport,
      camera
    )

    this.section = new RenderingSection(this.renderer, this.materials)

    this.fitViewport()
    this.viewport.onResize(() => this.fitViewport())
  }

  /**
   * Removes all objects from rendering and dispose the WEBGL Context
   */
  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this.standardRenderer.dispose()
    this.selectionRenderer.dispose()
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
  render (camera: THREE.Camera, hasSelection: boolean) {
    const r = hasSelection ? this.selectionRenderer : this.standardRenderer
    r.render()

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
    this.standardRenderer.setSize(size.x, size.y)
    this.selectionRenderer.setSize(size.x, size.y)
    this.textRenderer.setSize(size.x, size.y)
  }
}