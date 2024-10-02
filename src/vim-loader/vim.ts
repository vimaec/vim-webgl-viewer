/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { VimDocument, G3d, VimHeader, FilterMode } from 'vim-format'
import { Scene } from './scene'
import { VimSettings } from './vimSettings'
import { Object3D } from './object3D'
import {
  ElementMapping,
  ElementMapping2,
  ElementNoMapping
} from './elementMapping'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { G3dSubset } from './progressive/g3dSubset'
import { SubsetBuilder } from './progressive/subsetBuilder'
import { LoadPartialSettings } from './progressive/subsetRequest'

type VimFormat = 'vim' | 'vimx'

/**
 * Represents a container for the built three.js meshes and the vim data from which they were constructed.
 * Facilitates high-level scene manipulation by providing access to objects.
 */
export class Vim {
  /**
   * Indicates whether the vim was opened from a vim or vimx file.
   */
  readonly format: VimFormat

  /**
   * Indicates the url this vim came from if applicable.
   */
  readonly source: string | undefined

  /**
   * The header for this vim.
   */
  readonly header: VimHeader | undefined

  /**
   * The interface to access bim data related to this vim if available.
   */
  readonly bim: VimDocument | undefined

  /**
   * The raw g3d geometry scene definition.
   */
  readonly g3d: G3d | undefined

  /**
   * The settings used when this vim was opened.
   */
  readonly settings: VimSettings

  /**
   * Mostly Internal - The scene in which the vim geometry is added.
   */
  readonly scene: Scene

  /**
   * The mapping from Bim to Geometry for this vim.
   */
  readonly map: ElementMapping | ElementNoMapping | ElementMapping2

  private readonly _builder: SubsetBuilder
  private readonly _loadedInstances = new Set<number>()
  private readonly _elementToObject = new Map<number, Object3D>()

  /**
   * Getter for accessing the event dispatched whenever a subset begins or finishes loading.
   * @returns {ISignal} The event dispatcher for loading updates.
   */
  get onLoadingUpdate () {
    return this._builder.onUpdate
  }

  /**
   * Indicates whether there are subsets currently being loaded.
   * @returns {boolean} True if subsets are being loaded; otherwise, false.
   */
  get isLoading () {
    return this._builder.isLoading
  }

  /**
   * Getter for accessing the signal dispatched when the object is disposed.
   * @returns {ISignal} The signal for disposal events.
   */
  get onDispose () {
    return this._onDispose as ISignal
  }

  private _onDispose = new SignalDispatcher()

  /**
 * Constructs a new instance of a Vim object with the provided parameters.
 * @param {VimHeader | undefined} header - The Vim header, if available.
 * @param {VimDocument} document - The Vim document.
 * @param {G3d | undefined} g3d - The G3d object, if available.
 * @param {Scene} scene - The scene containing the vim's geometry.
 * @param {VimSettings} settings - The settings used to open this vim.
 * @param {ElementMapping | ElementNoMapping | ElementMapping2} map - The element mapping.
 * @param {SubsetBuilder} builder - The subset builder for constructing subsets of the Vim object.
 * @param {string} source - The source of the Vim object.
 * @param {VimFormat} format - The format of the Vim object.
 * @param {boolean} isLegacy - Indicates whether the Vim object uses a legacy loading pipeline.
 */
  constructor (
    header: VimHeader | undefined,
    document: VimDocument,
    g3d: G3d | undefined,
    scene: Scene,
    settings: VimSettings,
    map: ElementMapping | ElementNoMapping | ElementMapping2,
    builder: SubsetBuilder,
    source: string,
    format: VimFormat) {
    this.header = header
    this.bim = document
    this.g3d = g3d
    scene.vim = this
    this.scene = scene
    this.settings = settings

    this.map = map ?? new ElementNoMapping()
    this._builder = builder
    this.source = source
    this.format = format
  }

  /**
   * Retrieves the matrix representation of the Vim object's position, rotation, and scale.
   * @returns {THREE.Matrix4} The matrix representing the Vim object's transformation.
   */
  getMatrix () {
    return this.settings.matrix
  }

  /**
   * Retrieves the object associated with the specified instance number.
   * @param {number} instance - The instance number of the object.
   * @returns {THREE.Object3D | undefined} The object corresponding to the instance, or undefined if not found.
   */
  getObjectFromInstance (instance: number) {
    const element = this.map.getElementFromInstance(instance)
    if (element === undefined) return
    return this.getObjectFromElement(element)
  }

