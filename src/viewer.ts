/**
 @author VIM / https://vimaec.com
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { VIMLoader } from './VIMLoader'
import { VimScene } from './vim'
import { ViewerSettings } from './viewer_settings'
import { ViewerCamera, direction } from './viewer_camera'
import { ViewerInput } from './viewer_input'
import { ViewerGui } from './viewer_gui'
import Stats from 'stats.js'

/*
Vim Viewer
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/

export class Viewer {
  canvas: HTMLCanvasElement | undefined = undefined
  logo: HTMLImageElement | undefined = undefined
  link: HTMLAnchorElement | undefined = undefined
  favicon: HTMLImageElement | undefined = undefined

  stats: any
  settings: any
  camera: THREE.PerspectiveCamera 
  renderer: THREE.WebGLRenderer 
  scene: THREE.Scene
  meshes = []

  plane: THREE.Mesh 
  skyLight: THREE.HemisphereLight
  sunLight: THREE.DirectionalLight 
  material: THREE.MeshPhongMaterial
  removeListeners: Function

  // eslint-disable-next-line no-use-before-define
  selection: Selection
  cameraController: ViewerCamera
  // eslint-disable-next-line no-use-before-define
  controls: ViewerInput
  vimScene: VimScene
  boundingSphere: THREE.Sphere

  clock = new THREE.Clock();

  constructor () {
    this.canvas = undefined
  }

  view (options: Record<string, unknown>) {
    this.settings = deepmerge(ViewerSettings.default, options, undefined)

    this.prepareDocument()

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: this.canvas
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true;

    // Create the camera and size everything appropriately
    this.camera = new THREE.PerspectiveCamera()
    this.cameraController = new ViewerCamera(this.camera, this.settings)
    this.resizeCanvas(true)

    // Create scene object
    this.scene = new THREE.Scene()

    if (this.settings.showGui) {
      // Create a new DAT.gui controller
      ViewerGui.bind(this.settings, (settings) => {
        this.settings = settings
        this.updateScene()
      })
    }

    // Ground
    this.plane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(1000, 1000),
      new THREE.MeshPhongMaterial()
    )
    this.plane.rotation.x = -Math.PI / 2
    this.scene.add(this.plane)

    // Lights
    this.skyLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.6 );
    this.skyLight.color.setHSL( 0.6, 1, 0.6 );
    this.skyLight.groundColor.setHSL( 0.095, 1, 0.75 );
    this.skyLight.position.set( 0, 50, 0 );
    this.scene.add( this.skyLight );

    const hemiLightHelper = new THREE.HemisphereLightHelper( this.skyLight, 10 );
    this.scene.add( hemiLightHelper );

    //
    this.sunLight = new THREE.DirectionalLight( 0xffffff, 1 );
    this.sunLight.color.setHSL( 0.1, 1, 0.95 );
    this.sunLight.position.set( - 1, 1.75, 1 );
    this.sunLight.position.multiplyScalar( 30 );
    this.scene.add( this.sunLight );

    const dirLightHelper = new THREE.DirectionalLightHelper( this.sunLight, 10 );
    this.scene.add( dirLightHelper );

    // Material
    this.material = new THREE.MeshPhongMaterial({
      color: 0xffffffff,
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
      shininess: 70
    })

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
    this.controls = new ViewerInput(
      this.canvas,
      this.settings,
      this.cameraController,
      this
    )
    this.controls.register()
    this.selection = new Selection(this)

    // Add all of the appropriate mouse, touch-pad, and keyboard listeners
    // Load Vim
    this.loadFile(this.settings.url, (vim) => this.onVimLoaded(vim))

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
    this.logo.src = 'logo.png'
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

    // Set Favicon
    this.favicon = document.createElement('img')
    this.favicon.setAttribute('href', 'favicon.ico')
    document.head.appendChild(this.favicon)
  }

  onVimLoaded (vim) {
    for (let i = 0; i < vim.meshes.length; ++i) {
      this.meshes.push(vim.meshes[i])
      this.scene.add(vim.meshes[i])
    }
    this.boundingSphere = vim.boundingSphere.clone()
    this.boundingSphere.applyMatrix4(this.getViewMatrix())
    this.vimScene = vim

    this.focusModel()
  }

  loadFile (fileName, onSuccess: Function) {
    function getExt (fileName) {
      const indexOfQueryParams = fileName.lastIndexOf('?')
      if (indexOfQueryParams >= 0) {
        fileName = fileName.substring(0, indexOfQueryParams)
      }
      const extPos = fileName.lastIndexOf('.')
      return fileName.slice(extPos + 1).toLowerCase()
    }

    console.log('Loading file: ' + fileName)
    const ext = getExt(fileName)
    if (ext !== 'vim') {
      console.error('unhandled file format')
      return
    }

    console.time('loadingVim')
    const loader = new VIMLoader(this.material)
    loader.load(
      fileName,
      (vim) => {
        console.log(
          'Finished loading VIM: found ' + vim.meshes.length + ' objects'
        )
        console.timeEnd('loadingVim')
        onSuccess(vim)
      },
      undefined,
      undefined
    )
  }

  // Calls render, and asks the framework to prepare the next frame
  animate () {
    requestAnimationFrame(() => this.animate())
    var timeDelta = this.clock.getDelta();
    this.resizeCanvas()
    this.updateObjects()
    this.cameraController.frameUpdate(timeDelta);
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

  createWorldGeometry (mesh, index) {
    const geometry = mesh.geometry.clone()

    let matrix = new THREE.Matrix4()
    mesh.getMatrixAt(index, matrix)
    matrix = this.getViewMatrix().multiply(matrix)
    geometry.applyMatrix4(matrix)

    return geometry
  }

  getNodeIndex (mesh, instance) {
    return mesh.userData.instanceIndices[instance]
  }

  select (mesh, index) {
    this.selection.select(mesh, index)
    const nodeIndex = this.getNodeIndex(mesh, index)
    const elementName = this.getElementNameFromNodeIndex(nodeIndex)
    console.log('Selected Element: ' + elementName)
  }

  clearSelection () {
    this.selection.reset()
    console.log('Cleared Selection')
  }

  focusSelection () {
    if (this.selection.hasSelection()) {
      this.cameraController.lookAtSphere(this.selection.boundingSphere)
    } 
    else 
    {
      this.cameraController.lookAtSphere(this.boundingSphere)
    }
  }

  focusModel () {
    this.cameraController.frameScene(this.boundingSphere);
  }

  resizeCanvas (force: boolean = false) {
    if (!this.settings.autoResize && !force) {
      return
    }

    const w = window.innerWidth / window.devicePixelRatio
    const h = window.innerHeight / window.devicePixelRatio
    this.renderer.setSize(w, h, false)
    this.camera.aspect = this.canvas.width / this.canvas.height
    this.camera.updateProjectionMatrix()
  }

  // Called every frame in case settings are updated
  updateScene () {
    this.scene.background = toColor(this.settings.background.color)
    this.plane.visible = this.settings.plane.show
    this.updateMaterial(this.plane.material, this.settings.plane.material)
    this.plane.position.copy(toVec(this.settings.plane.position))
    this.cameraController.applySettings(this.settings)
    
    this.skyLight.color.setHSL( this.settings.skylight.skyColor.h, this.settings.skylight.skyColor.s, this.settings.skylight.skyColor.l );
    this.skyLight.groundColor.setHSL( this.settings.skylight.groundColor.h, this.settings.skylight.groundColor.s, this.settings.skylight.groundColor.l );
    this.skyLight.intensity = this.settings.skylight.intensity;
    this.sunLight.color.setHSL( this.settings.sunLight.color.h, this.settings.sunLight.color.s, this.settings.sunLight.color.l );
    this.sunLight.position.set( this.settings.sunLight.position.x, this.settings.sunLight.position.y, this.settings.sunLight.position.z );
    this.sunLight.intensity = this.settings.sunLight.intensity;
  }

  updateMaterial (targetMaterial, settings) {
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

  // TODO: Add more granular ways to access the bim data.
  getElementNameFromNodeIndex (nodeIndex: number) {
    const vim = this.vimScene.vim
    const elementIndex = vim.bim.get('Vim.Node').get('Rvt.Element')[nodeIndex]
    const stringIndex = vim.bim.get('Rvt.Element').get('Name')[elementIndex]
    const name = vim.strings[stringIndex]
    return name
  }
}

// TODO: Fix circular dependency
class Selection {
  // Dependencies
  viewer: Viewer

  // State
  meshIndex: number | null = null
  instanceIndex: number | null = null
  boundingSphere: THREE.Sphere | null = null

  // Disposable State
  geometry: THREE.BufferGeometry | null = null
  highlightDisposer: Function | null = null

  constructor (viewer: Viewer) {
    this.viewer = viewer
  }

  hasSelection () {
    return this.meshIndex !== null
  }

  reset () {
    this.meshIndex = null
    this.instanceIndex = null
    this.boundingSphere = null
    this.disposeResources()
  }

  disposeResources () {
    this.geometry?.dispose()
    this.geometry = null

    this.highlightDisposer?.()
    this.highlightDisposer = null
  }

  select (mesh: number, index: number) {
    this.disposeResources()
    this.meshIndex = mesh
    this.instanceIndex = index
    this.geometry = this.viewer.createWorldGeometry(mesh, index)
    this.geometry.computeBoundingSphere()
    this.boundingSphere = this.geometry.boundingSphere.clone()
    this.highlightDisposer = this.viewer.highlight(this.geometry)
  }
}

// Helpers
function isColor (obj) {
  return typeof obj === 'object' && 'r' in obj && 'g' in obj && 'b' in obj
}

function toColor (c) {
  if (!isColor(c)) {
    throw new Error('Not a color')
  }
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255)
}

function toVec (obj) {
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
