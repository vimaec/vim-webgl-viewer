/**
 @author VIM / https://vimaec.com
*/

// external
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'

// internal
import {
  ModelSettings,
  ViewerSettings,
  ModelOptions,
  ViewerOptions
} from './viewerSettings'
import { ViewerCamera } from './viewerCamera'
import { ViewerInput } from './viewerInput'
import { VIMLoader, BufferGeometryBuilder } from '../vim-loader/VIMLoader'

import { Selection } from './selection'
import { ViewerEnvironment } from './viewerEnvironment'
import { ViewerRenderer } from './viewerRenderer'

// loader
import { VimScene } from '../vim-loader/vimScene'

// Module Exports
export { VimParser } from '../vim-loader/vimParser'
export { Vim } from '../vim-loader/vim'

export type ViewerState =
  | 'Uninitialized'
  | [state: 'Downloading', progress: number]
  | 'Processing'
  | [state: 'Error', error: ErrorEvent]
  | 'Ready'

const NO_SCENE_LOADED = 'No model loaded in viewer. Ignoring'

export class Viewer {
  settings: ViewerSettings

  environment: ViewerEnvironment
  renderer: ViewerRenderer
  selection: Selection
  camera: ViewerCamera
  controls: ViewerInput

  // State
  modelSettings: ModelSettings | undefined
  vimScene: VimScene | undefined
  state: ViewerState = 'Uninitialized'
  static stateChangeEvent = 'viewerStateChangedEvent'

  constructor (options?: Partial<ViewerOptions>) {
    this.settings = new ViewerSettings(options)

    const canvas = Viewer.getOrCreateCanvas(this.settings.getCanvasId())
    this.renderer = new ViewerRenderer(canvas, this.settings)

    this.camera = new ViewerCamera(this.renderer, this.settings)

    this.environment = ViewerEnvironment.createDefault()
    this.renderer.addObjects(this.environment.getElements())

    // Input and Selection
    this.controls = new ViewerInput(this)
    this.controls.register()
    this.selection = new Selection(this)

    // Start Loop
    this.ApplySettings()
    this.animate()
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    requestAnimationFrame(() => this.animate())

    // Camera
    const timeDelta = this.renderer.clock.getDelta()
    this.camera.frameUpdate(timeDelta)

    // Model
    this.renderer.render()
  }

  /**
   * Load a vim model into the viewer from local or remote location
   * @param options model options
   * @param onLoad callback on model loaded
   * @param onProgress callback on download progresss and on processing started
   * @param onError callback on error
   */
  public loadModel (
    options?: Partial<ModelOptions>,
    onLoad?: (response: VimScene) => void,
    onProgress?: (request: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    if (this.modelSettings) {
      throw new Error('There is already a model loaded or loading')
    }

    const settings = new ModelSettings(options)

    new VIMLoader().loadFromUrl(
      settings.getURL(),
      (vim) => {
        // Hack to support element filter on first load
        // This is required because the vimscene required to map elements <-> nodes does not exist on first load
        this.modelSettings = settings
        this.vimScene = vim
        this.reloadModel(settings.getOptions())
        this.setState('Ready')
        onLoad?.(vim)
      },
      (progress) => {
        this.setState(
          progress === 'processing'
            ? 'Processing'
            : ['Downloading', progress?.loaded ?? 0]
        )
        onProgress?.(progress)
      },
      (error) => {
        this.modelSettings = undefined
        this.vimScene = undefined
        this.setState(['Error', error])
        onError?.(error)
      }
    )
  }

  private onVimLoaded (vim: VimScene, settings: ModelSettings) {
    this.vimScene = vim
    this.modelSettings = settings

    const matrix = this.modelSettings.getModelMatrix()

    // Model
    this.renderer.addModel(vim.geometry)
    this.renderer.applyMatrix4(matrix)
    this.renderer.render()

    this.lookAtModel()
    this.ApplySettings()
  }

  private setState = (state: ViewerState) => {
    this.state = state
    const event = new CustomEvent(Viewer.stateChangeEvent, {
      detail: this.state,
      bubbles: true
    })
    this.renderer.canvas.dispatchEvent(event)
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
   * Unload existing model to get ready to load a new model
   */
  unloadModel () {
    this.vimScene = undefined
    this.modelSettings = undefined
    this.renderer.clearModels()
    this.selection.clear()
    this.setState('Uninitialized')
  }

  /**
   * Unload existing model and reloads it without redownloading it
   * @param options full model options, same as for loadModel
   */
  reloadModel (options: ModelOptions) {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)

    const settings = new ModelSettings(options)
    // Go from Element Ids -> Node Indices
    const elementIds = settings.getElementIdsFilter()
    const instanceIndices = elementIds
      ? this.vimScene.getInstanceIndicesFromElementIds(elementIds)
      : undefined

    const scene = new VIMLoader().loadFromVim(
      this.vimScene.vim,
      settings.getTransparency(),
      instanceIndices
    )
    this.unloadModel()
    this.onVimLoaded(scene, settings)
    this.setState('Ready')
  }

  /**
   * Reloads the current model with the same settings except it applies a new element filter
   * @param includedElementIds array of element ids to keep, passing undefined will load the whole model
   */
  filter (includedElementIds: number[] | undefined) {
    if (!this.modelSettings) throw new Error(NO_SCENE_LOADED)
    const options = this.modelSettings.getOptions()
    options.elementIds = includedElementIds
    this.reloadModel(options)
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
    const nodeIndex = this.vimScene.getNodeIndexFromMesh(mesh, index)
    return this.vimScene.getElementIndexFromNodeIndex(nodeIndex)
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

    const geometry = this.createBufferGeometryFromNodeIndices(nodes)
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

    const geometry = this.createBufferGeometryFromNodeIndices(nodes)
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
   * Move the camera to frame the whole model
   */
  lookAtModel () {
    this.camera.frameScene(this.renderer.getBoundingSphere())
  }

  /**
   * Apply modified viewer settings
   */
  public ApplySettings () {
    this.environment.applySettings(
      this.settings,
      this.modelSettings,
      this.renderer.getBoundingBox()
    )
    this.camera.applySettings(this.settings, this.renderer.getBoundingSphere())
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

  // TODO: Move Somewhere
  private createBufferGeometryFromNodeIndices (
    nodeIndices: number[]
  ): THREE.BufferGeometry | null {
    if (!this.vimScene || !this.modelSettings) throw new Error(NO_SCENE_LOADED)
    const scene = this.vimScene

    // Create geometry for every node
    const geometries: THREE.BufferGeometry[] = []
    // TODO not create builder for every node, this is awful
    nodeIndices.forEach((nodeIndex) => {
      // Build Opaque geometry
      const builder = new BufferGeometryBuilder(scene.vim.g3d, 'all')
      const all = builder.createGeometryFromInstanceIndex(nodeIndex)
      if (all) geometries.push(all)
    })

    // bail if none of the node had geometry
    if (geometries.length === 0) return null

    // Merge all geometry
    const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries)
    geometry.applyMatrix4(this.modelSettings.getModelMatrix())

    // Dispose intermediate geometries
    geometries.forEach((b) => b.dispose)

    return geometry
  }
}
