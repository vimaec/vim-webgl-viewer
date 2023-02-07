/**
 * @module vim-loader
 */

export class ElementMapping {
  private _instanceToElement: number[]
  private _elementToInstances: Map<number, number[]>
  private _elementIds: number[]
  private _elementIdToElements: Map<number, number[]>

  constructor (
    instanceToElement: number[],
    elementIds: number[]) {
    this._instanceToElement = instanceToElement
    this._elementToInstances = ElementMapping.invert(instanceToElement!)
    this._elementIds = elementIds
    this._elementIdToElements = ElementMapping.invert(elementIds!)
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
    return this._instanceToElement[instance]
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
  private static invert (data: number[]) {
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
}