/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { ViewerSettings, ViewerOptions } from './viewerSettings'
import { Camera, ICamera } from './camera'
import { Input } from './input'
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
import { VimSettings, VimOptions } from '../vim-loader/vimSettings'
import { Loader } from '../vim-loader/loader'
import { Object } from '../vim-loader/object'
import { BFast } from '../vim-loader/bfast'
import { Vim } from '../vim-loader/vim'
import { IProgressLogs, RemoteBuffer } from '../vim-loader/remoteBuffer'
import { Renderer } from './rendering/renderer'
import { IMaterialLibrary, VimMaterials } from '../vim'
import { SignalDispatcher } from 'ste-signals'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  /**
   * Current viewer settings.
   */
  settings: ViewerSettings

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
   * Interface to interact with the rectanglwe gizmo.
   */
  gizmoRectangle: GizmoRectangle

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
  private _materials: IMaterialLibrary

  // State
  private _vims: (Vim | undefined)[] = []
  private _disposed: boolean = false
  private _onVimLoaded = new SignalDispatcher()

  /**
   * Will be removed once gizmo axes are cleaned up to expose canvas.
   * @deprecated
   */
  get axesCanvas () {
    return this._gizmoAxes.canvas
  }

  constructor (options?: Partial<ViewerOptions.Root>) {
    this.settings = new ViewerSettings(options)

    const materials = new VimMaterials()

    this._loader = new Loader(materials)
    this._materials = materials

    const scene = new RenderScene()
    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(scene, this.viewport, this.settings)
    this.renderer = new Renderer(scene, this.viewport, materials, this._camera)
    if (this.settings.getCameraGizmoEnable()) {
      this._camera.gizmo = new CameraGizmo(
        this.renderer,
        this._camera,
        this.settings
      )
    }
    this.renderer.applyMaterialSettings(this.settings)

    // TODO add options
    this.measure = new Measure(this)
    this._gizmoAxes = new GizmoAxes(this.camera, this.settings.getAxesConfig())
    this.viewport.canvas.parentElement?.prepend(this._gizmoAxes.canvas)

    this.sectionBox = new SectionBox(this)
    this.gizmoRectangle = new GizmoRectangle(this)

    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Input and Selection
    this.selection = new Selection(this.renderer)
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

  dispose () {
    if (this._disposed) return
    this._environment.dispose()
    this.selection.clear()
    this._camera.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this._materials.dispose()
    this.gizmoRectangle.dispose()
    this._disposed = true
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    // if viewer was disposed no more animation.
    if (this._disposed) return

    requestAnimationFrame(() => this.animate())
    // Camera
    this._camera.update(this._clock.getDelta())
    // Rendering
    if (this._vims.length) {
      this.renderer.render(this.camera.camera, this.selection.count > 0)
    }
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
        vim.index = i
        return
      }
    }
  }

  /**
   * Remove given vim from the vims array and leaves an undefined spot.
   */
  private removeVim (vim: Vim) {
    this._vims[vim.index] = undefined
    vim.index = -1
  }

  /**
   * Loads a vim into the viewer from local or remote location
   * @param source if string downloads the vim from url then loads it, if ArrayBuffer directly loads the vim
   * @param options vim options
   */
  async loadVim (
    source: string | ArrayBuffer,
    options: VimOptions.Root,
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

    const settings = new VimSettings(options)
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
  clear () {
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
    this.renderer.remove(vim.scene)
    const more = vim.loadMore(flagTest)
    vim.scene.merge(more)
    this.renderer.add(vim.scene)

    return more
  }
}
