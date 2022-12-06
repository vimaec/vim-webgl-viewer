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

import { Camera } from '../camera'
import { RenderingSection } from './renderingSection'
import { RenderingComposer } from './renderingComposer'

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

  private _scene: RenderScene
  private _viewport: Viewport
  private _camera: Camera
  private _composer: RenderingComposer
  private _materials: VimMaterials
  private _onVisibilityChanged = new SimpleEventDispatcher<Vim>()
  private _renderText: boolean | undefined

  constructor (
    scene: RenderScene,
    viewport: Viewport,
    materials: VimMaterials,
    camera: Camera
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

    this.section = new RenderingSection(this.renderer, this._materials)

    this.fitViewport()
    this._viewport.onResize.subscribe(() => this.fitViewport())
    this._camera.onValueChanged.sub(
      () => (this._composer.camera = this._camera.camera)
    )
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
  get onVisibilityChanged () {
    return this._onVisibilityChanged.asEvent()
  }

  /** 2D renderer will render to screen when this is true. */
  get textEnabled () {
    return this._renderText ?? false
  }

  set textEnabled (value: boolean) {
    if (value === this._renderText) return
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
  render (camera: THREE.Camera, hasSelection: boolean) {
    this._composer.outlines = hasSelection
    this._composer.render()

    if (this.textEnabled) {
      this.textRenderer.render(this._scene.scene, camera)
    }

    this._scene.getUpdatedScenes().forEach((s) => {
      if (s.vim) this._onVisibilityChanged.dispatch(s.vim)
    })
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

  private fitViewport = () => {
    const size = this._viewport.getParentSize()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(size.x, size.y)
    this._composer.setSize(size.x, size.y)
    this.textRenderer.setSize(size.x, size.y)
  }
}
