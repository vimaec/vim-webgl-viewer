/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { Settings, getConfig, PartialSettings } from './viewerSettings'
import { Camera } from './camera/camera'
import { ICamera } from './camera/cameraInterface'
import { Input } from './inputs/input'
import { Selection } from './selection'
import { VimRequest } from '../vim-loader/vimRequest'
import { Environment, IEnvironment } from './environment'
import { Raycaster } from './raycaster'
import { CameraGizmo } from './gizmos/gizmoOrbit'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { GizmoAxes } from './gizmos/gizmoAxes'
import { SectionBox } from './gizmos/sectionBox/sectionBox'
import { Measure, IMeasure } from './gizmos/measure/measure'
import { GizmoRectangle } from './gizmos/gizmoRectangle'

// loader
import { getFullSettings, VimPartialSettings } from '../vim-loader/vimSettings'
import { VimBuilder } from '../vim-loader/vimBuilder'
import { IProgressLogs } from 'vim-format'
import { Vim } from '../vim-loader/vim'
import { Renderer } from './rendering/renderer'
import { GizmoGrid, VimMaterials } from '../vim'
import { SignalDispatcher } from 'ste-signals'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  /**
   * Current viewer settings.
   */
  config: Settings

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
   * Interface to interact with the section gizmo.
   */
  sectionBox: SectionBox

  /**
   * Interface to interact with measure.
   */
  measure: IMeasure

  /**
   * Interface to interact with the rectangle gizmo.
   */
  gizmoRectangle: GizmoRectangle

  /**
   * Interface to interact with the grid gizmo.
   */
  grid: GizmoGrid

  /**
   * Interface to interact with viewer materials
   */
  materials: VimMaterials

  /**
   * Interface to manipulate the viewer camera.
   */
  get camera () {
    return this._camera as ICamera
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

  /**
   * Will be removed once gizmo axes are cleaned up to expose canvas.
   * @deprecated
   */
  get axesCanvas () {
    return this._gizmoAxes.canvas
  }

  private _environment: Environment
  private _camera: Camera
  private _clock = new THREE.Clock()
  private _gizmoAxes: GizmoAxes

  // State
  private _vims = new Set<Vim>()
  private _onVimLoaded = new SignalDispatcher()
  private _updateId: number

  constructor (options?: PartialSettings) {
    this.config = getConfig(options)

    this.materials = VimMaterials.getInstance()

    const scene = new RenderScene()
    this.viewport = new Viewport(this.config)
    this._camera = new Camera(scene, this.viewport, this.config)
    this.renderer = new Renderer(
      scene,
      this.viewport,
      this.materials,
      this._camera,
      this.config
    )
    if (this.config.camera.gizmo.enable) {
      this._camera.gizmo = new CameraGizmo(
        this.renderer,
        this._camera,
        this.config
      )
    }
    this.materials.applySettings(this.config)

    // TODO add options
    this.measure = new Measure(this)
    this._gizmoAxes = new GizmoAxes(this.camera, this.config.axes)
    this.viewport.canvas.parentElement?.prepend(this._gizmoAxes.canvas)

    this.sectionBox = new SectionBox(this)
    this.gizmoRectangle = new GizmoRectangle(this)
    this.grid = new GizmoGrid(this.renderer, this.materials)

    this._environment = new Environment(this.config)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Input and Selection
    this.selection = new Selection(this.materials)
    this.raycaster = new Raycaster(
      this.viewport,
      this._camera,
      scene,
      this.renderer
    )
    this.inputs = new Input(this)
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
    return Array.from(this._vims)
  }

  /**
   * Current loaded vim count
   */
  get vimCount () {
    return this._vims.size
  }

  add (vim: Vim) {
    if (this._vims.has(vim)) {
      throw new Error('Vim cannot be added again, unless removed first.')
    }

    const success = this.renderer.add(vim.scene)
    if (!success) {
      vim.dispose()
      throw new Error(
        'Could not load vim. Max geometry memory reached. Vim disposed.'
      )
    }
    this._vims.add(vim)

    const box = this.renderer.getBoundingBox()
    if (box) {
      this._environment.adaptToContent(box)
      this.sectionBox.fitBox(box)
    }
    this._camera.adaptToContent()
    this._camera.frame('all', 45)
    this._onVimLoaded.dispatch()
  }

  /**
   * Unload given vim from viewer.
   */
  remove (vim: Vim) {
    if (!this._vims.has(vim)) {
      throw new Error('Cannot remove missing vim from viewer.')
    }

    this._vims.add(vim)
    this.renderer.remove(vim.scene)
    vim.dispose()
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
    this._camera.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this.materials.dispose()
    this.gizmoRectangle.dispose()
  }
}
