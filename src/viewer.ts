/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { VimScene } from './vim'
import { ViewerSettings } from './viewerSettings'
import { ViewerCamera } from './viewerCamera'
import { ViewerInput } from './viewerInput'
import { ViewerGui } from './viewerGui'
import { loadAny } from './viewerLoader'
import Stats from 'stats.js'
import logo from './assets/logo.png'
import { Selection } from './viewerSelection'
import { ViewerEnvironment } from './viewerEnvironment'

export class Viewer {
  canvas: HTMLCanvasElement | undefined = undefined
  logo: HTMLImageElement | undefined = undefined
  link: HTMLAnchorElement | undefined = undefined

  stats: any
  settings: any

  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  boundingSphere: THREE.Sphere
  clock = new THREE.Clock()

  meshes = []

  material: THREE.MeshPhongMaterial
  environment: ViewerEnvironment

  selection: Selection
  cameraController: ViewerCamera
  controls: ViewerInput
  vimScene: VimScene

  constructor (options: Record<string, unknown>) {
    this.settings = deepmerge(ViewerSettings.default, options, undefined)

    this.prepareDocument()

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: this.canvas
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true

    // Create the camera and size everything appropriately
    this.camera = new THREE.PerspectiveCamera()
    this.cameraController = new ViewerCamera(this.camera, this.settings)
    this.resizeRenderer(true, this.canvas)

    // Create scene object
    this.scene = new THREE.Scene()

    if (this.settings.showGui) {
      // Create a new DAT.gui controller
      ViewerGui.bind(this.settings, (settings) => {
        this.settings = settings
        this.updateScene()
      })
    }

    // Material
    this.material = new THREE.MeshPhongMaterial({
      color: 0xffffffff,
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
      shininess: 70
    })
    this.environment = ViewerEnvironment.createDefault()
    // Initial scene update: happens if controls change
    this.updateScene()

    // Add Stats display
    if (this.settings.showStats) {
      this.stats = new Stats()
      this.stats.dom.style.top = '84px'
      this.stats.dom.style.left = '16px'
      document.body.appendChild(this.stats.dom)
    }

    // Input and Selection
    this.controls = new ViewerInput(this.canvas, this.cameraController, this)
    this.controls.register()
    this.selection = new Selection(this)

    // Add all of the appropriate mouse, touch-pad, and keyboard listeners
    // Load Vim
    loadAny(this.settings.url, this.loadInScene.bind(this))

    // Start Loop
    this.animate()
  }

  prepareDocument () {
    // Get or Add Canvas
    let canvas = document.getElementById(this.settings.canvasId)

    if (!canvas) {
      canvas = document.createElement('canvas')
      document.body.appendChild(canvas)
    }
    this.canvas = canvas as HTMLCanvasElement

    // Add Vim logo
    this.logo = document.createElement('img')
    this.logo.src = logo
    this.logo.style.position = 'fixed'
    this.logo.style.top = '16px'
    this.logo.style.left = '16px'
    this.logo.height = 48
    this.logo.width = 128

    // Add logo as link
    this.link = document.createElement('a')
    this.link.href = 'https://vimaec.com'
    this.link.appendChild(this.logo)
    document.body.prepend(this.link)
  }

  loadInScene (
    result:
      | VimScene
      | THREE.Scene
      | THREE.Group
      | THREE.Object3D
      | THREE.BufferGeometry
  ) {
    if (result instanceof VimScene) {
      this.onVimLoaded(result)
      return
    }

    if (result instanceof THREE.Scene) {
      result.traverse((obj) => {
        if (obj instanceof THREE.Mesh) this.addToScene(obj)
      })
    } else if (result instanceof THREE.BufferGeometry) {
      result.computeVertexNormals()
      this.addToScene(new THREE.Mesh(result))
    } else if (
      result instanceof THREE.Group ||
      result instanceof THREE.Object3D
    ) {
      this.addToScene(result)
    }
    // this.boundingSphere = this.computeBoundingSphere(this.scene)
    this.boundingSphere.applyMatrix4(this.getViewMatrix())
    this.focusModel()
  }

  onVimLoaded (vim: VimScene) {
    this.vimScene = vim
    const meshes = vim.geometry.meshes
    meshes.forEach(this.addToScene.bind(this))

    this.boundingSphere = vim.geometry.boundingSphere.clone()
    this.boundingSphere = this.boundingSphere.applyMatrix4(this.getViewMatrix())

    this.environment.addToScene(this.scene)
    this.focusModel()
    this.updateScene()
  }

