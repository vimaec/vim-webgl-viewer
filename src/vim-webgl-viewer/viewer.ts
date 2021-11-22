/**
 @author VIM / https://vimaec.com
*/

// external
import * as THREE from 'three'

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'

// internal
import { ModelSettings, ViewerSettings } from './viewerSettings'
import { ViewerCamera } from './viewerCamera'
import { ViewerInput } from './viewerInput'
import { VIMLoader, BufferGeometryBuilder } from '../vim-loader/VIMLoader'

import { Selection } from './selection'
import { ViewerEnvironment } from './viewerEnvironment'
import { ViewerRenderer } from './viewerRenderer'

// loader
import { VimScene } from '../vim-loader/vimScene'

export type ViewerState =
  | 'Uninitialized'
  | [state: 'Downloading', progress: number]
  | 'Processing'
  | [state: 'Error', error: ErrorEvent]
  | 'Ready'

const NO_SCENE_LOADED = 'No loaded in viewer. Ignoring'

export class Viewer {
  settings: ViewerSettings

  environment: ViewerEnvironment
  render: ViewerRenderer
  selection: Selection
  cameraController: ViewerCamera
  controls: ViewerInput

  // State
  modelSettings: ModelSettings
  vimScene: VimScene | undefined
  state: ViewerState = 'Uninitialized'
  static stateChangeEvent = 'viewerStateChangedEvent'

  constructor (options: Record<string, unknown>) {
    this.settings = new ViewerSettings(options)

    const canvas = Viewer.getOrCreateCanvas(this.settings.raw.canvasId)
    this.render = new ViewerRenderer(canvas)

    this.cameraController = new ViewerCamera(this.render.camera, this.settings)

    this.environment = ViewerEnvironment.createDefault()
    this.render.addToScene(this.environment.getElements())

    // Input and Selection
    this.controls = new ViewerInput(
      this.render.canvas,
      this.cameraController,
      this
    )
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
    const timeDelta = this.render.clock.getDelta()
    this.cameraController.frameUpdate(timeDelta)

    // Model
    if (this.settings.raw.autoResize) this.render.fitToCanvas()
    this.render.render()
  }

  /**
   * Load a vim model into the viewer from local or remote location
   * @param options model options
   * @param onLoad callback on model loaded
   * @param onProgress callback on download progresss and on processing started
   * @param onError callback on error
   */
  public loadModel (
    options: any,
    onLoad?: (response: VimScene) => void,
    onProgress?: (request: ProgressEvent | 'processing') => void,
    onError?: (event: ErrorEvent) => void
  ) {
    if (this.modelSettings) {
      throw new Error('There is already a model loaded or loading')
    }

    this.modelSettings = new ModelSettings(options)

    new VIMLoader().load(
      this.modelSettings.getURL(),
      (vim) => {
        this.onVimLoaded(vim)
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
        this.modelSettings = null
        this.setState(['Error', error])
        onError?.(error)
      }
    )
  }

  private onVimLoaded (vim: VimScene) {
    this.vimScene = vim

    const matrix = this.modelSettings.getObjectMatrix()

    // Bounding Box
    const box = vim.geometry.boundingBox.clone()
    box.applyMatrix4(matrix)
    this.render.boundingBox = box

    // Model
    this.render.addToModel(vim.geometry.meshes)
    this.render.updateModel(matrix)
    this.render.render()

    this.lookAtModel()
    this.ApplySettings()
  }

  private setState = (state: ViewerState) => {
    this.state = state
    const event = new CustomEvent(Viewer.stateChangeEvent, {
      detail: this.state,
      bubbles: true
    })
    this.render.canvas.dispatchEvent(event)
  }

  private static getOrCreateCanvas (canvasId: string) {
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement

    if (!canvas) {
      canvas = document.createElement('canvas')
      document.body.appendChild(canvas)
    }
    return canvas
  }

  getModelMatrix = () => {
    return this.modelSettings?.getObjectMatrix()
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
  getElementIndexFromNodeIndex = (nodeIndex: number) => {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    return this.vimScene.getElementIndexFromNodeIndex(nodeIndex)
  }

  /**
   * Get the element index related to given mesh
   * @param mesh instanced mesh
   * @param index index into the instanced mesh
   * @returns index of element
   */
  getElementIndexFromMeshInstance = (mesh: THREE.Mesh, index: number) => {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    const nodeIndex = this.vimScene.getNodeIndexFromMesh(mesh, index)
    if (nodeIndex === undefined) {
      console.error(`Could not find nodeIndex for mesh:${mesh}, index:${index}`)
      return undefined
    }
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
  getBoudingBoxForElementIndex (elementIndex: number): THREE.Box3 | null {
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
    this.selection.reset()
    console.log('Cleared Selection')
  }

  /**
   * Move the camera to frame all geometry related to an element
   * @param elementIndex index of element
   */
  lookAtElementIndex (elementIndex: number) {
    const box = this.getBoudingBoxForElementIndex(elementIndex)
    if (!box) {
      console.error(
        'Could not create geometry for element index: ' + elementIndex
      )
      return
    }

    const sphere = box.getBoundingSphere(new THREE.Sphere())
    this.cameraController.lookAtSphere(sphere, true)
  }

  /**
   * Move the camera to frame current selection
   */
  lookAtSelection () {
    if (this.selection.hasSelection()) {
      this.cameraController.lookAtSphere(this.selection.boundingSphere!)
    } else {
      this.cameraController.frameScene(this.render.getBoundingSphere())
    }
  }

  /**
   * Move the camera to frame the whole model
   */
  lookAtModel () {
    this.cameraController.frameScene(this.render.getBoundingSphere())
  }

  /**
   * Apply modified viewer settings
   */
  public ApplySettings () {
    this.environment.applySettings(
      this.settings,
      this.modelSettings,
      this.render.boundingBox
    )
    this.cameraController.applySettings(this.settings)
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

    this.render.addToScene([line])

    // returns disposer
    return () => {
      this.render.scene.remove(line)
      wireframe.dispose()
      material.dispose()
    }
  }

  // TODO: Move Somewhere
  private createBufferGeometryFromNodeIndices (
    nodeIndices: number[]
  ): THREE.BufferGeometry | null {
    if (!this.vimScene) throw new Error(NO_SCENE_LOADED)
    const scene = this.vimScene

    // Create geometry for every node
    const geometries: THREE.BufferGeometry[] = []
    nodeIndices.forEach((nodeIndex) => {
      const builder = new BufferGeometryBuilder(scene.vim.g3d)
      const g = builder.createBufferGeometryFromInstanceIndex(nodeIndex)
      if (g) geometries.push(g)
    })

    // bail if none of the node had geometry
    if (geometries.length === 0) return null

    // Merge all geometry
    const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries)
    geometry.applyMatrix4(this.modelSettings.getObjectMatrix())

    // Dispose intermediate geometries
    geometries.forEach((b) => b.dispose)

    return geometry
  }
}
