/**
 @author VIM / https://vimaec.com
 @module viw-webgl-viewer
*/

// internal
import { ViewerSettings, ViewerOptions } from './settings'
import { VimSettings, VimOptions } from '../vim-loader/settings'

import { ViewerCamera } from './camera'
import { ViewerInput } from './input'
import { Selection } from './selection'
import { Environment } from './environment'
import { Renderer } from './renderer'
import { HitTestResult } from './hitTester'

// loader
import { VimLoader } from '../vim-loader/vimLoader'
import { Vim } from '../vim-loader/vim'
import { Object } from '../vim-loader/object'

export class Viewer {
  settings: ViewerSettings

  environment: Environment
  renderer: Renderer
  selection: Selection
  camera: ViewerCamera
  controls: ViewerInput
  loader: VimLoader

  // State
  private vims: Vim[] = []

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  onMouseClick: (hit: HitTestResult) => void

  constructor (options?: Partial<ViewerOptions>) {
    this.loader = new VimLoader()
    this.settings = new ViewerSettings(options)

    const canvas = Viewer.getOrCreateCanvas(this.settings.getCanvasId())
    this.renderer = new Renderer(canvas, this.settings)

    this.camera = new ViewerCamera(this.renderer, this.settings)

    this.environment = new Environment(this.settings)
    this.environment.getObjects().forEach((o) => this.renderer.addObject(o))

    // Default mouse click behaviour, can be overriden
    this.onMouseClick = this.defaultOnClick

    // Input and Selection
    this.controls = new ViewerInput(this)
    this.controls.register()
    this.selection = new Selection(this)

    // Start Loop
    this.animate()
  }

  /**
   * Either returns html canvas at provided Id or creates a canvas at root level
   */
  private static getOrCreateCanvas (canvasId?: string) {
    let canvas = canvasId
      ? (document.getElementById(canvasId) as HTMLCanvasElement)
      : undefined

    if (!canvas) {
      canvas = document.createElement('canvas')
      document.body.appendChild(canvas)
    }
    return canvas
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    requestAnimationFrame(() => this.animate())

    // Camera
    const timeDelta = this.renderer.clock.getDelta()
    this.camera.frameUpdate(timeDelta)

    // Rendering
    if (this.vims.length) this.renderer.render()
  }

  /**
   * Returns vim with given index. Once loaded vims do not change index.
   */
  getVim = (index: number = 0) => this.vims[index]

  /**
   * Adds given vim to the first empty spot of the vims array
   */
  private addVim (vim: Vim) {
    for (let i = 0; i <= this.vims.length; i++) {
      if (this.vims[i] === undefined) {
        this.vims[i] = vim
        vim.setIndex(i)
        return
      }
    }
  }

  /**
   * Remove given vim from the vims array and leaves an undefined spot.
   */
  private removeVim (vim: Vim) {
    this.vims[vim.index] = undefined
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
    options?: Partial<VimOptions>,
    onLoad?: (response: Vim) => void,
    onProgress?: (request: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    const settings = new VimSettings(options)

    const finish = (vim: Vim) => {
      const filter = settings.getElementIdsFilter()
      if (filter) this.filterVim(vim, filter)
      else this.onVimLoaded(vim, settings)
      this.frameContent()
      onLoad?.(vim)
    }

    if (typeof source === 'string') {
      this.loader.loadFromUrl(
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
      const vim = this.loader.loadFromArrayBuffer(
        source,
        settings.getTransparency()
      )
      finish(vim)
    }
  }

  private onVimLoaded (vim: Vim, settings: VimSettings) {
    this.addVim(vim)
    vim.applySettings(settings)

    this.renderer.addScene(vim.scene)
    this.environment.fitToContent(this.renderer.getBoundingBox())
    this.camera.fitToContent(this.renderer.getBoundingSphere())
  }

  /**
   * Unload existing vim to get ready to load a new vim
   */
  unloadVim (vim: Vim) {
    this.removeVim(vim)
    this.renderer.removeScene(vim.scene)
    if (this.selection.object.vim === vim) this.selection.clear()
  }

  /**
   * Unload existing vim and reloads it without redownloading it
   * @param options full vim options, same as for loadVim
   */
  reloadVim (vim: Vim, options: VimOptions) {
    const settings = new VimSettings(options)
    const elementIds = settings.getElementIdsFilter()
    const instanceIndices = elementIds
      ? vim.getInstanceIndicesFromElementIds(elementIds)
      : undefined

    const newVim = this.loader.loadFromVim(
      vim.document,
      settings.getTransparency(),
      instanceIndices
    )
    this.unloadVim(vim)
    this.onVimLoaded(newVim, settings)
  }

  /**
   * Reloads the current vim with the same settings except it applies a new element filter
   * @param includedElementIds array of element ids to keep, passing undefined will load the whole vim
   */
  filterVim (vim: Vim, includedElementIds: number[] | undefined) {
    const options = vim.settings.getOptions()
    options.elementIds = includedElementIds
    this.reloadVim(vim, options)
  }

  /**
   * Reloads the current vim with the same settings except it removes element filter
   */
  clearFilter (vim: Vim) {
    // TODO: Fix this
    const options = vim.settings.getOptions()
    options.elementIds = undefined
    this.reloadVim(vim, options)
  }

  /**
   * Select given vim object
   */
  select (object: Object) {
    console.log(`Selected Element Index: ${object.element}`)
    this.selection.select(object)
  }

  /**
   * Clear current selection
   */
  clearSelection () {
    this.selection.clear()
    console.log('Selection Cleared')
  }

  /**
   * Move the camera to frame all geometry related to an element
   * @param elementIndex index of element
   */
  lookAt (object: Object) {
    const sphere = object.getBoundingSphere()
    this.camera.lookAtSphere(sphere, true)
  }

  /**
   * Move the camera to frame current selection
   */
  lookAtSelection () {
    if (this.selection.hasSelection()) {
      this.camera.lookAtSphere(this.selection.boundingSphere!)
    } else {
      this.frameContent()
    }
  }

  /**
   * Move the camera to frame the whole scene
   */
  frameContent () {
    this.camera.frameSphere(this.renderer.getBoundingSphere())
  }

  /**
   * Apply modified viewer settings
   */
  public ApplyViewerSettings () {
    this.environment.applyViewerSettings(this.settings)
    this.camera.applyViewerSettings(this.settings)
  }

  private defaultOnClick (hit: HitTestResult) {
    console.log(hit)
    if (!hit.object) return

    this.select(hit.object)

    this.camera.setTarget(hit.object.getCenter())

    if (hit.doubleClick) this.lookAtSelection()

    console.log(hit.object.getBimElement())
  }
}
