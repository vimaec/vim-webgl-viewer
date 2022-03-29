import { BFastRemote } from './bfastRemote'
import { G3d } from './g3d'

export class DocumentAsync {
  g3d: G3d
  entitie: BFastRemote
  private _strings: string[]
  private _instanceToElement: number[]
  private _elementToInstance: Map<number, number[]>
  _elementIdToElement: Map<number, number[]>

  private constructor (
    g3d: G3d,
    entities: BFastRemote,
    strings: string[],
    instanceToElement: number[],
    elementToInstance: Map<number, number[]>,
    elementIdToElement: Map<number, number[]>
  ) {
    this.g3d = g3d
    this.entitie = entities
    this._strings = strings
    this._instanceToElement = instanceToElement
    this._elementToInstance = elementToInstance
    this._elementIdToElement = elementIdToElement
  }

  static async createFromBfast (bfast: BFastRemote) {
    let g3d: G3d
    let entitie: BFastRemote
    let strings: string[]

    await Promise.all([
      DocumentAsync.requestG3d(bfast).then((g) => (g3d = g)),
      DocumentAsync.requestStrings(bfast).then((strs) => (strings = strs)),
      bfast.getBfast('entities').then((ets) => (entitie = ets))
    ])
    const instanceToElement = await DocumentAsync.requestInstanceToElement(
      entitie
    )
    const elementToInstance = DocumentAsync.invert(instanceToElement)
    const elementIdToElement = await DocumentAsync.requestElementIdToElement(
      entitie
    )
    return new DocumentAsync(
      g3d,
      entitie,
      strings,
      instanceToElement,
      elementToInstance,
      elementIdToElement
    )
  }

  private static async requestG3d (bfast: BFastRemote) {
    const geometry = await bfast.getBfast('geometry')
    const g3d = await G3d.createFromBfastAsync(geometry)
    return g3d
  }

  private static async requestStrings (bfast: BFastRemote) {
    const buffer = await bfast.getBuffer('strings')
    const strings = new TextDecoder('utf-8').decode(buffer).split('\0')
    return strings
  }

  private static async requestInstanceToElement (entities: BFastRemote) {
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

  private static async requestElementIdToElement (entities: BFastRemote) {
    const elements = await entities.getBfast('Vim.Element')
    const ids =
      (await elements.getArray('int:Id')) ??
      (await elements.getArray('numeric:Id'))
    const result = DocumentAsync.invert(ids)
    return result
  }

  * getAllElements () {
    for (let i = 0; i < this._elementToInstance.size; i++) {
      yield i
    }
  }

  getInstanceFromElement (element: number) {
    return this._elementToInstance.get(element)
  }

  async getElement (element: number) {
    return this.getEntity('Vim.Element', element)
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or -1 if not found
   */
  getElementFromInstance (instance: number): number {
    return this._instanceToElement[instance]
  }

  getInstanceCount () {
    return this._instanceToElement.length
  }

  async getEntity (name: string, index: number) {
    const elements = await this.entitie.getBfast(name)
    const row = await elements.getRow(index)
    this.resolveStrings(row)
    return row
  }

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
