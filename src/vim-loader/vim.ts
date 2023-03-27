/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { VimDocument, G3d, VimHeader } from 'vim-format'
import { Scene } from './scene'
import { VimSettings } from './vimSettings'
import { Object } from './object'
import { ElementMapping, ElementNoMapping } from './elementMapping'
import { Submesh } from './mesh'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  header: VimHeader
  source: string | undefined
  readonly document: VimDocument
  readonly g3d: G3d | undefined
  settings: VimSettings

  scene: Scene
  private _elementToObject: Map<number, Object> = new Map<number, Object>()
  private _map: ElementMapping | ElementNoMapping

  constructor (
    header: VimHeader | undefined,
    document: VimDocument,
    g3d: G3d | undefined,
    scene: Scene,
    settings: VimSettings,
    map: ElementMapping | ElementNoMapping
  ) {
    this.header = header
    this.document = document
    this.g3d = g3d
    this.scene = scene
    this.scene.vim = this
    this.settings = settings
    this.scene.applyMatrix4(this.settings.matrix)

    this._map = map ?? new ElementNoMapping()
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this.scene.dispose()
  }

  /**
   * Applies new settings to the vim
   */
  applySettings (settings: VimSettings) {
    this.settings = settings
    this.scene.applyMatrix4(this.settings.matrix)
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
    const element = this._map?.getElementFromInstance(instance)
    if (!element) return
    return this.getObjectFromElement(element)
  }

  /**
   * Returns an array of vim objects matching given vim element Id
   * @param id vim element Id
   */
  getObjectsFromElementId (id: number) {
    const elements = this._map.getElementsFromElementId(id)
    return elements
      ?.map((e) => this.getObjectFromElement(e))
      .filter((o): o is Object => o !== undefined)
  }

  /**
   * Returns vim object from given vim element index
   * @param element vim element index
   */
  getObjectFromElement (element: number): Object | undefined {
    if (!this.hasElement(element)) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.getInstancesFromElement(element)
    const meshes = this.getMeshesFromInstances(instances)

    const result = new Object(this, element, instances, meshes)
    this._elementToObject.set(element, result)
    return result
  }

  /**
   * Returns an array with all vim objects strictly contained in given box.
   */
  getObjectsInBox (box: THREE.Box3) {
    const result: Object[] = []

    for (const obj of this.getAllObjects()) {
      const b = obj.getBoundingBox()
      if (!b) continue
      if (box.containsBox(b)) {
        result.push(obj)
      }
    }
    return result
  }

  /**
   * Enumerates all objects of the vim
   */
  * getAllObjects () {
    for (const e of this.getAllElements()) {
      const obj = this.getObjectFromElement(e)
      if (obj) yield obj
    }
  }

  private getMeshesFromElement (element: number) {
    const instances = this.getInstancesFromElement(element)
    if (!instances) return
    return this.getMeshesFromInstances(instances)
  }

  /**
   * Returns true if element exists in the vim.
   */
  hasElement (element: number) {
    return this._map.hasElement(element)
  }

  /**
   * Returns all element indices of the vim
   */
  getAllElements () {
    return this._map.getAllElements()
  }

  /**
   * Returns instance indices associated with vim element index
   * @param element vim element index
   */
  getInstancesFromElement (element: number): number[] | undefined {
    return this._map.getInstancesFromElement(element)
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or undefined if not found
   */
  getElementFromInstance (instance: number) {
    return this._map.getElementFromInstance(instance)
  }

  /**
   * Returns element id from element index
   * @param element element index
   */
  getElementId (element: number) {
    return this._map.getElementId(element)
  }

  private getMeshesFromInstances (instances: number[] | undefined) {
    if (!instances?.length) return

    const meshes: Submesh[] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const submeshes = this.scene.getMeshFromInstance(instance)
      submeshes?.forEach((s) => meshes.push(s))
    }
    if (meshes.length === 0) return
    return meshes
  }
}
