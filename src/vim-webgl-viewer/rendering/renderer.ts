/**
 * @module viw-webgl-viewer/rendering
 */

import * as THREE from 'three'
import { IRenderer, Scene } from '../../vim-loader/scene'
import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'
import { ViewerMaterials } from '../../vim-loader/materials/viewerMaterials'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'

import { Camera } from '../camera/camera'
import { RenderingSection } from './renderingSection'
import { RenderingComposer } from './renderingComposer'
import { Settings } from '../viewerSettings'
import { SignalDispatcher } from 'ste-signals'

/**
 * Manages how vim objects are added and removed from the THREE.Scene to be rendered
 */
export class Renderer implements IRenderer {
  /**
   * The THREE WebGL renderer.
   */
  readonly renderer: THREE.WebGLRenderer
  
  /**
   * The THREE sample ui renderer
   */
  readonly textRenderer: CSS2DRenderer

  /**
   * Interface to interact with section box directly without using the gizmo.
   */
  readonly section: RenderingSection

  /**
   * Determines whether antialias will be applied to rendering or not.
   */
  antialias: boolean = true

  private _scene: RenderScene
  private _viewport: Viewport
  private _camera: Camera
  private _composer: RenderingComposer
  private _materials: ViewerMaterials
  private _renderText: boolean | undefined

  private _skipAntialias: boolean

  private _needsUpdate: boolean
  private _onSceneUpdate = new SignalDispatcher()
  private _onBoxUpdated = new SignalDispatcher()
  private _sceneUpdated = false

  // 3GB
  private maxMemory = 3 * Math.pow(10, 9)
  
  /**
   * Indicates whether the scene needs to be re-rendered.
   * Can only be set to true. Cleared on each render.
   */
  get needsUpdate () {
    return this._needsUpdate
  }

  set needsUpdate (value: boolean) {
    this._needsUpdate = this._needsUpdate || value
  }

  /**
 * Indicates whether the next render should skip antialiasing.
 * Useful for expensive operations such as the section box.
 * Can only be set to true. Cleared on each render.
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
    materials: ViewerMaterials,
    camera: Camera,
    settings: Settings
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

    this.textRenderer = this._viewport.textRenderer
    this.textEnabled = true

    this._composer = new RenderingComposer(
      this.renderer,
      scene,
      viewport,
      materials,
      camera
    )
    this._composer.onDemand = settings.rendering.onDemand

    this.section = new RenderingSection(this, this._materials)

    this.fitViewport()
    this._viewport.onResize.subscribe(() => this.fitViewport())
    this._camera.onSettingsChanged.sub(() => {
      this._composer.camera = this._camera.three
      this.needsUpdate = true
    })
    this._materials.onUpdate.sub(() => (this.needsUpdate = true))
    this.background = settings.background.color
  }

  /**
   * Removes all objects from rendering and disposes the WebGL context.
   */
  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this._composer.dispose()
  }

  /**
   * Gets or sets the background color or texture of the scene.
   */ 
  get background () {
    return this._scene.scene.background
  }

  set background (color: THREE.Color | THREE.Texture) {
    this._scene.scene.background = color
    this.needsUpdate = true
  }

  /**
   * Signal dispatched at the end of each frame if the scene was updated, such as visibility changes.
   */
  get onSceneUpdated() {
    return this._onSceneUpdate.asEvent();
  }

  /**
   * Signal dispatched when bounding box is updated.
   */
  get onBoxUpdated () {
    return this._onBoxUpdated.asEvent()
  }

  /**
   * Determines whether text rendering is enabled or not.
   */
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
   * Returns the bounding box encompassing all rendered objects.
   * @param target - Box in which to copy the result. A new instance is created if undefined.
   * @returns The bounding box encompassing all rendered objects.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._scene.getBoundingBox(target)
  }

  /**
   * Updates the global rendering bounding box.
   * @param box - The new bounding box.
   */
  updateBox (box: THREE.Box3) {
    this._scene.updateBox(box)
  }

  /**
   * Notifies that a scene was updated this frame.
   */
  notifySceneUpdate () {
    this._sceneUpdated = true
    this.needsUpdate = true
  }

  /**
   * Renders what is in the camera's view.
   */
  render () {
    if (this._scene.boxUpdated) {
      this._onBoxUpdated.dispatch()
      this._scene.boxUpdated = false
    }

    if (this._sceneUpdated) {
      this._onSceneUpdate.dispatch()
      this._sceneUpdated = false
    }

    this._composer.outlines = this._scene.hasOutline()
    this._composer.render(
      this.needsUpdate,
      this.antialias && !this.skipAntialias && !this._camera.hasMoved
    )
    this._needsUpdate = false
    this.skipAntialias = false

    if (this.textEnabled) {
      this.textRenderer.render(this._scene.scene, this._camera.three)
    }

    this._scene.clearUpdateFlags()
  }

  /**
   * Adds an object to be rendered.
   * @param target The object or scene to add for rendering.
   */
  add (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      const mem = target.getMemory()
      const remaining = this.maxMemory - this.estimatedMemory
      if (mem > remaining) {
        return false
      }
      target.renderer = this
      this._sceneUpdated = true
    }

    this._scene.add(target)
    this.notifySceneUpdate()
    return true
  }

  /**
   * Removes an object from rendering.
   * @param target The object or scene to remove from rendering.
   */
  remove (target: Scene | THREE.Object3D) {
    this._scene.remove(target)
    this.notifySceneUpdate()
  }

  /**
   * Clears all objects from rendering.
   */
  clear () {
    this._scene.clear()
    this._needsUpdate = true
  }

  /**
   * Returns an estimate of the memory used by the renderer.
   */
  get estimatedMemory () {
    return this._scene.estimatedMemory
  }

  /**
   * Determines the target sample count on the rendering target.
   * Higher number increases quality.
   */
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
