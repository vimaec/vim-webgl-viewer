/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { Settings, getSettings, PartialSettings } from './viewerSettings'
import { Camera } from './camera/camera'
import { Input } from './inputs/input'
import { Selection } from './selection'
import { Environment, IEnvironment } from './environment'
import { Raycaster } from './raycaster'
import { GizmoOrbit } from './gizmos/gizmoOrbit'
import { GizmoLoading } from './gizmos/gizmoLoading'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { Gizmos } from './gizmos/gizmos'
import { GizmoAxes } from './gizmos/gizmoAxes'
import { SectionBox } from './gizmos/sectionBox/sectionBox'
import { Measure, IMeasure } from './gizmos/measure/measure'
import { GizmoRectangle } from './gizmos/gizmoRectangle'
import { VimX } from '../vim-loader/progressive/vimx'

import { Vim, GizmoGrid, VimMaterials, createBoxes } from '../vim'

// loader
import { Renderer } from './rendering/renderer'
import { SignalDispatcher } from 'ste-signals'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  /**
   * Current viewer settings.
   */
  settings: Settings

  /**
   * Interface to manage objects to be rendered.
   */
  renderer: Renderer

  /**
   * Interface to manage html canvas.
   */
  viewport: Viewport

  /**
   * Interface to manage viewer selection.
   */
  selection: Selection

  /**
   * Interface to manipulate default viewer inputs.
   */
  inputs: Input

  /**
   * Interface to raycast into the scene to find objects.
   */
  raycaster: Raycaster

  /**
   * Interface to interact with viewer materials
   */
  materials: VimMaterials

  /**
   * Interface to manipulate the viewer camera.
   */
  get camera () {
    return this._camera
  }

  /**
   * Interface to manipulate THREE elements not directly related to vim.
   */
  get environment () {
    return this._environment as IEnvironment
  }

  /**
   * Signal dispatched when a new vim is loaded or unloaded.
   */
  get onVimLoaded () {
    return this._onVimLoaded.asEvent()
  }

  private _environment: Environment
  private _camera: Camera
  private _clock = new THREE.Clock()
  gizmos: Gizmos

  // State
  private _vims = new Set<Vim | VimX>()
  private _onVimLoaded = new SignalDispatcher()
  private _updateId: number

  constructor (options?: PartialSettings) {
    this.settings = getSettings(options)

    this.materials = VimMaterials.getInstance()

    const scene = new RenderScene()
    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(scene, this.viewport, this.settings)
    this.renderer = new Renderer(
      scene,
      this.viewport,
      this.materials,
      this._camera,
      this.settings
    )

    this.inputs = new Input(this)

    this.gizmos = new Gizmos(this)
    this.materials.applySettings(this.settings)

    // TODO add options
    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))
    this.renderer.onBoxUpdated.subscribe((_) => {
      const box = this.renderer.getBoundingBox()
      this._environment.adaptToContent(box)
      this.gizmos.section.fitBox(box)
    })

    // Input and Selection
    this.selection = new Selection(this.materials)
    this.raycaster = new Raycaster(
      this.viewport,
      this._camera,
      scene,
      this.renderer
    )

    this.inputs.registerAll()

    // Start Loop
    this.animate()
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    this._updateId = requestAnimationFrame(() => this.animate())
    // Camera
    this.renderer.needsUpdate = this._camera.update(this._clock.getDelta())
    // Rendering
    this.renderer.render()
  }

  /**
   * Returns an array with all loaded vims.
   */
  get vims () {
    return this.vimxs.map((v) => (v instanceof VimX ? v.vim : v))
  }

  /**
   * Returns an array with all loaded vims or vimxs.
   */
  get vimxs () {
    return Array.from(this._vims)
  }

  /**
   * Current loaded vim count
   */
  get vimCount () {
    return this._vims.size
  }

  add (vim: Vim | VimX) {
    if (this._vims.has(vim)) {
      throw new Error('Vim cannot be added again, unless removed first.')
    }

    const success = this.renderer.add(vim.scene)
    if (!success) {
      throw new Error('Could not load vim. Max geometry memory reached.')
    }

    this._vims.add(vim)
    this._onVimLoaded.dispatch()
  }

  /**
   * Unload given vim from viewer.
   */
  remove (vim: Vim | VimX) {
    if (!this._vims.has(vim)) {
      throw new Error('Cannot remove missing vim from viewer.')
    }
    this._vims.delete(vim)
    this.renderer.remove(vim.scene)
    if (this.selection.vim === vim) {
      this.selection.clear()
    }
    this._onVimLoaded.dispatch()
  }

  /**
   * Unloads all vim from viewer.
   */
  clear () {
    this.vims.forEach((v) => this.remove(v))
  }

  /**
   * Disposes all resources.
   */
  dispose () {
    cancelAnimationFrame(this._updateId)
    this.selection.dispose()
    this._environment.dispose()
    this.selection.clear()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this.materials.dispose()
    this.gizmos.dispose()
  }
}
