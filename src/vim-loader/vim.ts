/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { VimDocument, G3d, VimHeader, FilterMode } from 'vim-format'
import { Scene } from './scene'
import { VimSettings } from './vimSettings'
import { Object } from './object'
import {
  ElementMapping,
  ElementMapping2,
  ElementNoMapping
} from './elementMapping'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { G3dSubset } from './progressive/g3dSubset'
import { SubsetBuilder } from './progressive/subsetBuilder'
import { LoadPartialSettings } from './progressive/subsetRequest'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  source: string | undefined
  scene: Scene
  readonly builder: SubsetBuilder

  readonly header: VimHeader
  readonly bim: VimDocument
  readonly g3d: G3d | undefined
  readonly settings: VimSettings

  readonly map: ElementMapping | ElementNoMapping | ElementMapping2

  private readonly _elementToObject: Map<number, Object> = new Map<
    number,
    Object
  >()

  private readonly _builder: SubsetBuilder
  private readonly _loadedInstances = new Set<number>()

  /** Dispatched whenever a subset begins or finishes loading. */
  get onLoadingUpdate () {
    return this._builder.onUpdate
  }

  /** True if there are subsets being loaded. */
  get isLoading () {
    return this._builder.isLoading
  }

  private _onDispose = new SignalDispatcher()
  get onDispose () {
    return this._onDispose as ISignal
  }

  constructor (
    header: VimHeader | undefined,
    document: VimDocument,
    g3d: G3d | undefined,
    scene: Scene,
    settings: VimSettings,
    map: ElementMapping | ElementNoMapping | ElementMapping2,
    builder: SubsetBuilder
  ) {
    this.header = header
    this.bim = document
    this.g3d = g3d
    scene.vim = this
    this.scene = scene
    this.settings = settings

    this.map = map ?? new ElementNoMapping()
    this._builder = builder
  }

  /**
   * Returns vim matrix
   */
  getMatrix () {
    return this.settings.matrix
  }

  /**
   * Returns vim object from given instance
   * @param instance g3d instance index
   */
  getObjectFromInstance (instance: number) {
    const element = this.map?.getElementFromInstance(instance)
    if (element === undefined) return
    return this.getObjectFromElement(element)
  }

  /**
   * Returns an array of vim objects matching given vim element Id
   * @param id vim element Id
   */
  getObjectsFromElementId (id: number) {
    const elements = this.map.getElementsFromElementId(id)
    return elements
      ?.map((e) => this.getObjectFromElement(e))
      .filter((o): o is Object => o !== undefined)
  }

  /**
   * Returns vim object from given vim element index.
   * @param element vim element index
   */
  getObjectFromElement (element: number): Object | undefined {
    if (!this.map.hasElement(element)) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.map.getInstancesFromElement(element)
    const meshes = this.scene.getMeshesFromInstances(instances)

    const result = new Object(this, element, instances, meshes)
    this._elementToObject.set(element, result)
    return result
  }

  /**
   * Returns an array with all vim objects strictly contained in given box.
   */
  getObjectsInBox (box: THREE.Box3) {
    const result: Object[] = []

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
   * Enumerates all objects of the vim.
   */
  getObjects () {
    const result = new Array<Object>()
    for (const e of this.map.getElements()) {
      const obj = this.getObjectFromElement(e)
      result.push(obj)
    }
    return result
  }

  /**
   * Enumerates all objects of the vim.
   */
  getObjectsInSubset (subset: G3dSubset) {
    const set = new Set<Object>()
    const result = new Array<Object>()
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

  /** Returns all instances as a subset. */
  getFullSet () {
    return this._builder.getFullSet()
  }

  /** Starts loading process to load all instances. */
  async loadAll (settings?: LoadPartialSettings) {
    return this.loadSubset(this.getFullSet(), settings)
  }

  /** Starts loading process to load all instances. */
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

  /** Starts loading process to for a filtered subset. */
  async loadFilter (
    filterMode: FilterMode,
    filter: number[],
    settings?: LoadPartialSettings
  ) {
    const subset = this.getFullSet().filter(filterMode, filter)
    await this.loadSubset(subset, settings)
  }

  /**
   * Removes current geometry from renderer.
   */
  clear () {
    this._elementToObject.clear()
    this.scene.clear()
    this._builder.clear()
    this._loadedInstances.clear()
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this._builder.dispose()
    this._onDispose.dispatch()
    this._onDispose.clear()
    this.scene.dispose()
  }
}
