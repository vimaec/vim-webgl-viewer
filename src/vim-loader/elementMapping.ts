/**
 * @module vim-loader
 */

export class ElementMapping {
  private _instanceToElement: Map<number, number>
  private _elementToInstances: Map<number, number[]>
  private _elementIds: number[]
  private _elementIdToElements: Map<number, number[]>

  constructor (
    instances: number[],
    instanceToElement: number[],
    elementIds: number[]
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
  }

  /**
   * Returns element indices associated with element id
   * @param id element id
   */
  getElementsFromElementId (id: number) {
    return this._elementIdToElements.get(id)
  }

  /**
   * Returns true if element exists in the vim.
   */
  hasElement (element: number) {
    return element >= 0 && element < this._elementIds.length
  }

  /**
   * Returns all element indices of the vim
   */
  getAllElements () {
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
   * Returns element id from element index
   * @param element element index
   */
  getElementId (element: number) {
    return this._elementIds[element]
  }

  /**
   * Returns a map where data[i] -> i
   */
  private static invertArray (data: number[]) {
    const result = new Map<number, number[]>()
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
