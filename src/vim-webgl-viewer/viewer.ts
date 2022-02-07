/**
 @author VIM / https://vimaec.com
 @module viw-webgl-viewer
*/

// external
import * as THREE from 'three'

// internal
import {
  VimSettings,
  ViewerSettings,
  VimOptions,
  ViewerOptions
} from './viewerSettings'

import { ViewerCamera } from './viewerCamera'
import { ViewerInput } from './viewerInput'
import { Selection } from './selection'
import { ViewerEnvironment } from './viewerEnvironment'
import { ViewerRenderer } from './viewerRenderer'
import { HitTestResult } from './hitTester'

// loader
import { VimLoader } from '../vim-loader/vimLoader'
import { Vim } from '../vim-loader/vim'
import { Document } from '../vim-webgl-viewer'
import { VimObject } from '../vim-loader/vimObject'

export type ViewerState =
  | 'Uninitialized'
  | [state: 'Downloading', progress: number]
  | 'Processing'
  | [state: 'Error', error: ErrorEvent]
  | 'Ready'

// const NO_SCENE_LOADED = 'No vim loaded in viewer. Ignoring'

export class Viewer {
  settings: ViewerSettings

  environment: ViewerEnvironment
  renderer: ViewerRenderer
  selection: Selection
  camera: ViewerCamera
  controls: ViewerInput
  loader: VimLoader

  // State
  vims: [Vim, VimSettings][] = []
  getVimAt = (index: number) => this.vims[index][0]
  getSettingsAt = (index: number) => this.vims[index][1]
  addVim (vim: Vim, settings: VimSettings) {
    for (let i = 0; i <= this.vims.length; i++) {
      if (this.vims[i] === undefined) {
        this.vims[i] = [vim, settings]
        vim.setIndex(i)
        return
      }
    }
  }

  removeVim (vim: Vim) {
    this.vims[vim.index] = undefined
  }

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  onMouseClick: (hit: HitTestResult) => void

  constructor (options?: Partial<ViewerOptions>) {
    this.loader = new VimLoader()
    this.settings = new ViewerSettings(options)

    const canvas = Viewer.getOrCreateCanvas(this.settings.getCanvasId())
    this.renderer = new ViewerRenderer(canvas, this.settings)

    this.camera = new ViewerCamera(this.renderer, this.settings)

    this.environment = new ViewerEnvironment(this.settings)
    this.renderer.addObjects(this.environment.getElements())

    // Default mouse click behaviour, can be overriden
    this.onMouseClick = this.defaultOnClick

    // Input and Selection
    this.controls = new ViewerInput(this)
    this.controls.register()
    this.selection = new Selection(this)

    // Start Loop
    this.animate()
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
      this.lookAtScene()
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
    vim.applyMatrix4(settings.getMatrix())
    this.addVim(vim, settings)

    // Scene
    this.renderer.addScene(vim.scene)
    this.renderer.render()

    this.ApplyVimSettings()
  }

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

    const scene = this.loader.loadFromVim(
      vim.document,
      settings.getTransparency(),
      instanceIndices
    )
    this.unloadVim(vim)
    this.onVimLoaded(scene, settings)
  }

  /**
   * Reloads the current vim with the same settings except it applies a new element filter
   * @param includedElementIds array of element ids to keep, passing undefined will load the whole vim
   */
  filterVim (vim: Vim, includedElementIds: number[] | undefined) {
    // TODO Fix this
    const options = this.getSettingsAt(0).getOptions()
    options.elementIds = includedElementIds
    this.reloadVim(vim, options)
  }

  /**
   * Reloads the current vim with the same settings except it removes element filter
   */
  clearFilter (vim: Vim) {
    // TODO: Fix this
    const options = this.getSettingsAt(0).getOptions()
    options.elementIds = undefined
    this.reloadVim(vim, options)
  }

  /**
   * Select all geometry related to a given element
   * @param elementIndex index of element
   */
  select (object: VimObject) {
    console.log('Selecting element with index: ' + object.element)
    console.log(
      'Bim Element Name: ' + this.getVimAt(0).getElementName(object.element)
    )
    this.selection.select(object)
  }

  /**
   * Clear current selection
   */
  clearSelection () {
    this.selection.clear()
    console.log('Cleared Selection')
  }

  /**
   * Move the camera to frame all geometry related to an element
   * @param elementIndex index of element
   */
  lookAt (object: VimObject) {
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
      this.camera.frameScene(this.renderer.getBoundingSphere())
    }
  }

  /**
   * Move the camera to frame the whole scene
   */
  lookAtScene () {
    this.camera.frameScene(this.renderer.getBoundingSphere())
  }

  /**
   * Apply modified viewer settings
   */
  public ApplyViewerSettings () {
    this.environment.applyViewerSettings(this.settings)
    this.camera.applyViewerSettings(this.settings)
  }

  public ApplyVimSettings () {
    this.environment.applyVimSettings(
      this.getSettingsAt(0),
      this.renderer.getBoundingBox()
    )
    this.camera.applyVimSettings(this.renderer.getBoundingSphere())
  }

  private defaultOnClick (hit: HitTestResult) {
    console.log(hit)
    if (!hit.object) return

    this.select(hit.object)

    const center = hit.object.getBoundingBox().getCenter(new THREE.Vector3())
    this.camera.setTarget(center)

    if (hit.doubleClick) this.lookAtSelection()

    const entity = this.getVimAt(0).document.getEntity(
      Document.tableElement,
      hit.object.element
    )
    console.log(entity)
  }
}
