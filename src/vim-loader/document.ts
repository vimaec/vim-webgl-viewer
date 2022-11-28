/**
 * @module vim-loader
 */

import { BFast } from './bfast'
import { G3d } from './g3d'

export type ElementInfo = {
  element: number
  id: number | undefined
  name: string | undefined
  categoryName: string | undefined
  familyName: string | undefined
  familyTypeName: string | undefined
  workset: string | undefined
  documentTitle: string | undefined
}

export type BimDocumentInfo = {
  title: string | undefined
  pathName: string | undefined
  isLinked: boolean | undefined
  product: string | undefined
  version: string | undefined
  author: string | undefined
  date: string | undefined
}

export type ElementParameter = {
  name: string | undefined
  value: string | undefined
  group: string | undefined
  isInstance: boolean
}

export type VimHeader = {
  vim: string | undefined
  id: string | undefined
  revision: string | undefined
  generator: string | undefined
  created: string | undefined
  schema: string | undefined
}

const objectModel = {
  header: 'header',
  entities: 'entities',
  bimDocument: {
    table: 'Vim.BimDocument',
    columns: {
      title: 'string:Title',
      pathName: 'string:PathName',
      isLinked: 'byte:IsLinked',
      product: 'string:Product',
      version: 'string:Version',
      author: 'string:Author',
      date: 'string:IssueDate'
    }
  },
  category: {
    table: 'Vim.Category',
    index: 'index:Vim.Category:Category',
    columns: {
      name: 'string:Name'
    }
  },
  document: {
    table: 'Vim.BimDocument',
    index: 'index:Vim.BimDocument:BimDocument',
    columns: {
      name: 'string:Name',
      title: 'string:Title'
    }
  },
  element: {
    table: 'Vim.Element',
    index: 'index:Vim.Element:Element',
    columns: {
      name: 'string:Name',
      familyName: 'string:FamilyName',
      id: 'int:Id'
    }
  },
  familyInstance: {
    table: 'Vim.FamilyInstance',
    columns: {}
  },
  familyType: {
    table: 'Vim.FamilyType',
    index: 'index:Vim.FamilyType:FamilyType',
    columns: {
      name: 'string:Name'
    }
  },
  family: {
    table: 'Vim.Family',
    index: 'index:Vim.Family:Family',
    columns: {}
  },
  nodes: {
    table: 'Vim.Node'
  },
  parameter: {
    table: 'Vim.Parameter',
    columns: {
      value: 'string:Value'
    }
  },
  parameterDescriptor: {
    table: 'Vim.ParameterDescriptor',
    index: 'index:Vim.ParameterDescriptor:ParameterDescriptor',
    columns: {
      name: 'string:Name',
      group: 'string:Group',
      isInstance: 'byte:IsInstance'
    }
  },
  workset: {
    table: 'Vim.Workset',
    index: 'index:Vim.Workset:Workset',
    columns: {
      name: 'string:Name'
    }
  }
}

export interface IDocument {
  header: VimHeader | undefined
  g3d: G3d | undefined
  /**
   * Returns all element indices of the vim
   */
  getAllElements(): IterableIterator<number>

  /**
   * Returns true if element exists in the vim.
   */
  hasElement(element: number): boolean

  /**
   * Returns instance indices associated with vim element index
   * @param element vim element index
   */
  getInstancesFromElement(element: number): number[] | undefined
  /**
   * Returns all fields of element at given element index
   * @param element vim element index
   */
  getElement(
    element: number
  ): Promise<Map<string, number | undefined> | undefined>
  /**
   * Returns provided field of at given element index
   * @param element vim element index
   * @param field field name
   */
  getElementValue(element: number, field: string): Promise<number | undefined>

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or undefined if not found
   */
  getElementFromInstance(instance: number): number | undefined
  /**
   * Returns the element index associated with element Id.
   * @param elementId vim element Id
   * @returns element index or undefined if not found
   */
  getElementsFromElementId(elementId: number): number[] | undefined
  /**
   * Returns element id from element index
   * @param element element index
   */
  getElementId(element: number): number | undefined
  /**
   * Returns all fields at given indices from buffer with given name
   * @param name buffer name
   * @param index row index
   */
  getEntity(
    name: string,
    index: number
  ): Promise<Map<string, number | undefined> | undefined>