  /**
   * Retrieves the objects associated with the specified element ID.
   * @param {number} id - The element ID to retrieve objects for.
   * @returns {THREE.Object3D[]} An array of objects corresponding to the element ID, or an empty array if none are found.
   */
  getObjectsFromElementId (id: number) {
    const elements = this.map.getElementsFromElementId(id)
    return elements
      ?.map((e) => this.getObjectFromElement(e))
      .filter((o): o is Object3D => o !== undefined) ?? []
  }

  /**
   * Retrieves the Vim object associated with the given Vim element index.
   * @param {number} element - The index of the Vim element.
   * @returns {Object3D | undefined} The Vim object corresponding to the element index, or undefined if not found.
   */
  getObjectFromElement (element: number): Object3D | undefined {
    if (!this.map.hasElement(element)) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.map.getInstancesFromElement(element)
    const meshes = this.scene.getMeshesFromInstances(instances)

    const result = new Object3D(this, element, instances, meshes)
    this._elementToObject.set(element, result)
    return result
  }

  /**
   * Retrieves an array containing all Vim objects strictly contained within the specified bounding box.
   * @param {THREE.Box3} box - The bounding box to search within.
   * @returns {Object3D[]} An array of Vim objects strictly contained within the bounding box.
   */
  getObjectsInBox (box: THREE.Box3) {
    const result: Object3D[] = []

    for (const obj of this.getObjects()) {
      const b = obj.getBoundingBox()
      if (!b) continue
      if (box.containsBox(b)) {
        result.push(obj)
      }
    }
    return result
  }

  /**
   * Retrieves an array of all objects within the Vim.
   * @returns {Object3D[]} An array containing all objects within the Vim.
   */
  getObjects () {
    const result : Object3D[] = []
    for (const e of this.map.getElements()) {
      const obj = this.getObjectFromElement(e)
      result.push(obj)
    }
    return result
  }

  /**
   * Retrieves an array containing all objects within the specified subset.
   * @param {G3dSubset} subset - The subset to retrieve objects from.
   * @returns {Object3D[]} An array of objects within the specified subset.
   */
  getObjectsInSubset (subset: G3dSubset) {
    const set = new Set<Object3D>()
    const result: Object3D[] = []
    const count = subset.getInstanceCount()
    for (let i = 0; i < count; i++) {
      const instance = subset.getVimInstance(i)
      const obj = this.getObjectFromInstance(instance)
      if (!set.has(obj)) {
        result.push(obj)
        set.add(obj)
      }
    }
    return result
  }

  /**
   * Retrieves all instances as a subset.
   * @returns {G3dSubset} A subset containing all instances.
   */
  getFullSet (): G3dSubset {
    return this._builder.getFullSet()
  }

  /**
   * Asynchronously loads all geometry according to the provided settings.
   * @param {LoadPartialSettings} [settings] - Optional settings for the loading process.
   */
  async loadAll (settings?: LoadPartialSettings) {
    return this.loadSubset(this.getFullSet(), settings)
  }

  /**
   * Asynchronously loads geometry for the specified subset according to the provided settings.
   * @param {G3dSubset} subset - The subset to load resources for.
   * @param {LoadPartialSettings} [settings] - Optional settings for the loading process.
   */
  async loadSubset (subset: G3dSubset, settings?: LoadPartialSettings) {
    subset = subset.except('instance', this._loadedInstances)
    const count = subset.getInstanceCount()
    for (let i = 0; i < count; i++) {
      this._loadedInstances.add(subset.getVimInstance(i))
    }

    // Add box to rendering.
    const box = subset.getBoundingBox()
    this.scene.updateBox(box)

    if (subset.getInstanceCount() === 0) {
      console.log('Empty subset. Ignoring')
      return
    }
    // Launch loading
    await this._builder.loadSubset(subset, settings)
  }

  /**
   * Asynchronously loads geometry based on a specified filter mode and criteria.
   * @param {FilterMode} filterMode - The mode of filtering to apply.
   * @param {number[]} filter - The filter criteria.
   * @param {LoadPartialSettings} [settings] - Optional settings for the loading process.
   */
  async loadFilter (
    filterMode: FilterMode,
    filter: number[],
    settings?: LoadPartialSettings
  ) {
    const subset = this.getFullSet().filter(filterMode, filter)
    await this.loadSubset(subset, settings)
  }

  /**
   * Removes the current geometry from the renderer.
   */
  clear () {
    this._elementToObject.clear()
    this._loadedInstances.clear()
    this.scene.clear()
    // Clearing this one last because it dispatches the signal
    this._builder.clear()
  }

  /**
   * Cleans up and releases resources associated with the vim.
   */
  dispose () {
    this._builder.dispose()
    this._onDispose.dispatch()
    this._onDispose.clear()
    this.scene.dispose()
  }
}
