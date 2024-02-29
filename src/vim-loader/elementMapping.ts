/**
 * @module vim-loader
 */

import { G3d, G3dScene, VimDocument } from 'vim-format'

export class ElementNoMapping {
  getElementsFromElementId (id: number) {
    return undefined
  }

  hasElement (element: number) {
    return false
  }

  getElements () {
    return []
  }

  getInstancesFromElement (element: number): number[] | undefined {
    return undefined
  }

  getElementFromInstance (instance: number) {
    return undefined
  }

  getElementId (element: number) : bigint | undefined {
    return undefined
  }
}

export class ElementMapping {
  private _instanceToElement: Map<number, number>
  private _instanceMeshes: Int32Array
  private _elementToInstances: Map<number, number[]>
  private _elementIds: BigInt64Array
  private _elementIdToElements: Map<BigInt, number[]>

  constructor (
    instances: number[],
    instanceToElement: number[],
    elementIds: BigInt64Array,
    instanceMeshes?: Int32Array
  ) {
    this._instanceToElement = new Map<number, number>()
    instances.forEach((i) =>
      this._instanceToElement.set(i, instanceToElement[i])
    )
    this._elementToInstances = ElementMapping.invertMap(
      this._instanceToElement!
    )
    this._elementIds = elementIds
    this._elementIdToElements = ElementMapping.invertArray(elementIds!)
    this._instanceMeshes = instanceMeshes
  }

  static async fromG3d (g3d: G3d, bim: VimDocument) {
    const instanceToElement = await bim.node.getAllElementIndex()
    const elementIds = await bim.element.getAllId()

    return new ElementMapping(
      Array.from(g3d.instanceNodes),
      instanceToElement!,
      elementIds!,
      g3d.instanceMeshes
    )
  }

  /**
   * Returns element indices associated with element id
   * @param id element id
   */
  getElementsFromElementId (id: number | bigint) {
    return this._elementIdToElements.get(BigInt(id))
  }

  /**
   * Returns true if element exists in the vim.
   */
  hasElement (element: number) {
    return element >= 0 && element < this._elementIds.length
  }

  hasMesh (element: number) {
    if (!this._instanceMeshes) return true
    const instances = this._elementToInstances.get(element)
    for (const i of instances) {
      if (this._instanceMeshes[i] >= 0) {
        return true
      }
    }
    return false
  }

  /**
   * Returns all element indices of the vim
   */
  getElements () {
    return this._elementIds.keys()
  }

  /**
   * Returns instance indices associated with vim element index
   * @param element vim element index
   */
  getInstancesFromElement (element: number): number[] | undefined {
    if (!this.hasElement(element)) return
    return this._elementToInstances.get(element) ?? []
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or undefined if not found
   */
  getElementFromInstance (instance: number) {
    return this._instanceToElement.get(instance)
  }

/**
 * Retrieves the element ID corresponding to the provided element index.
 * @param {number} element The element index.
 * @returns {bigint} The element ID associated with the given index.
 */
  getElementId (element: number) {
    return this._elementIds[element]
  }

  /**
   * Returns a map where data[i] -> i
   */
  private static invertArray (data: BigInt64Array) {
    const result = new Map<BigInt, number[]>()
    for (let i = 0; i < data.length; i++) {
      const value = data[i]
      const list = result.get(value)
      if (list) {
        list.push(i)
      } else {
        result.set(value, [i])
      }
    }
    return result
  }

  /**
   * Returns a map where data[i] -> i
   */
  private static invertMap (data: Map<number, number>) {
    const result = new Map<number, number[]>()
    for (const [key, value] of data.entries()) {
      const list = result.get(value)
      if (list) {
        list.push(key)
      } else {
        result.set(value, [key])
      }
    }
    return result
  }
}

export class ElementMapping2 {
  private _instanceToElement: Map<number, number>
  private _elementToInstances: Map<number, number[]>
  private _instanceToElementId: Map<number, bigint>

  constructor (scene: G3dScene) {
    this._instanceToElement = new Map<number, number>()
    this._instanceToElementId = new Map<number, bigint>()

    for (let i = 0; i < scene.instanceNodes.length; i++) {
      this._instanceToElement.set(
        scene.instanceNodes[i],
        scene.instanceGroups[i]
      )
      this._instanceToElementId.set(
        scene.instanceNodes[i],
        scene.instanceTags[i]
      )
    }
    this._elementToInstances = ElementMapping2.invertMap(
      this._instanceToElement
    )
  }

  /**
   * Retrieves element indices associated with the given element ID.
   * @param {number | bigint} id The element ID.
   * @returns {number[] | undefined} An array of element indices associated with the element ID,
   * or undefined if no elements are associated with the ID.
   */
  getElementsFromElementId (id: number | bigint) {
    return undefined
  }

  /**
   * Checks if the element exists in the vim.
   * @param {number} element The element to check for existence.
   * @returns {boolean} True if the element exists in the vim, otherwise false.
   */
  hasElement (element: number) {
    return this._elementToInstances.has(element)
  }

  /**
   * Checks if the element has a mesh in the vim.
   * @param {number} element The element to check for mesh existence.
   * @returns {boolean} True if the element has a mesh in the vim, otherwise false.
   */
  hasMesh (element: number) {
    // All elements have meshes in vimx
    return this.hasElement(element)
  }

  /**
   * Retrieves all element indices of the vim.
   * @returns {IterableIterator<number>} An iterator of all element indices in the vim.
   */
  getElements () {
    return this._elementToInstances.keys()
  }

  /**
   * Retrieves instance indices associated with the specified vim element index.
   * @param {number} element The vim element index.
   * @returns {number[] | undefined} An array of instance indices associated with the vim element index,
   * or undefined if the element does not exist in the vim.
   */
  getInstancesFromElement (element: number): number[] | undefined {
    if (!this.hasElement(element)) return
    return this._elementToInstances.get(element) ?? []
  }

  /**
   * Retrieves the element index associated with the g3d instance index.
   * @param {number} instance The g3d instance index.
   * @returns {number | undefined} The element index associated with the instance, or undefined if not found.
   */
  getElementFromInstance (instance: number) {
    return this._instanceToElement.get(instance)
  }

  /**
   * Retrieves the element ID associated with the specified element index.
   * @param {number} element The element index.
   * @returns {bigint | undefined} The element ID associated with the element index, or undefined if not found.
   */
  getElementId (element: number) {
    const instance = this.getInstancesFromElement(element)?.[0]
    return this._instanceToElementId.get(instance)
  }

  /**
   * Returns a map where data[i] -> i
   */
  private static invertMap<T1, T2> (data: Map<T1, T2>) {
    const result = new Map<T2, T1[]>()
    for (const [key, value] of data.entries()) {
      const list = result.get(value)
      if (list) {
        list.push(key)
      } else {
        result.set(value, [key])
      }
    }
    return result
  }
}
