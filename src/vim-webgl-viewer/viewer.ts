/**
 @author VIM / https://vimaec.com
*/

// external
import * as THREE from 'three'
import deepmerge from 'deepmerge'

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
  settings: any

  environment: ViewerEnvironment
  render: ViewerRenderer
  selection: Selection
  cameraController: ViewerCamera
  controls: ViewerInput

  vimScene: VimScene | undefined
  state: ViewerState = 'Default'
  static stateChangeEventName = 'viewerStateChangedEvent'

  constructor (options: Record<string, unknown>) {
    this.settings = deepmerge(ViewerSettings.default, options, undefined)

    let canvas = document.getElementById(
      this.settings.canvasId
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

    // Add all of the appropriate mouse, touch-pad, and keyboard listeners
    // Load Vim
    loadAny(
      this.settings.url,
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
      this.settings.fileExtension
    )

    // Start Loop
    this.ApplySettings()
    this.animate()
  }

  setState = (state: ViewerState) => {
    this.state = state
    const event = new CustomEvent(Viewer.stateChangeEventName, {
      detail: this.state
    })
    dispatchEvent(event)
  }

  loadInScene = (
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

    if (!this.render.boundingSphere) {
      this.render.computeBoundingSphere(this.getViewMatrix())
    }

    this.focusModel()
    this.ApplySettings()
    this.setState('Default')
  }

  onVimLoaded (vim: VimScene) {
    this.vimScene = vim
    console.log('Adding models to scene')
    this.render.addToModel(vim.geometry.meshes)
    console.log('Adding environement to scene')
    this.render.addToScene(this.environment.getElements())

    const sphere = vim.geometry.boundingSphere.clone()
    sphere.applyMatrix4(this.getViewMatrix())
    this.render.boundingSphere = sphere
    this.render.updateModel(this.getViewMatrix())

    console.log('Everything ready')
    console.time('FirstRender')
    this.render.render()
    console.timeEnd('FirstRender')
  }

  // Calls render, and asks the framework to prepare the next frame
  animate () {
    requestAnimationFrame(() => this.animate())

    // Camera
    const timeDelta = this.render.clock.getDelta()
    this.cameraController.frameUpdate(timeDelta)

    // Model
    if (this.settings.autoResize) this.render.fitToCanvas()

    this.render.render()
  }

  // TODO Not create this everytime, Not apply this every time either.
  getViewMatrix () {
    const pos = this.settings.object.position
    const rot = toQuaternion(this.settings.object.rotation)
    const scl = scalarToVec(0.1)
    const matrix = new THREE.Matrix4().compose(pos, rot, scl)
    return matrix
  }

  highlight (geometry: THREE.BufferGeometry): Function {
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

  createWorldGeometry (mesh: THREE.Mesh, index: number): THREE.BufferGeometry {
    const geometry = mesh.geometry.clone()

    let matrix = new THREE.Matrix4()
    if (mesh instanceof THREE.InstancedMesh) mesh.getMatrixAt(index, matrix)
    else matrix.copy(mesh.matrix)
    matrix = this.getViewMatrix().multiply(matrix)
    geometry.applyMatrix4(matrix)

    return geometry
  }

  createBufferGeometryFromNodeId (nodeIndex: number): THREE.BufferGeometry {
    // TODO not create a full GeometryBuilder
    const builder = new BufferGeometryBuilder(this.vimScene.vim.g3d)
    const geometry = builder.createBufferGeometryFromInstanceIndex(nodeIndex)
    const matrix = this.getViewMatrix()
    geometry.applyMatrix4(matrix)
    return geometry
  }

  selectByElementId (elementId: number) {
    if (!this.vimScene) return
    const meshes = this.vimScene.getMeshesFromElementId(elementId)
    if (meshes?.length) this.select(meshes[0][0], meshes[0][1])
    else console.log(`Could not find mesh for elemetId ${elementId}`)
  }

  select (mesh: THREE.Mesh, index: number) {
    if (!this.vimScene) return
    if (!mesh) throw new Error('Invalid null mesh')
    if (index < 0) throw new Error('invalid negative index')

    let nodeIndex: number
    if (mesh.userData.merged) {
      nodeIndex = index
    } else {
      nodeIndex = this.vimScene.getNodeIndexFromMesh(mesh, index)
    }

    if (nodeIndex === undefined) {
      console.log('Could not find node for given mesh')
      return
    }

    this.selection.select(nodeIndex)

    const id = this.vimScene.getElementIdFromNodeIndex(nodeIndex)
    const name = this.vimScene.getElementNameFromNodeIndex(nodeIndex)
    console.log(`Selected Element: ${id} - ${name}`)
  }

  clearSelection () {
    this.selection.reset()
    console.log('Cleared Selection')
  }

  focusSelection () {
    if (this.selection.hasSelection()) {
      this.cameraController.lookAtSphere(this.selection.boundingSphere!)
    } else {
      this.cameraController.frameScene(this.render.boundingSphere)
    }
  }

  focusModel () {
    this.cameraController.frameScene(this.render.boundingSphere)
  }

  // Called every frame in case settings are updated
  ApplySettings () {
    this.render.scene.background = toColor(this.settings.background.color)
    this.environment.applySettings(this.settings)
    this.cameraController.applySettings(this.settings)
  }
}

// Helpers

export function updateMaterial (
  targetMaterial: THREE.MeshPhongMaterial,
  settings: any
) {
  if ('color' in settings) targetMaterial.color = toColor(settings.color)
  if ('flatShading' in settings) {
    targetMaterial.flatShading = settings.flatShading
  }
  if ('emissive' in settings) {
    targetMaterial.emissive = toColor(settings.emissive)
  }
  if ('specular' in settings) {
    targetMaterial.specular = toColor(settings.specular)
  }
  if ('wireframe' in settings) targetMaterial.wireframe = settings.wireframe
  if ('shininess' in settings) targetMaterial.shininess = settings.shininess
}

function isColor (obj: any): boolean {
  return typeof obj === 'object' && 'r' in obj && 'g' in obj && 'b' in obj
}

function toColor (c: any): THREE.Color {
  if (!isColor(c)) {
    throw new Error('Not a color')
  }
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255)
}

function isVector (obj: any): boolean {
  return typeof obj === 'object' && 'x' in obj && 'y' in obj && 'z' in obj
}
export function toVec (obj: any): THREE.Vector3 {
  if (!isVector(obj)) {
    throw new Error('Not a vector')
  }
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}

function scalarToVec (x: number): THREE.Vector3 {
  return new THREE.Vector3(x, x, x)
}

function toEuler (rot: THREE.Vector3): THREE.Euler {
  return new THREE.Euler(
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180
  )
}

function toQuaternion (rot: THREE.Vector3): THREE.Quaternion {
  const q = new THREE.Quaternion()
  q.setFromEuler(toEuler(rot))
  return q
}