  /**
   * Returns string value for string index.
   * @param index string index.
   */
  getString(index: number): string | undefined

  /**
   * Returns an array of element info for all element indices provided.
   * @param elements elements indices.
   */
  getElementsSummary(elements?: number[]): Promise<ElementInfo[] | undefined>

  /**
   * Returns all parameters of an element and of its family type and family
   * @param element element index
   * @returns An array of paramters with name, value, group
   */
  getElementParameters(element: number): Promise<ElementParameter[] | undefined>

  getBimDocumentSummary(): Promise<BimDocumentInfo[] | undefined>
}

export class DocumentNoBim implements IDocument {
  header: VimHeader | undefined
  g3d: G3d

  constructor (header: VimHeader | undefined, g3d: G3d) {
    this.header = header
    this.g3d = g3d
  }

  getAllElements (): IterableIterator<number> {
    return [].keys()
  }

  hasElement (element: number): boolean {
    return false
  }

  getInstancesFromElement (element: number) {
    return undefined
  }

  async getElement (element: number) {
    return undefined
  }

  async getElementValue (element: number, field: string) {
    return undefined
  }

  getElementFromInstance (instance: number) {
    return undefined
  }

  getElementsFromElementId (elementId: number) {
    return []
  }

  getElementId (element: number) {
    return undefined
  }

  async getEntity (name: string, index: number) {
    return undefined
  }

  getString (index: number) {
    return undefined
  }

  async getElementsSummary (elements?: number[]) {
    return undefined
  }

  async getElementParameters (element: number) {
    return undefined
  }

  async getBimDocumentSummary () {
    return undefined
  }
}

export class Document implements IDocument {
  readonly header: VimHeader | undefined
  readonly g3d: G3d
  readonly entities: BFast
  private _strings: string[] | undefined

  private _instanceToElement: number[]
  private _elementToInstances: Map<number, number[]>
  private _elementIds: number[]
  private _elementIdToElements: Map<number, number[]>

  private constructor (
    header: VimHeader | undefined,
    g3d: G3d,
    entities: BFast,
    strings: string[] | undefined,
    instanceToElement: number[],
    elementToInstances: Map<number, number[]>,
    elementIds: number[],
    elementIdToElements: Map<number, number[]>
  ) {
    this.header = header
    this.g3d = g3d
    this.entities = entities
    this._strings = strings
    this._instanceToElement = instanceToElement
    this._elementToInstances = elementToInstances
    this._elementIds = elementIds
    this._elementIdToElements = elementIdToElements
  }

  /**
   * Creates document by fetching all required data from bfast.
   */
  static async createFromBfast (
    bfast: BFast,
    streamG3d: boolean = false
  ): Promise<IDocument> {
    let header: VimHeader | undefined
    let g3d: G3d | undefined
    let entity: BFast | undefined
    let strings: string[] | undefined

    let instanceToElement: number[] | undefined
    let elementIds: number[] | undefined

    await Promise.all([
      Document.requestHeader(bfast).then((h) => (header = h)),
      Document.requestG3d(bfast, streamG3d).then((g) => (g3d = g)),
      Document.requestStrings(bfast).then((strs) => (strings = strs)),
      Document.requestEntities(bfast)
        .then((ets) => (entity = ets))
        .then((ets) => {
          if (ets) {
            return Promise.all([
              Document.requestInstanceToElement(ets).then(
                (array) => (instanceToElement = array)
              ),
              Document.requestElementIds(ets).then((v) => (elementIds = v))
            ])
          }
        })
    ])
    if (!entity) {
      return new DocumentNoBim(header, g3d!)
    }

    const elementToInstance = Document.invert(instanceToElement!)
    const elementIdToElements = Document.invert(elementIds!)
    return new Document(
      header,
      g3d!,
      entity,
      strings,
      instanceToElement!,
      elementToInstance,
      elementIds!,
      elementIdToElements
    )
  }

  private static async requestHeader (bfast: BFast): Promise<VimHeader> {
    const header = await bfast.getBuffer(objectModel.header)
    const pairs = new TextDecoder('utf-8').decode(header).split('\n')
    const map = new Map(pairs.map((p) => p.split('=')).map((p) => [p[0], p[1]]))
    return {
      vim: map.get('vim'),
      id: map.get('id'),
      revision: map.get('revision'),
      generator: map.get('generator'),
      created: map.get('created'),
      schema: map.get('schema')
    }
  }

