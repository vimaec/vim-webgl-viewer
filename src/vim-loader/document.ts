import { BFast } from './bfast'
import { G3d } from './g3d'

export class Document {
  g3d: G3d
  private _entitie: BFast
  private _strings: string[]
  private _instanceToElement: number[]
  private _elementToInstance: Map<number, number[]>
  private _elementIdToElement: Map<number, number[]>

  private constructor (
    g3d: G3d,
    entities: BFast,
    strings: string[],
    instanceToElement: number[],
    elementToInstances: Map<number, number[]>,
    elementIdToElements: Map<number, number[]>
  ) {
    this.g3d = g3d
    this._entitie = entities
    this._strings = strings
    this._instanceToElement = instanceToElement
    this._elementToInstance = elementToInstances
    this._elementIdToElement = elementIdToElements
  }

  /**
   * Creates document by fetching all required data from bfast.
   */
  static async createFromBfast (bfast: BFast) {
    let g3d: G3d
    let entitie: BFast
    let strings: string[]

    let instanceToElement: number[]
    let elementIdToElement: Map<number, number[]>

    await Promise.all([
      Document.requestG3d(bfast).then((g) => (g3d = g)),
      Document.requestStrings(bfast).then((strs) => (strings = strs)),
      bfast
        .getBfast('entities')
        .then((ets) => (entitie = ets))
        .then((ets) =>
          Promise.all([
            Document.requestInstanceToElement(ets).then(
              (v) => (instanceToElement = v)
            ),
            Document.requestElementIdToElement(ets).then(
              (v) => (elementIdToElement = v)
            )
          ])
        )
    ])

    const elementToInstance = Document.invert(instanceToElement)
    return new Document(
      g3d,
      entitie,
      strings,
      instanceToElement,
      elementToInstance,
      elementIdToElement
    )
  }

  private static async requestG3d (bfast: BFast) {
    const geometry = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfast(geometry)
    return g3d
  }

  private static async requestStrings (bfast: BFast) {
    const buffer = await bfast.getBuffer('strings')
    const strings = new TextDecoder('utf-8').decode(buffer).split('\0')
    return strings
  }

  private static async requestInstanceToElement (entities: BFast) {
    const nodes = await entities.getBfast('Vim.Node')
    const instances = await nodes.getArray('index:Vim.Element:Element')
    return instances
  }

  private static invert (data: number[]) {
    const result = new Map<number, number[]>()
    for (let i = 0; i < data.length; i++) {
      const value = data[i]
      if (!result.has(value)) {
        result.set(value, [i])
      } else {
        result.get(value).push(i)
      }
    }
    return result
  }

  private static async requestElementIdToElement (entities: BFast) {
    const elements = await entities.getBfast('Vim.Element')
    const ids =
      (await elements.getArray('int:Id')) ??
      (await elements.getArray('numeric:Id'))
    const result = Document.invert(ids)
    return result
  }

  /**
   * Returns all element indices of the vim
   */
  * getAllElements () {
    for (let i = 0; i < this._elementToInstance.size; i++) {
      yield i
    }
  }

  /**
   * Returns instance indez associated with vim element index
   * @param element vim element index
   */
  getInstanceFromElement (element: number) {
    return this._elementToInstance.get(element)
  }

  /**
   * Returns all fields of element at given index
   * @param element vim element index
   */
  async getElement (element: number) {
    return this.getEntity('Vim.Element', element)
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or -1 if not found
   */
  getElementFromInstance (instance: number) {
    return this._instanceToElement[instance]
  }

  /**
   * Returns the element index associated with element Id.
   * @param elementId vim element Id
   * @returns element index or -1 if not found
   */
  getElementFromElementId (elementId: number) {
    return this._elementIdToElement[elementId]
  }

  /**
   * Returns all fields at given indices from buffer with given name
   * @param name buffer name
   * @param index row index
   */
  async getEntity (name: string, index: number) {
    const elements = await this._entitie.getBfast(name)
    const row = await elements.getRow(index)
    this.resolveStrings(row)
    return row
  }

  /**
   * Associate all string indices with their related strings.
   */
  private resolveStrings (map: Map<string, number>) {
    const result = <Map<string, string | number>>map
    for (const key of map.keys()) {
      if (key.startsWith('string:')) {
        const v = map.get(key)
        result.set(key, this._strings[v])
      }
    }
  }
}
