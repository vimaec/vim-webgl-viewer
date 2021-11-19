/**
 @author VIM / https://vimaec.com
*/

// external
import * as THREE from 'three'

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'

// internal
import { ViewerSettings } from './viewerSettings'
import { ViewerCamera } from './viewerCamera'
import { ViewerInput } from './viewerInput'
import { loadAny } from './viewerLoader'

import { Selection } from './selection'
import { ViewerEnvironment } from './viewerEnvironment'
import { ViewerRenderer } from './viewerRenderer'

// loader
import { VimScene } from '../vim-loader/vimScene'
import { BufferGeometryBuilder } from '../vim-loader/VIMLoader'

export type ViewerState =
  | 'Default'
  | [state: 'Downloading', progress: number]
  | 'Processing'

export class Viewer {
  settings: ViewerSettings

  environment: ViewerEnvironment
  render: ViewerRenderer
  selection: Selection
  cameraController: ViewerCamera
  controls: ViewerInput

  vimScene: VimScene | undefined
  state: ViewerState = 'Default'
  static stateChangeEventName = 'viewerStateChangedEvent'

  constructor (options: Record<string, unknown>) {
    this.settings = new ViewerSettings(options)
    let canvas = document.getElementById(
      this.settings.raw.canvasId
    ) as HTMLCanvasElement
    if (!canvas) {
      canvas = document.createElement('canvas')
      document.body.appendChild(canvas)
    }
    this.render = new ViewerRenderer(canvas)

    this.cameraController = new ViewerCamera(this.render.camera, this.settings)

    this.environment = ViewerEnvironment.createDefault()

    // Input and Selection
    this.controls = new ViewerInput(
      this.render.canvas,
      this.cameraController,
      this
    )
    this.controls.register()
    this.selection = new Selection(this)

    // Load Vim
    loadAny(
      this.settings.raw.url,
      (
        result:
          | VimScene
          | THREE.Scene
          | THREE.Group
          | THREE.Object3D
          | THREE.BufferGeometry
      ) => {
        this.setState('Processing')
        setTimeout(() => this.loadInScene(result), 0)
      },
      (progress) => {
        this.setState(['Downloading', progress.loaded])
      },
      this.settings.raw.fileExtension
    )

    // Start Loop
    this.ApplySettings()
    this.animate()
  }

  private setState = (state: ViewerState) => {
    this.state = state
    const event = new CustomEvent(Viewer.stateChangeEventName, {
      detail: this.state
    })
    dispatchEvent(event)
  }

  private loadInScene = (
    result:
      | VimScene
      | THREE.Scene
      | THREE.Group
      | THREE.Object3D
      | THREE.BufferGeometry
  ) => {
    if (result instanceof VimScene) {
      this.onVimLoaded(result)
    } else if (result instanceof THREE.Scene) {
      result.traverse((obj) => {
        if (obj instanceof THREE.Mesh) this.render.addToModel([obj])
      })
    } else if (result instanceof THREE.BufferGeometry) {
      result.computeVertexNormals()
      this.render.addToModel([new THREE.Mesh(result)])
    } else if (
      result instanceof THREE.Group ||
      result instanceof THREE.Object3D
    ) {
      this.render.addToModel([result])
    }

    if (!this.render.boundingBox) {
      this.render.computeBoundingBox(this.settings.getObjectMatrix())
    }

    this.lookAtModel()
    this.ApplySettings()
    this.setState('Default')
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

  private onVimLoaded (vim: VimScene) {
    this.vimScene = vim
    console.log('Adding models to scene')
    this.render.addToModel(vim.geometry.meshes)
    console.log('Adding environement to scene')
    this.render.addToScene(this.environment.getElements())

    const box = vim.geometry.boundingBox.clone()
    box.applyMatrix4(this.settings.getObjectMatrix())
    this.render.boundingBox = box
    this.render.updateModel(this.settings.getObjectMatrix())

    console.log('Everything ready')
    console.time('FirstRender')
    this.render.render()
    console.timeEnd('FirstRender')
  }

  // TODO: Handle case where an element Id is not unique
  /**
   * Get the element index from the element Id
   * @param elementId id of element
   * @returns index of element
   */
  getElementIndexFromElementId = (elementId: number) =>
    this.vimScene.getElementIndexFromElementId(elementId)

  /**
   * Get the parent element index from a node index
   * @param nodeIndex index of node
   * @returns index of element
   */
  getElementIndexFromNodeIndex = (nodeIndex: number) =>
    this.vimScene.getElementIndexFromNodeIndex(nodeIndex)

  /**
   * Get the element index related to given mesh
   * @param mesh instanced mesh
   * @param index index into the instanced mesh
   * @returns index of element
   */
  getElementIndexFromMeshInstance = (mesh: THREE.Mesh, index: number) => {
    const nodeIndex = this.vimScene.getNodeIndexFromMesh(mesh, index)
    return this.vimScene.getElementIndexFromNodeIndex(nodeIndex)
  }

  /**
   * highlight all geometry related to and element
   * @param elementIndex index of element
   * @returns a disposer function for the created geometry
   */
  highlightElementByIndex (elementIndex: number): Function {
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
    const nodes = this.vimScene.getNodeIndicesFromElementIndex(elementIndex)
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
    this.environment.applySettings(this.settings, this.render.boundingBox)
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
    let geometries = nodeIndices.map((nodeIndex) => {
      // this is awful to create builder everytime
      const builder = new BufferGeometryBuilder(this.vimScene.vim.g3d)
      return builder.createBufferGeometryFromInstanceIndex(nodeIndex)
    })
    geometries = geometries.filter((b) => b !== null)
    if (geometries.length === 0) return null
    const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries)
    geometries.forEach((b) => b.dispose)

    geometry.applyMatrix4(this.settings.getObjectMatrix())
    return geometry
  }
}
