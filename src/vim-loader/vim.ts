/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { VimDocument, G3d, VimHeader } from 'vim-format'
import { Scene } from './scene'
import { VimSettings } from './vimSettings'
import { Object } from './object'
import {
  ElementMapping,
  ElementMapping2,
  ElementNoMapping
} from './elementMapping'
import { Submesh } from './mesh'
import { ISignal, SignalDispatcher } from 'ste-signals'
import { DynamicScene } from './progressive/dynamicScene'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  source: string | undefined

  readonly header: VimHeader
  readonly bim: VimDocument
  readonly g3d: G3d | undefined
  readonly settings: VimSettings
  scene: Scene
  readonly map: ElementMapping | ElementNoMapping | ElementMapping2

  private _elementToObject: Map<number, Object> = new Map<number, Object>()

  private _onDispose = new SignalDispatcher()
  get onDispose () {
    return this._onDispose as ISignal
  }

  constructor (
    header: VimHeader | undefined,
    document: VimDocument,
    g3d: G3d | undefined,
    scene: Scene | DynamicScene,
    settings: VimSettings,
    map: ElementMapping | ElementNoMapping | ElementMapping2
  ) {
    this.header = header
    this.bim = document
    this.g3d = g3d
    scene.vim = this
    this.scene = scene instanceof DynamicScene ? scene.scene : scene
    this.settings = settings
    this.scene.applyMatrix4(this.settings.matrix)

    this.map = map ?? new ElementNoMapping()
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this._onDispose.dispatch()
    this._onDispose.clear()
    this.scene.dispose()
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
    if (!element) return
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
   * Returns vim object from given vim element index
   * @param element vim element index
   */
  getObjectFromElement (element: number): Object | undefined {
    if (!this.map.hasElement(element)) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.map.getInstancesFromElement(element)
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
    for (const e of this.map.getAllElements()) {
      const obj = this.getObjectFromElement(e)
      if (obj) yield obj
    }
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