  private static async requestG3d (bfast: BFast, streamG3d: boolean) {
    const geometry = streamG3d
      ? await bfast.getBfast('geometry')
      : await bfast.getLocalBfast('geometry')

    if (!geometry) {
      throw new Error('Could not get G3d Data from VIM file.')
    }
    const g3d = await G3d.createFromBfast(geometry)
    return g3d
  }

  private static async requestStrings (bfast: BFast) {
    const buffer = await bfast.getBuffer('strings')
    if (!buffer) {
      console.error(
        'Could not get String Data from VIM file. Bim features will be disabled.'
      )
      return
    }
    const strings = new TextDecoder('utf-8').decode(buffer).split('\0')
    return strings
  }

  private static async requestEntities (bfast: BFast) {
    const entities = await bfast.getBfast(objectModel.entities)
    if (!entities) {
      console.error(
        'Could not get String Data from VIM file. Bim features will be disabled.'
      )
    }
    return entities
  }

  private static async requestInstanceToElement (entities: BFast) {
    if (!entities) return
    const nodes = await entities.getBfast(objectModel.nodes.table)
    const instances = await nodes?.getArray(objectModel.element.index)
    if (!instances) {
      throw new Error('Could not get InstanceToElement from VIM file.')
    }
    return instances
  }

  /**
   * Request element id table from remote with support for legacy name
   */
  private static async requestElementIds (entities: BFast) {
    if (!entities) return
    const elements = await entities.getBfast(objectModel.element.table)
    const ids =
      (await elements?.getArray('int:Id')) ??
      (await elements?.getArray('numeric:Id'))

    if (!ids) {
      throw new Error('Could not get ElementIds from VIM file.')
    }
    return ids
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
   * Returns all fields of element at given element index
   * @param element vim element index
   */
  async getElement (element: number) {
    return this.getEntity(objectModel.element.table, element)
  }

  /**
   * Returns provided field of at given element index
   * @param element vim element index
   * @param field field name
   */
  async getElementValue (element: number, field: string) {
    const elements = await this.entities.getBfast(objectModel.element.table)
    if (!elements) return
    const value = await elements.getValue(field, element)
    return value
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
   * Returns the element index associated with element Id.
   * @param elementId vim element Id
   * @returns element index or undefined if not found
   */
  getElementsFromElementId (elementId: number) {
    return this._elementIdToElements.get(elementId)
  }

  /**
   * Returns element id from element index
   * @param element element index
   */
  getElementId (element: number) {
    return this._elementIds[element]
  }

  /**
   * Returns all fields at given indices from buffer with given name
   * @param name buffer name
   * @param index row index
   */
  async getEntity (name: string, index: number) {
    const elements = await this.entities.getBfast(name)
    const row = await elements?.getRow(index)
    if (!row) return
    this.resolveStrings(row)
    return row
  }

  getString (index: number) {
    return this._strings?.[index]
  }

  async getElementsSummary (elements?: number[]) {
    const set = elements ? new Set(elements) : undefined
    const elementTable = await this.entities.getBfast(objectModel.element.table)

    // Element
    const elementNameArray = await elementTable?.getArray(
      objectModel.element.columns.name
    )

    const elementIdArray = await elementTable?.getArray(
      objectModel.element.columns.id
    )

    const getElementName = (element: number) => {
      if (!elementNameArray) return
      return this.getString(elementNameArray?.[element])
    }

    // Category
    const elementCategoryArray = await elementTable?.getArray(
      objectModel.category.index
    )
    const categoryTable = await this.entities.getBfast(
      objectModel.category.table
    )
    const categoryNameArray = await categoryTable?.getArray(
      objectModel.category.columns.name
    )
    const getCategory = (element: number) => {
      if (!categoryNameArray) return
      if (!elementCategoryArray) return
      return this.getString(categoryNameArray[elementCategoryArray[element]])
    }

    // Family
    const familyInstanceTable = await this.entities.getBfast(
      objectModel.familyInstance.table
    )

    const familyNameArray = await elementTable?.getArray(
      objectModel.element.columns.familyName
    )

    const getFamilyName = (element: number) =>
      familyNameArray ? this.getString(familyNameArray[element]) : undefined

    // FamilyType
    const familyInstanceFamilyType = await familyInstanceTable?.getArray(
      objectModel.familyType.index
    )

    const familyTypeTable = await this.entities.getBfast(
      objectModel.familyType.table
    )
    const familyTypeElementArray = await familyTypeTable?.getArray(
      objectModel.element.index
    )

    const getFamilyTypeName = (family: number) => {
      if (!elementNameArray) return
      if (!familyTypeElementArray) return
      if (!familyInstanceFamilyType) return
      return this.getString(
        elementNameArray[
          familyTypeElementArray[familyInstanceFamilyType[family]]
        ]
      )
    }

    // Workset
    const elementWorksetArray = await elementTable?.getArray(
      objectModel.workset.index
    )
    const worksetTable = await this.entities.getBfast(objectModel.workset.table)
    const worksetNameArray = await worksetTable?.getArray(
      objectModel.workset.columns.name
    )
    const getWorkset = (element: number) => {
      if (!worksetNameArray) return
      if (!elementWorksetArray) return
      return this.getString(worksetNameArray[elementWorksetArray[element]])
    }

    // Document
    const elementDocumentArray = await elementTable?.getArray(
      objectModel.document.index
    )
    const documentTable = await this.entities.getBfast(
      objectModel.document.table
    )
    const documentTitleArray = await documentTable?.getArray(
      objectModel.document.columns.title
    )
    const getDocument = (element: number) => {
      if (!documentTitleArray) return
      if (!elementDocumentArray) return
      return this.getString(documentTitleArray[elementDocumentArray[element]])
    }

    // Compilation

    const familyInstanceElement = await familyInstanceTable?.getArray(
      objectModel.element.index
    )

    const summary: ElementInfo[] = []

    familyInstanceElement?.forEach((e, f) => {
      if (!set || set.has(e)) {
        summary.push({
          element: e,
          id: elementIdArray?.[e],
          name: getElementName(e),
          categoryName: getCategory(e),
          familyName: getFamilyName(e),
          familyTypeName: getFamilyTypeName(f),
          workset: getWorkset(e),
          documentTitle: getDocument(e)
        })
      }
    })
    return summary
  }

  /**
   * Returns all parameters of an element and of its family type and family
   * @param element element index
   * @returns An array of paramters with name, value, group
   */
  async getElementParameters (element: number) {
    const result: ElementParameter[] = []
    const instance = await this.getElementsParameters([element], true)
    instance?.forEach((i) => result.push(i))

    const familyInstance = await this.getElementFamilyInstance(element)
    const familyType = familyInstance
      ? await this.getFamilyInstanceFamilyType(familyInstance)
      : undefined

    const family = familyType
      ? await this.getFamilyTypeFamily(familyType)
      : undefined

    const familyTypeElement = familyType
      ? await this.getFamiltyTypeElement(familyType)
      : undefined

    const familyElement = family
      ? await this.getFamilyElement(family)
      : undefined

    const elements = []
    if (familyTypeElement) elements.push(familyTypeElement)
    if (familyElement) elements.push(familyElement)
    const type = await this.getElementsParameters(elements, false)
    type?.forEach((i) => result.push(i))

    return result
  }

  private async getElementsParameters (elements: number[], isInstance: boolean) {
    const set = new Set(elements)
    const parameterTable = await this.entities.getBfast(
      objectModel.parameter.table
    )
    const parameterElement = parameterTable
      ? await parameterTable.getArray(objectModel.element.index)
      : undefined

    const parameterValue = parameterTable
      ? await parameterTable.getArray(objectModel.parameter.columns.value)
      : undefined

    const getParameterDisplayValue = (index: number) => {
      if (!parameterValue) return
      const value = this.getString(parameterValue[index])
        ?.split('|')
        .filter((s) => s.length > 0)
      const displayValue = value?.[value.length - 1] ?? value?.[0]
      return displayValue
    }

    const parameterDescription = parameterTable
      ? await parameterTable.getArray(objectModel.parameterDescriptor.index)
      : undefined

    const parameterDescriptor = await this.entities.getBfast(
      objectModel.parameterDescriptor.table
    )

    const parameterDescriptorName = parameterDescriptor
      ? await parameterDescriptor.getArray(
        objectModel.parameterDescriptor.columns.name
      )
      : undefined

    const getParameterName = (descriptor: number | undefined) => {
      if (descriptor === undefined) return
      if (!parameterDescriptorName) return
      return this.getString(parameterDescriptorName[descriptor])
    }

    const parameterDescriptorGroup = parameterDescriptor
      ? await parameterDescriptor.getArray(
        objectModel.parameterDescriptor.columns.group
      )
      : undefined

    const getParameterGroup = (descriptor: number | undefined) => {
      if (!descriptor) return
      if (!parameterDescriptorGroup) return
      return this.getString(parameterDescriptorGroup[descriptor])
    }

    const result: ElementParameter[] = []

    if (!parameterElement) return undefined
    parameterElement.forEach((e, i) => {
      if (set.has(e)) {
        const d = parameterDescription?.[i]
        result.push({
          name: getParameterName(d),
          value: getParameterDisplayValue(i),
          group: getParameterGroup(d),
          isInstance: isInstance
        })
      }
    })
    return result
  }

  private async getElementFamilyInstance (element: number) {
    const familyInstanceTable = await this.entities.getBfast(
      objectModel.familyInstance.table
    )
    const familyInstanceElementArray = familyInstanceTable
      ? await familyInstanceTable.getArray(objectModel.element.index)
      : undefined

    let result: number | undefined
    familyInstanceElementArray?.forEach((e, i) => {
      if (e === element) {
        result = i
      }
    })
    return result
  }

  private async getFamilyInstanceFamilyType (familyInstance: number) {
    const familyInstanceTable = await this.entities.getBfast(
      objectModel.familyInstance.table
    )

    const result = await familyInstanceTable?.getValue(
      objectModel.familyType.index,
      familyInstance
    )

    return result
  }

  private async getFamilyTypeFamily (familyType: number) {
    const familyTypeTable = await this.entities.getBfast(
      objectModel.familyType.table
    )

    const result = await familyTypeTable?.getValue(
      objectModel.family.index,
      familyType
    )

    return result
  }

  private async getFamiltyTypeElement (familyType: number) {
    const familyTypeTable = await this.entities.getBfast(
      objectModel.familyType.table
    )

    const result = await familyTypeTable?.getValue(
      objectModel.element.index,
      familyType
    )

    return result
  }

  async getBimDocumentSummary () {
    const documentTable = await this.entities.getBfast(
      objectModel.bimDocument.table
    )
    const titles = (
      await documentTable?.getArray(objectModel.bimDocument.columns.title)
    )?.map((n) => this._strings?.[n])

    const isLinkedArray = await documentTable?.getArray(
      objectModel.bimDocument.columns.isLinked
    )
    const pathName = (
      await documentTable?.getArray(objectModel.bimDocument.columns.pathName)
    )?.map((n) => this._strings?.[n])

    const product = (
      await documentTable?.getArray(objectModel.bimDocument.columns.product)
    )?.map((n) => this._strings?.[n])
    const version = (
      await documentTable?.getArray(objectModel.bimDocument.columns.version)
    )?.map((n) => this._strings?.[n])
    const author = (
      await documentTable?.getArray(objectModel.bimDocument.columns.author)
    )?.map((n) => this._strings?.[n])
    const date = (
      await documentTable?.getArray(objectModel.bimDocument.columns.date)
    )?.map((n) => this._strings?.[n])

    const max = Math.max(
      titles?.length ?? 0,
      version?.length ?? 0,
      author?.length ?? 0,
      date?.length ?? 0
    )
    const summary: BimDocumentInfo[] = []
    for (let i = 0; i < max; i++) {
      summary.push({
        title: titles?.[i],
        pathName: pathName?.[i],
        isLinked: isLinkedArray?.[i] > 0,
        product: product?.[i],
        version: version?.[i],
        author: author?.[i],
        date: date?.[i]
      })
    }
    return summary
  }

  private async getFamilyElement (family: number) {
    const familyTable = await this.entities.getBfast(objectModel.family.table)
    const result = await familyTable?.getValue(
      objectModel.element.index,
      family
    )
    return result
  }

  /**
   * Associate all string indices with their related strings.
   */
  private resolveStrings (map: Map<string, number | undefined>) {
    if (!this._strings) return
    const result = <Map<string, string | number | undefined>>map
    for (const key of map.keys()) {
      if (key.startsWith('string:')) {
        const v = map.get(key)
        result.set(key, v ? this._strings[v] : undefined)
      }
    }
  }
}
