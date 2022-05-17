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
import { Renderer } from './renderer'
import { Raycaster, RaycastResult } from './raycaster'
import { CameraGizmo } from './gizmos'
import { RenderScene } from './renderScene'
import { Viewport } from './viewport'
import { GizmoAxes } from './gizmoAxes'

// loader
import { VimSettings, VimOptions } from '../vim-loader/vimSettings'
import { Loader } from '../vim-loader/loader'
import { Object } from '../vim-loader/object'
import { BFast } from '../vim-loader/bfast'
import { Vim } from '../vim-loader/vim'
import { IProgressLogs, RemoteBuffer } from '../vim-loader/remoteBuffer'
import { Materials } from '../vim-loader/materials'

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

  private _environment: Environment
  private _camera: Camera
  private _loader: Loader
  private _clock = new THREE.Clock()
  private _gizmoAxes: GizmoAxes

  // State
  private _vims: (Vim | undefined)[] = []
  private _disposed: boolean = false

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
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  private _onMouseClick: (hit: RaycastResult) => void
  get onMouseClick () {
    return this._onMouseClick
  }

  set onMouseClick (callback: (hit: RaycastResult) => void) {
    this._onMouseClick = callback ?? function (hit: RaycastResult) {}
  }

  constructor (options?: Partial<ViewerOptions.Root>) {
    this._loader = new Loader()
    this.settings = new ViewerSettings(options)

    const scene = new RenderScene()
    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(scene, this.viewport, this.settings)
    this.renderer = new Renderer(scene, this.viewport)
    this._camera.gizmo = new CameraGizmo(
      this.renderer,
      this._camera,
      this.settings
    )

    // TODO add options
    this._gizmoAxes = new GizmoAxes(this.camera)
    this.viewport.canvas.parentElement.prepend(this._gizmoAxes.canvas)
    this._gizmoAxes.canvas.style.position = 'fixed'
    this._gizmoAxes.canvas.style.right = '10px'
    this._gizmoAxes.canvas.style.top = '10px'

    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Default mouse click behaviour, can be overriden
    this._onMouseClick = this.defaultOnClick

    // Input and Selection
    this.selection = new Selection(this.renderer)
    this.raycaster = new Raycaster(this.viewport, this._camera, scene)
    this.inputs = new Input(this)
    this.inputs.register()

    this.applyMaterialSettings(this.settings)

    // Start Loop
    this.animate()
  }

  dispose () {
    this._environment.dispose()
    this.selection.clear()
    this._camera.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregister()
    this._vims.forEach((v) => v?.dispose())
    this._vims = []
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
    if (this._vims.length) this.renderer.render(this.camera.camera)
  }

  /**
   * Returns an array with all loaded vims.
   */
  get vims () {
    return this._vims.filter((v) => v !== undefined)
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
    if (typeof source === 'string') {
      buffer = new RemoteBuffer(source)
      buffer.logger.onUpdate = (log) => onProgress?.(log)
    } else buffer = source

    const bfast = new BFast(buffer, 0, 'vim')
    if (options.forceDownload) await bfast.forceDownload()

    const vim = await this._loader.load(bfast, 'all')
    if (buffer instanceof RemoteBuffer) buffer.logger.onUpdate = undefined
    this.onVimLoaded(vim, new VimSettings(options))
    this.camera.frame('all', true)
    return vim
  }

  private onVimLoaded (vim: Vim, settings: VimSettings) {
    this.addVim(vim)
    vim.applySettings(settings)

    this.renderer.add(vim.scene)
    this._environment.adaptToContent(this.renderer.getBoundingBox())
    this._camera.adaptToContent()
  }

  /**
   * Unload given vim from viewer.
   */
  unloadVim (vim: Vim) {
    this.removeVim(vim)
    this.renderer.remove(vim.scene)
    vim.dispose()
    if (this.selection.object?.vim === vim) this.selection.clear()
  }

  /**
   * Unloads all vim from viewer.
   */
  clear () {
    this._vims.forEach((v) => this.unloadVim(v))
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

  applyMaterialSettings (settings: ViewerSettings) {
    const lib = Materials.getDefaultLibrary()
    lib.wireframe.color = settings.getHighlightColor()
    lib.wireframe.opacity = settings.getHighlightOpacity()
  }

  /**
   * Default click behaviour.
   */
  public defaultOnClick (hit: RaycastResult) {
    console.log(hit)
    if (!hit?.object || hit.object === this.selection.object) {
      this.selection.select(undefined)
      return
    }

    this.selection.select(hit.object)
    this._camera.target(hit.object.getCenter())

    if (hit.doubleClick) this._camera.frame(hit.object)

    const element = hit.object.getBimElement()
    if (element instanceof Map) {
      console.log(element)
    } else {
      element.then((e) => console.log(e))
    }
  }
}
