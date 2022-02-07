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

const NO_SCENE_LOADED = 'No vim loaded in viewer. Ignoring'

export class Viewer {
  settings: ViewerSettings

  environment: ViewerEnvironment
  renderer: ViewerRenderer
  selection: Selection
  camera: ViewerCamera
  controls: ViewerInput

  // State
  vimSettings: VimSettings | undefined
  vim: Vim | undefined
  state: ViewerState = 'Uninitialized'
  static stateChangeEvent = 'viewerStateChangedEvent'

  /**
   * Callback for on mouse click. Replace it to override or combine
   * default behaviour with your custom logic.
   */
  public onMouseClick: (hit: HitTestResult) => void

  constructor (options?: Partial<ViewerOptions>) {
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
    if (this.vim) this.renderer.render()
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
    if (this.vimSettings) {
      throw new Error('There is already a vim loaded or loading')
    }

    const settings = new VimSettings(options)

    const finish = (vim: Vim) => {
      const filter = settings.getElementIdsFilter()
      if (filter) this.filter(filter)
      else this.onVimLoaded(vim, settings)
      this.lookAtScene()
      onLoad?.(vim)
    }

    if (typeof source === 'string') {
      new VimLoader().loadFromUrl(
        source,
        settings.getTransparency(),
        (vim) => finish(vim),
        (progress) => {
          onProgress?.(progress)
        },
        (error) => {
          this.vimSettings = undefined
          this.vim = undefined
          onError?.(error)
        }
      )
    } else {
      const vim = new VimLoader().loadFromArrayBuffer(
        source,
        settings.getTransparency()
      )
      finish(vim)
    }
  }

  private onVimLoaded (vim: Vim, settings: VimSettings) {
    this.vim = vim
    this.vimSettings = settings
    this.vim.applyMatrix4(settings.getMatrix())

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
  unloadVim () {
    this.vim = undefined
    this.vimSettings = undefined
    this.renderer.clearScene()
    this.selection.clear()
  }

  /**
   * Unload existing vim and reloads it without redownloading it
   * @param options full vim options, same as for loadVim
   */
  reloadVim (options: VimOptions) {
    if (!this.vim) throw new Error(NO_SCENE_LOADED)

    const settings = new VimSettings(options)
    // Go from Element Ids -> Node Indices
    const elementIds = settings.getElementIdsFilter()
    const instanceIndices = elementIds
      ? this.vim.getInstanceIndicesFromElementIds(elementIds)
      : undefined

    const scene = new VimLoader().loadFromVim(
      this.vim.document,
      settings.getTransparency(),
      instanceIndices
    )
    this.unloadVim()
    this.onVimLoaded(scene, settings)
  }

  /**
   * Reloads the current vim with the same settings except it applies a new element filter
   * @param includedElementIds array of element ids to keep, passing undefined will load the whole vim
   */
  filter (includedElementIds: number[] | undefined) {
    if (!this.vimSettings) throw new Error(NO_SCENE_LOADED)
    const options = this.vimSettings.getOptions()
    options.elementIds = includedElementIds
    this.reloadVim(options)
  }

  /**
   * Reloads the current vim with the same settings except it removes element filter
   */
  clearFilter () {
    if (!this.vimSettings) throw new Error(NO_SCENE_LOADED)
    const options = this.vimSettings.getOptions()
    options.elementIds = undefined
    this.reloadVim(options)
  }

  /**
   * Select all geometry related to a given element
   * @param elementIndex index of element
   */
  select (object: VimObject) {
    if (!this.vim) throw new Error(NO_SCENE_LOADED)
    console.log('Selecting element with index: ' + object.element)
    console.log('Bim Element Name: ' + this.vim.getElementName(object.element))
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
      this.vimSettings,
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

    const entity = this.vim.document.getEntity(
      Document.tableElement,
      hit.object.element
    )
    console.log(entity)
  }
}
