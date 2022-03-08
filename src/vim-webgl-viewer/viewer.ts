/**
 @module viw-webgl-viewer
*/

// internal
import { ViewerSettings, ViewerOptions } from './viewerSettings'
import { Camera, ICamera } from './camera'
import { Input } from './input'
import { Selection } from './selection'
import { Environment, IEnvironment } from './environment'
import { Renderer } from './renderer'
import { Raycaster, RaycastResult } from './raycaster'

// loader
import { VimSettings, VimOptions } from '../vim-loader/vimSettings'
import { Loader } from '../vim-loader/loader'
import { Vim } from '../vim-loader/vim'
import { Object } from '../vim-loader/object'
import * as THREE from 'three'

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
  raycaster : Raycaster

  private _environment: Environment
  private _camera: Camera
  private _loader: Loader
  private _clock = new THREE.Clock()

  // State
  private _vims: Vim[] = []

  /**
   * Interface to manipulate the viewer camera.
   */
  get camera () { return this._camera as ICamera }

  /**
   * Interface to manipulate THREE elements not directly related to vim.
   */
  get environment () { return this._environment as IEnvironment }

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  _onMouseClick: (hit: RaycastResult) => void
  get onMouseClick () { return this._onMouseClick }
  set onMouseClick (callback : (hit: RaycastResult) => void) { this._onMouseClick = callback ?? function (hit: RaycastResult) {} }

  constructor (options?: Partial<ViewerOptions.Root>) {
    this._loader = new Loader()
    this.settings = new ViewerSettings(options)

    this.renderer = new Renderer(this.settings)
    this._camera = new Camera(this.renderer, this.settings)

    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Default mouse click behaviour, can be overriden
    this.onMouseClick = this.defaultOnClick

    // Input and Selection
    this.raycaster = new Raycaster(this)
    this.inputs = new Input(this, this._camera)
    this.inputs.register()
    this.selection = new Selection(this)

    // Start Loop
    this.animate()
  }

  dispose () {
    this._loader.dispose()
    this._environment.dispose()
    this.selection.clear()
    this._camera.dispose()
    this.renderer.dispose()
    this.inputs.unregister()
    this._vims.forEach(v => v?.dispose())
    this._vims = undefined
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    // if viewer was disposed no more animation.
    if (!this._vims) return

    requestAnimationFrame(() => this.animate())

    // Camera
    this._camera.update(this._clock.getDelta())
    // Rendering
    if (this._vims.length) this.renderer.render()
  }

  /**
   * Returns an array with all loaded vims.
   */
  get vims () { return this._vims.filter(v => v !== undefined) }
  /**
   * Current loaded vim count
   */
  get vimCount () { return this._vims.length }

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
   * @param onLoad callback on vim loaded
   * @param onProgress callback on download progresss and on processing started
   * @param onError callback on error
   */
  public loadVim (
    source:
      | string
      | ArrayBuffer = 'https://vim.azureedge.net/samples/residence.vim',
    options?: Partial<VimOptions.Root>,
    onLoad?: (response: Vim) => void,
    onProgress?: (request: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const settings = new VimSettings(options)

    const finish = (vim: Vim) => {
      this.onVimLoaded(vim, settings)
      this._camera.frame('all')
      onLoad?.(vim)
    }

    if (typeof source === 'string') {
      this._loader.loadFromUrl(
        source,
        settings.getTransparency(),
        (vim) => finish(vim),
        (progress) => {
          onProgress?.(progress)
        },
        (error) => {
          onError?.(error)
        }
      )
    } else {
      const vim = this._loader.loadFromArrayBuffer(
        source,
        settings.getTransparency()
      )
      finish(vim)
    }
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
   * Reloads the vim with only objects included in the array.
   * @param objects array of objects to keep or undefined to load all objects.
   */
  filterVim (vim: Vim, objects: Object[] | undefined) {
    const instances = objects?.flatMap(o => o?.instances)
      .filter((i): i is number => i !== undefined)

    this.renderer.remove(vim.scene)
    vim.filter(instances)
    this.renderer.add(vim.scene)
  }

  private defaultOnClick (hit: RaycastResult) {
    console.log(hit)
    if (!hit?.object) return
    this.selection.select(hit.object)

    this._camera.target(hit.object.getCenter())

    if (hit.doubleClick) this._camera.frame(hit.object)

    console.log(hit.object.getBimElement())
  }
}
