/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { ViewerConfig, getConfig, ViewerOptions } from './viewerSettings'
import { Camera, ICamera } from './camera'
import { Input } from './inputs/input'
import { Selection } from './selection'
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
import { getVimConfig, VimOptions } from '../vim-loader/vimSettings'
import { Loader } from '../vim-loader/loader'
import { Object } from '../vim-loader/object'
import { BFast, IProgressLogs, RemoteBuffer } from 'vim-format'
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
  config: ViewerConfig

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

  private _environment: Environment
  private _camera: Camera
  private _loader: Loader
  private _clock = new THREE.Clock()
  private _gizmoAxes: GizmoAxes

  // State
  private _vims: (Vim | undefined)[] = []
  private _onVimLoaded = new SignalDispatcher()
  private _updateId: number

  /**
   * Will be removed once gizmo axes are cleaned up to expose canvas.
   * @deprecated
   */
  get axesCanvas () {
    return this._gizmoAxes.canvas
  }

  constructor (options?: ViewerOptions) {
    this.config = getConfig(options)

    const materials = new VimMaterials()

    this._loader = new Loader(materials)
    this.materials = materials

    const scene = new RenderScene()
    this.viewport = new Viewport(this.config)
    this._camera = new Camera(scene, this.viewport, this.config)
    this.renderer = new Renderer(
      scene,
      this.viewport,
      materials,
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
    this.selection = new Selection(materials)
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
    return this._vims.filter((v): v is Vim => v !== undefined)
  }

  /**
   * Current loaded vim count
   */
  get vimCount () {
    return this._vims.length
  }

  /**
   * Adds given vim to the first empty spot of the vims array
   */
  private addVim (vim: Vim) {
    for (let i = 0; i <= this._vims.length; i++) {
      if (this._vims[i] === undefined) {
        this._vims[i] = vim
        return
      }
    }
  }

  /**
   * Remove given vim from the vims array and leaves an undefined spot.
   */
  private removeVim (vim: Vim) {
    const i = this._vims.indexOf(vim)
    this._vims[i] = undefined
  }

  /**
   * Loads a vim into the viewer from local or remote location
   * @param source if string downloads the vim from url then loads it, if ArrayBuffer directly loads the vim
   * @param options vim options
   */
  async loadVim (
    source: string | ArrayBuffer,
    options?: VimOptions,
    onProgress?: (logger: IProgressLogs) => void
  ) {
    let buffer: RemoteBuffer | ArrayBuffer

    let url: string | undefined
    if (typeof source === 'string') {
      url = source
      buffer = new RemoteBuffer(source)
      // Add progress listener
      buffer.logger.onUpdate = (log) => onProgress?.(log)
    } else buffer = source

    const settings = getVimConfig(options)
    const bfast = new BFast(buffer, 0, 'vim')
    const vim = await this._loader.load(bfast, settings)
    vim.source = url

    // Remove progress listener
    if (buffer instanceof RemoteBuffer) buffer.logger.onUpdate = undefined

    this.onLoad(vim)

    return vim
  }

  private onLoad (vim: Vim) {
    this.addVim(vim)
    this.renderer.add(vim.scene)
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
  unloadVim (vim: Vim) {
    this.removeVim(vim)
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
  clearVims () {
    this.vims.forEach((v) => this.unloadVim(v))
  }

  /**
   * Reloads the vim with only objects included in the array.
   * @param objects array of objects to keep or undefined to load all objects.
   */
  filterVim (vim: Vim, objects: Object[] | undefined) {
    const instances = objects
      ?.flatMap((o) => o?.instances)
      .filter((i): i is number => i !== undefined)

    this.renderer.remove(vim.scene)
    vim.filter(instances)
    this.renderer.add(vim.scene)
  }

  loadMore (vim: Vim, flagTest: (flag: number) => boolean) {
    const more = vim.loadMore(flagTest)
    if (!more) return

    this.renderer.remove(vim.scene)
    vim.scene.merge(more)
    this.renderer.add(vim.scene)
    return more
  }
}
