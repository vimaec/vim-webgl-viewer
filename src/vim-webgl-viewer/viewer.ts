/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { Settings, getSettings, PartialSettings } from './viewerSettings'
import { Camera, ICamera } from './camera/camera'
import { Input } from './inputs/input'
import { Selection } from './selection'
import { Environment, IEnvironment } from './environment'
import { Raycaster } from './raycaster'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { Gizmos } from './gizmos/gizmos'


// loader
import { Renderer } from './rendering/renderer'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { ViewerMaterials } from '../vim-loader/materials/viewerMaterials'
import { Vim } from '../vim-loader/vim'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  /**
   * The settings configuration used by the viewer.
   */
  readonly settings: Settings

  /**
   * The renderer used by the viewer for rendering scenes.
   */
  readonly renderer: Renderer

  /**
   * The interface for managing the HTML canvas viewport.
   */

  readonly viewport: Viewport

  /**
   * The interface for managing viewer selection.
   */
  readonly selection: Selection

  /**
   * The interface for manipulating default viewer inputs.
   */
  readonly inputs: Input

  /**
   * The interface for performing raycasting into the scene to find objects.
   */
  readonly raycaster: Raycaster

  /**
   * The materials used by the viewer to render the vims.
   */
  readonly materials: ViewerMaterials

  /**
   * The interface for manipulating the viewer's camera.
   */
  get camera () {
    return this._camera as ICamera
  }

  /**
   * The interface for manipulating THREE elements that are not directly related to Vim objects.
   */
  get environment () {
    return this._environment as IEnvironment
  }

  /**
   * The collection of gizmos available for visualization and interaction within the viewer.
   */
  gizmos: Gizmos

  /**
   * A signal that is dispatched when a new Vim object is loaded or unloaded.
   */
  get onVimLoaded () : ISignal{
    return this._onVimLoaded.asEvent()
  }

  private _camera: Camera
  private _environment: Environment
  private _clock = new THREE.Clock()

  // State
  private _vims = new Set<Vim>()
  private _onVimLoaded = new SignalDispatcher()
  private _updateId: number

  constructor (options?: PartialSettings) {
    this.settings = getSettings(options)

    this.materials = ViewerMaterials.getInstance()

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

    this.inputs = new Input(this)
    this.gizmos = new Gizmos(this, this._camera)
    this.materials.applySettings(this.settings)

    // Ground plane and lights 
    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))
    this.renderer.onBoxUpdated.subscribe((_) => {
      const box = this.renderer.getBoundingBox()
      this._environment.adaptToContent(box)
    })

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
   * Retrieves an array containing all currently loaded Vim objects.
   * @returns {Vim[]} An array of all Vim objects currently loaded in the viewer.
   */
  get vims () {
    return [...this._vims]
  }

  /**
   * The number of Vim objects currently loaded in the viewer.
   */
  get vimCount () {
    return this._vims.size
  }


  /**
   * Adds a Vim object to the renderer, triggering the appropriate actions and dispatching events upon successful addition.
   * @param {Vim} vim - The Vim object to add to the renderer.
   * @throws {Error} If the Vim object is already added or if loading the Vim would exceed maximum geometry memory.
   */
  add (vim: Vim) {
    if (this._vims.has(vim)) {
      throw new Error('Vim cannot be added again, unless removed first.')
    }

    const success = this.renderer.add(vim._scene)
    if (!success) {
      throw new Error('Could not load vim. Max geometry memory reached.')
    }

    this._vims.add(vim)
    this._onVimLoaded.dispatch()
  }

  /**
   * Unloads the given Vim object from the viewer, updating the scene and triggering necessary actions.
   * @param {Vim} vim - The Vim object to remove from the viewer.
   * @throws {Error} If attempting to remove a Vim object that is not present in the viewer.
   */
  remove (vim: Vim) {
    if (!this._vims.has(vim)) {
      throw new Error('Cannot remove missing vim from viewer.')
    }
    this._vims.delete(vim)
    this.renderer.remove(vim._scene)
    if (this.selection.vim === vim) {
      this.selection.clear()
    }
    this._onVimLoaded.dispatch()
  }

  /**
   * Removes all Vim objects from the viewer, clearing the scene.
   */
  clear () {
    this.vims.forEach((v) => this.remove(v))
  }

  /**
   * Cleans up and releases resources associated with the viewer.
   */
  dispose () {
    cancelAnimationFrame(this._updateId)
    this.selection.dispose()
    this._environment.dispose()
    this.selection.clear()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this.materials.dispose()
    this.gizmos.dispose()
  }
}
