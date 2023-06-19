/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { Settings, getSettings, PartialSettings } from './viewerSettings'
import { Camera } from './camera/camera'
import { Input } from './inputs/input'
import { Selection } from './selection'
import { Environment, IEnvironment } from './environment'
import { Raycaster } from './raycaster'
import { GizmoOrbit } from './gizmos/gizmoOrbit'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { GizmoAxes } from './gizmos/gizmoAxes'
import { SectionBox } from './gizmos/sectionBox/sectionBox'
import { Measure, IMeasure } from './gizmos/measure/measure'
import { GizmoRectangle } from './gizmos/gizmoRectangle'

// loader
import {
  getFullSettings,
  VimPartialSettings,
  VimSettings
} from '../vim-loader/vimSettings'
import { VimBuilder } from '../vim-loader/vimBuilder'
import { Vim } from '../vim-loader/vim'
import { Renderer } from './rendering/renderer'
import {
  GizmoGrid,
  InsertableMesh,
  InstancingArgs,
  MergeArgs,
  Scene,
  VimMaterials
} from '../vim'
import { SignalDispatcher } from 'ste-signals'
import {
  BFast,
  IProgressLogs,
  RemoteBuffer,
  Requester,
  G3dMeshIndex,
  G3dBuilder,
  G3dMesh,
  G3d,
  VimDocument
} from 'vim-format'
import { SceneBuilder } from '../vim-loader/sceneBuilder'
import { ElementMapping } from '../vim-loader/elementMapping'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  /**
   * Current viewer settings.
   */
  settings: Settings

  /**
   * Interface to manage objects to be rendered.
   */
  renderer: Renderer

  /**
   * Interface to manage html canvas.
   */
  viewport: Viewport

  /**
   * Interface to manage viewer selection.
   */
  selection: Selection

  /**
   * Interface to manipulate default viewer inputs.
   */
  inputs: Input

  /**
   * Interface to raycast into the scene to find objects.
   */
  raycaster: Raycaster

  /**
   * Interface to interact with the section gizmo.
   */
  sectionBox: SectionBox

  /**
   * Interface to interact with measure.
   */
  measure: IMeasure

  /**
   * Interface to interact with the rectangle gizmo.
   */
  gizmoRectangle: GizmoRectangle

  /**
   * Interface to interact with the grid gizmo.
   */
  grid: GizmoGrid

  /**
   * Interface to interact with viewer materials
   */
  materials: VimMaterials

  /**
   * Interface to manipulate the viewer camera.
   */
  get camera () {
    return this._camera
  }

  /**
   * Interface to manipulate THREE elements not directly related to vim.
   */
  get environment () {
    return this._environment as IEnvironment
  }

  /**
   * Signal dispatched when a new vim is loaded or unloaded.
   */
  get onVimLoaded () {
    return this._onVimLoaded.asEvent()
  }

  /**
   * Will be removed once gizmo axes are cleaned up to expose canvas.
   * @deprecated
   */
  get axesCanvas () {
    return this._gizmoAxes.canvas
  }

  private _environment: Environment
  private _camera: Camera
  private _clock = new THREE.Clock()
  private _gizmoAxes: GizmoAxes
  private _gizmoOrbit: GizmoOrbit

  // State
  private _vims = new Set<Vim>()
  private _onVimLoaded = new SignalDispatcher()
  private _updateId: number

  constructor (options?: PartialSettings) {
    this.settings = getSettings(options)

    this.materials = VimMaterials.getInstance()

    const scene = new RenderScene()
    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(scene, this.viewport, this.settings)
    this.renderer = new Renderer(
      scene,
      this.viewport,
      this.materials,
      this._camera,
      this.settings
    )

    this.gizmoRectangle = new GizmoRectangle(this)
    this.inputs = new Input(this)

    if (this.settings.camera.gizmo.enable) {
      this._gizmoOrbit = new GizmoOrbit(
        this.renderer,
        this._camera,
        this.inputs,
        this.settings
      )
    }
    this.materials.applySettings(this.settings)

    // TODO add options
    this.measure = new Measure(this)
    this._gizmoAxes = new GizmoAxes(this.camera, this.settings.axes)
    this.viewport.canvas.parentElement?.prepend(this._gizmoAxes.canvas)

    this.sectionBox = new SectionBox(this)

    this.grid = new GizmoGrid(this.renderer, this.materials)

    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Input and Selection
    this.selection = new Selection(this.materials)
    this.raycaster = new Raycaster(
      this.viewport,
      this._camera,
      scene,
      this.renderer
    )

    this.inputs.registerAll()

    // Start Loop
    this.animate()
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    this._updateId = requestAnimationFrame(() => this.animate())
    // Camera
    this.renderer.needsUpdate = this._camera.update(this._clock.getDelta())
    // Rendering
    this.renderer.render()
  }

  /**
   * Returns an array with all loaded vims.
   */
  get vims () {
    return Array.from(this._vims)
  }

  /**
   * Current loaded vim count
   */
  get vimCount () {
    return this._vims.size
  }

  add (vim: Vim, frameCamera = true) {
    if (this._vims.has(vim)) {
      throw new Error('Vim cannot be added again, unless removed first.')
    }

    const success = this.renderer.add(vim.scene)
    if (!success) {
      vim.dispose()
      throw new Error(
        'Could not load vim. Max geometry memory reached. Vim disposed.'
      )
    }
    this._vims.add(vim)

    const box = this.renderer.getBoundingBox()
    if (box) {
      this._environment.adaptToContent(box)
      this.sectionBox.fitBox(box)
    }

    if (frameCamera) {
      this._camera.do(true).frame('all', this._camera.defaultForward)
      this._camera.save()
    }

    this._onVimLoaded.dispatch()
  }

  /**
   * Unload given vim from viewer.
   */
  remove (vim: Vim) {
    if (!this._vims.has(vim)) {
      throw new Error('Cannot remove missing vim from viewer.')
    }

    this._vims.add(vim)
    this.renderer.remove(vim.scene)
    vim.dispose()
    if (this.selection.vim === vim) {
      this.selection.clear()
    }
    this._onVimLoaded.dispatch()
  }

  /**
   * Unloads all vim from viewer.
   */
  clear () {
    this.vims.forEach((v) => this.remove(v))
  }

  async createProgressiveVim (
    vimPath: string,
    folder: string,
    settings: VimPartialSettings
  ) {
    const vimSettings = getFullSettings(settings)
    const buffer = new RemoteBuffer(vimPath, vimSettings.loghttp)
    const bfast = new BFast(buffer)
    const doc = await VimDocument.createFromBfast(bfast, vimSettings.noStrings)

    const [header, instanceToElement, elementIds] = await Promise.all([
      vimSettings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      vimSettings.noMap ? undefined : doc.node.getAllElementIndex(),
      vimSettings.noMap ? undefined : doc.element.getAllId()
    ])

    const index = await G3dMeshIndex.createFromPath(`${folder}_index.gz`)
    const sceneBuilder = new SceneBuilder()
    let scene: Scene
    let mapping: ElementMapping

    let g3d = new G3d(
      new Int32Array(0),
      new Uint16Array(0),
      new Float32Array(0),
      new Int32Array(0),
      new Int32Array(0),
      new Int32Array(0),
      new Int32Array(0),
      new Int32Array(0),
      new Float32Array(0),
      new Float32Array(0)
    )

    const set = new Set<number>()
    let i = 0
    while (i < index.instanceFiles.length) {
      // Create batch
      const batch: number[] = []
      while (batch.length < 5 && i < index.instanceFiles.length) {
        const m = index.instanceFiles[i]
        if (!set.has(m) && m >= 0) {
          set.add(m)
          batch.push(m)
        }
        i++
      }
      if (batch.length === 0) {
        break
      }

      // Get Meshes
      const g3dBuilder = G3dBuilder.fromIndexMeshes(index, batch)
      await g3dBuilder.all((m) => `${folder}_mesh_${m}.gz`)
      const next = g3dBuilder.ToG3d()
      g3d = g3d.append(next)

      console.log(next)
      console.log(g3d)

      // Update Scene
      const selection = [...this.selection.objects].map((o) => o.element)
      this.renderer.remove(scene)
      scene = sceneBuilder.createFromG3d(g3d, vimSettings)
      scene.applyMatrix4(vimSettings.matrix)
      this.renderer.add(scene)

      mapping = vimSettings.noMap
        ? undefined
        : new ElementMapping(
          Array.from(g3d.instanceNodes),
            instanceToElement!,
            elementIds!
        )

      scene.vim = new Vim(header, doc, g3d, scene, vimSettings, mapping)
      const nextSelection = selection.map((o) =>
        scene.vim.getObjectFromElement(o)
      )
      this.selection.select(nextSelection)
    }
  }

  async createProgressiveVim2 (
    vimPath: string,
    folder: string,
    settings: VimPartialSettings
  ) {
    const vimSettings = getFullSettings(settings)
    const buffer = new RemoteBuffer(vimPath, vimSettings.loghttp)
    const bfast = new BFast(buffer)
    const doc = await VimDocument.createFromBfast(bfast, vimSettings.noStrings)

    const [header, instanceToElement, elementIds] = await Promise.all([
      vimSettings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      vimSettings.noMap ? undefined : doc.node.getAllElementIndex(),
      vimSettings.noMap ? undefined : doc.element.getAllId()
    ])

    const index = await G3dMeshIndex.createFromPath(`${folder}_index.gz`)
    const sceneBuilder = new SceneBuilder()
    let scene: Scene
    let mapping: ElementMapping

    // Get Meshes
    const g3dBuilder = G3dBuilder.fromIndexMeshes(index)

    g3dBuilder.all((m) => `${folder}_mesh_${m}.gz`)
    await update(this)

    async function update (self: Viewer) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const [g3d, done] = g3dBuilder.upTo()

      // Update Scene
      const selection = [...self.selection.objects].map((o) => o.element)
      self.renderer.remove(scene)
      scene = sceneBuilder.createFromG3d(g3d, vimSettings)
      scene.applyMatrix4(vimSettings.matrix)
      self.renderer.add(scene)
      self.camera.lerp(1).frame(scene.getBoundingBox())

      mapping = vimSettings.noMap
        ? undefined
        : new ElementMapping(
          Array.from(g3d.instanceNodes),
            instanceToElement!,
            elementIds!
        )

      scene.vim = new Vim(header, doc, g3d, scene, vimSettings, mapping)

      const nextSelection = selection.map((o) =>
        scene.vim.getObjectFromElement(o)
      )
      self.selection.select(nextSelection)

      if (!done) {
        update(self)
      }
    }
  }

  async createProgressiveVim3 (
    vimPath: string,
    folder: string,
    settings: VimPartialSettings
  ) {
    const vimSettings = getFullSettings(settings)
    /*

    const buffer = new RemoteBuffer(vimPath, vimSettings.loghttp)

    const bfast = new BFast(buffer)
    const doc = await VimDocument.createFromBfast(bfast, vimSettings.noStrings)

    const [header, instanceToElement, elementIds] = await Promise.all([
      vimSettings.noHeader ? undefined : VimBuilder.requestHeader(bfast),
      vimSettings.noMap ? undefined : doc.node.getAllElementIndex(),
      vimSettings.noMap ? undefined : doc.element.getAllId()
    ])
    */

    const index = await G3dMeshIndex.createFromPath(`${folder}_index.g3d`)

    const opaqueMesh = InsertableMesh.fromIndex(
      index,
      [...new Array(index.getMeshCount()).keys()],
      'opaque',
      false
    )
    console.log(opaqueMesh)

    opaqueMesh.mesh.applyMatrix4(vimSettings.matrix)
    opaqueMesh.mesh.frustumCulled = false
    this.renderer.add(opaqueMesh.mesh)

    const transparentMesh = InsertableMesh.fromIndex(
      index,
      [...new Array(index.getMeshCount()).keys()],
      'transparent',
      true
    )

    transparentMesh.mesh.applyMatrix4(vimSettings.matrix)
    transparentMesh.mesh.frustumCulled = false
    this.renderer.add(transparentMesh.mesh)

    const requester = new Requester(false)

    async function addOne (url: string, index: number) {
      const buffer = await requester.http(url)
      const mesh = await G3dMesh.createFromBuffer(buffer)
      transparentMesh.insertAllMesh2(mesh, index)
      opaqueMesh.insertAllMesh2(mesh, index)
    }

    const update = () => {
      transparentMesh.update()
      opaqueMesh.update()

      /*
      this.camera
        .lerp(0)
        .frame(
          opaqueMesh.geometry.boundingBox
            .clone()
            .applyMatrix4(transparentMesh.mesh.matrix)
        )
      */
      this.renderer.needsUpdate = true
    }

    let done = false
    Promise.all(
      transparentMesh.meshes.map((m, i) => addOne(`${folder}_mesh_${m}.g3d`, i))
    ).finally(() => (done = true))

    while (!done) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      update()
    }
    update()
  }

  /**
   * Disposes all resources.
   */
  dispose () {
    cancelAnimationFrame(this._updateId)
    this.selection.dispose()
    this._environment.dispose()
    this.selection.clear()
    this._gizmoOrbit.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this.materials.dispose()
    this.gizmoRectangle.dispose()
  }
}