  addToScene (object: THREE.Object3D) {
    this.scene.add(object)
    this.meshes.push(object)
  }

  computeBoundingSphere (scene: THREE.Scene): THREE.Sphere {
    let sphere: THREE.Sphere = null

    const grow = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
      geometry.computeBoundingSphere()
      let currentSphere = geometry.boundingSphere.clone()
      currentSphere = currentSphere.applyMatrix4(matrix)
      sphere = sphere ? sphere.union(currentSphere) : currentSphere
    }
    const matrix = new THREE.Matrix4()
    scene.traverse((obj) => {
      if (obj instanceof THREE.InstancedMesh) {
        for (let i = 0; i < obj.count; i++) {
          obj.getMatrixAt(i, matrix)
          grow(obj.geometry, matrix)
        }
      } else if (obj instanceof THREE.Mesh) {
        grow(obj.geometry, obj.matrix)
      }
    })

    return sphere
  }

  // Calls render, and asks the framework to prepare the next frame
  animate () {
    requestAnimationFrame(() => this.animate())
    const timeDelta = this.clock.getDelta()
    this.resizeRenderer(false, this.canvas)
    this.updateObjects()
    this.cameraController.frameUpdate(timeDelta)
    this.renderer.render(this.scene, this.camera)
    if (this.stats) {
      this.stats.update()
    }
  }

  updateObjects () {
    for (let i = 0; i < this.meshes.length; i++) {
      this.applyViewMatrix(this.meshes[i])
    }
  }

  applyViewMatrix (mesh) {
    const matrix = this.getViewMatrix()
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(matrix)
  }

  // TODO Not create this everytime, Not apply this every time either.
  getViewMatrix () {
    const pos = this.settings.object.position
    const rot = toQuaternion(this.settings.object.rotation)
    const scl = scalarToVec(0.1)
    const matrix = new THREE.Matrix4().compose(pos, rot, scl)
    return matrix
  }

  highlight (geometry): Function {
    const wireframe = new THREE.WireframeGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    const line = new THREE.LineSegments(wireframe, material)

    this.scene.add(line)

    // returns disposer
    return () => {
      this.scene.remove(line)
      wireframe.dispose()
      material.dispose()
    }
  }

  createWorldGeometry (mesh: THREE.Mesh, index: number) {
    const geometry = mesh.geometry.clone()

    let matrix = new THREE.Matrix4()
    if (mesh instanceof THREE.InstancedMesh) mesh.getMatrixAt(index, matrix)
    else matrix.copy(mesh.matrix)
    matrix = this.getViewMatrix().multiply(matrix)
    geometry.applyMatrix4(matrix)

    return geometry
  }

  selectByElementId (elementId: number) {
    const meshes = this.vimScene.getMeshesFromElement(elementId)
    this.select(meshes[0][0], meshes[0][1])
  }

  select (mesh: THREE.Mesh, index: number) {
    this.selection.select(mesh, index)
    const nodeIndex = this.vimScene.getNodeIndexFromMesh(mesh, index)
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
      this.cameraController.lookAtSphere(this.selection.boundingSphere)
    } else {
      this.cameraController.frameScene(this.boundingSphere)
    }
  }

  focusModel () {
    this.cameraController.frameScene(this.boundingSphere)
  }

  resizeRenderer (force: boolean = false, canvas: HTMLCanvasElement) {
    if (!this.settings.autoResize && !force) {
      return
    }

    const w = window.innerWidth / window.devicePixelRatio
    const h = window.innerHeight / window.devicePixelRatio
    this.renderer.setSize(w, h, false)
    this.camera.aspect = canvas.width / canvas.height
    this.camera.updateProjectionMatrix()
  }

  // Called every frame in case settings are updated
  updateScene () {
    this.scene.background = toColor(this.settings.background.color)
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

function isColor (obj) {
  return typeof obj === 'object' && 'r' in obj && 'g' in obj && 'b' in obj
}

function toColor (c) {
  if (!isColor(c)) {
    throw new Error('Not a color')
  }
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255)
}

export function toVec (obj) {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}

function scalarToVec (x) {
  return new THREE.Vector3(x, x, x)
}

function toEuler (rot) {
  return new THREE.Euler(
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180
  )
}

function toQuaternion (rot) {
  const q = new THREE.Quaternion()
  q.setFromEuler(toEuler(rot))
  return q
}
