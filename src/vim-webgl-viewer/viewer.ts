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
import * as g3dToGeometry from '../vim-loader/geometry'
import { Document } from '../vim-webgl-viewer'

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
  vimScene: Vim | undefined
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
    if (this.vimScene) this.renderer.render()
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
          this.vimScene = undefined
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
    this.vimScene = vim
    this.vimSettings = settings

    const matrix = this.vimSettings.getMatrix()

    // Scene
    this.renderer.addScene(vim.scene)
    this.renderer.applyMatrix4(matrix)
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
    this.vimScene = undefined
    this.vimSettings = undefined
    this.renderer.clearScene()
    this.selection.clear()
  }

  /**
   * Unload existing vim and reloads it without redownloading it
   * @param options full vim options, same as for loadVim
   */
  reloadVim (options: VimOptions) {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)

    const settings = new VimSettings(options)
    // Go from Element Ids -> Node Indices
    const elementIds = settings.getElementIdsFilter()
    const instanceIndices = elementIds
      ? this.vimScene.getInstanceIndicesFromElementIds(elementIds)
      : undefined

    const scene = new VimLoader().loadFromVim(
      this.vimScene.vim,
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

  // TODO: Handle case where an element Id is not unique
  /**
   * Get the element index from the element Id
   * @param elementId id of element
   * @returns index of element
   */
  getElementIndexFromElementId = (elementId: number) => {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    return this.vimScene.getElementIndexFromElementId(elementId)
  }

  /**
   * Get the parent element index from a node index
   * @param nodeIndex index of node
   * @returns index of element
   */
  getElementIndexFromNodeIndex (nodeIndex: number): number {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    return this.vimScene.getElementIndexFromNodeIndex(nodeIndex)
  }

  /**
   * Get the element index related to given mesh
   * @param mesh instanced mesh
   * @param index index into the instanced mesh
   * @returns index of element
   */
  getElementIndexFromMeshInstance (mesh: THREE.Mesh, index: number): number {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    return this.vimScene.getElementIndexFromMesh(mesh, index)
  }

  /**
   * highlight all geometry related to and element
   * @param elementIndex index of element
   * @returns a disposer function for the created geometry
   */
  highlightElementByIndex (elementIndex: number): Function {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    const nodes = this.vimScene.getNodeIndicesFromElementIndex(elementIndex)
    if (!nodes) {
      console.error(
        'Could not find nodes geometry for element index: ' + elementIndex
      )
      return () => {}
    }

    const geometry = g3dToGeometry.createFromInstances(
      this.vimScene.vim.g3d,
      nodes
    )
    geometry.applyMatrix4(this.vimSettings.getMatrix())
    if (!geometry) {
      console.error(
        'Could not create geometry for element index: ' + elementIndex
      )
      return () => {}
    }

    const disposer = this.highlight(geometry)

    return () => {
      disposer()
      geometry.dispose()
    }
  }

  /**
   * Compute total bounding box of all geometries related to an element
   * @param elementIndex index of element
   * @returns THREE bounding
   */
  getBoundingBoxForElementIndex (elementIndex: number): THREE.Box3 | null {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    const nodes = this.vimScene.getNodeIndicesFromElementIndex(elementIndex)
    if (!nodes) {
      console.error('Could not find nodes for : ' + elementIndex)
      return null
    }

    const geometry = g3dToGeometry.createFromInstances(
      this.vimScene.vim.g3d,
      nodes
    )
    if (!geometry) {
      console.error(
        'Could not create geometry for element index: ' + elementIndex
      )
      return null
    }
    geometry.computeBoundingBox()
    const result = geometry.boundingBox
    geometry.dispose()
    return result
  }

  /**
   * Select all geometry related to a given element
   * @param elementIndex index of element
   */
  selectByElementIndex (elementIndex: number) {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    console.log('Selecting element with index: ' + elementIndex)
    console.log(
      'Bim Element Name: ' + this.vimScene.getElementName(elementIndex)
    )
    this.selection.select(elementIndex)
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
  lookAtElementIndex (elementIndex: number) {
    const box = this.getBoundingBoxForElementIndex(elementIndex)
    if (!box) {
      console.error(
        'Could not create geometry for element index: ' + elementIndex
      )
      return
    }

    const sphere = box.getBoundingSphere(new THREE.Sphere())
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
    if (!hit.isHit) return

    this.selectByElementIndex(hit.elementIndex)
    const entity = this.vimScene.vim.getEntity(
      Document.tableElement,
      hit.elementIndex
    )
    this.camera.setTarget(hit.position)
    if (hit.doubleClick) this.lookAtSelection()
    console.log(entity)
  }

  // TODO: Move to geometry layer
  private highlight (geometry: THREE.BufferGeometry): Function {
    const wireframe = new THREE.WireframeGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    const line = new THREE.LineSegments(wireframe, material)

    this.renderer.addObjects([line])

    // returns disposer
    return () => {
      this.renderer.scene.remove(line)
      wireframe.dispose()
      material.dispose()
    }
  }
}
