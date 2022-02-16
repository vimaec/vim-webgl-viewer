/**
 * @module vim-loader
 */

import { BFast } from './bfast'
import { G3d } from './g3d'

export type EntityTable = Map<string, ArrayLike<number>>

/**
 * Document is the parsed content of a vim, including geometry data, bim data and other meta data.
 * See https://github.com/vimaec/vim
 */
export class Document {
  private static tableElement = 'Vim.Element'
  private static tableElementLegacy = 'Rvt.Element'
  private static tableNode = 'Vim.Node'

  header: string
  assets: BFast
  g3d: G3d
  entities: Map<string, EntityTable>
  strings: string[]

  instanceToElement: number[]
  constructor (
    header: string,
    assets: BFast,
    g3d: G3d,
    entities: Map<string, EntityTable>,
    strings: string[]
  ) {
    this.header = header
    this.assets = assets
    this.g3d = g3d
    this.entities = entities
    this.strings = strings
  }

  /**
   * Returns BIM data for given element
   * @param element element index
   */
  getElement (element: number) {
    return this.getEntity(Document.tableElement, element)
  }

  getEntity (type: string, index: number) {
    const r = new Map<string, string | number>()
    if (index < 0) return r
    const table = this.entities?.get(type)
    if (!table) return r
    for (const k of table.keys()) {
      const parts = k.split(':')
      const values = table.get(k)
      if (!values) continue

      const value =
        parts[0] === 'string' ? this.strings[values[index]] : values[index]

      const name = parts[parts.length - 1]
      r.set(name, value)
    }
    return r
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or -1 if not found
   */
  getElementFromInstance (instance: number): number {
    return this.getInstanceToElementMap()[instance]
  }

  getInstanceCount () {
    return this.getInstanceToElementMap().length
  }

  getStringColumn = (table: any, colNameNoPrefix: string): number[] =>
    table?.get('string:' + colNameNoPrefix)

  getIndexColumn = (table: any, tableName: string, fieldName: string) =>
    table?.get(`index:${tableName}:${fieldName}`)

  getDataColumn = (table: any, typePrefix: any, colNameNoPrefix: any) =>
    table?.get(typePrefix + colNameNoPrefix) ??
    table?.get('numeric:' + colNameNoPrefix) // Backwards compatible call with vim0.9

  getIntColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'int:', colNameNoPrefix)

  getByteColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'byte:', colNameNoPrefix)

  getFloatColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'float:', colNameNoPrefix)

  getDoubleColumn = (table: any, colNameNoPrefix: string) =>
    this.getDataColumn(table, 'double:', colNameNoPrefix)

  private getInstanceToElementMap (): number[] {
    if (this.instanceToElement) return this.instanceToElement
    const table = this.getInstanceTable()
    this.instanceToElement =
      this.getIndexColumn(table, Document.tableElement, 'Element') ??
      // Backwards compatible call with vim0.9
      table?.get(Document.tableElementLegacy)

    return this.instanceToElement
  }

  getElementTable = () =>
    this.entities?.get(Document.tableElement) ??
    this.entities?.get(Document.tableElementLegacy)

  getInstanceTable = () => this.entities.get(Document.tableNode)

  /**
   * Creates a new Document instance from an array buffer of a vim file
   * @param data array representation of a vim
   * @returns a Document instance
   */
  static createFromArrayBuffer (data: ArrayBuffer) {
    const bfast = BFast.fromArrayBuffer(data)
    return Document.createFromBFast(bfast)
  }

  /**
   * Creates a new Document instance from a bfast following the vim format
   * @param data Bfast reprentation of a vim
   * @returns a Document instance
   */
  static createFromBFast (bfast: BFast): Document {
    if (bfast.buffers.length < 5) {
      throw new Error('VIM requires at least five BFast buffers')
    }

    const lookup = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      lookup.set(bfast.names[i], bfast.buffers[i])
    }

    const assetData = lookup.get('assets')
    const g3dData = lookup.get('geometry')
    const headerData = lookup.get('header')
    const entityData = lookup.get('entities')
    const stringData = lookup.get('strings')

    const header = new TextDecoder('utf-8').decode(headerData)
    const g3d = G3d.fromBfast(BFast.fromArray(g3dData))
    const assets = BFast.fromArray(assetData)
    const entities = Document.parseEntityTables(BFast.fromArray(entityData))
    const strings = new TextDecoder('utf-8').decode(stringData).split('\0')

    g3d.validate()

    return new Document(header, assets, g3d, entities, strings)
  }

  private static parseEntityTables (bfast: BFast): Map<string, EntityTable> {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const current = bfast.names[i]
      const tableName = current.substring(current.indexOf(':') + 1)
      const buffer = bfast.buffers[i]
      const next = Document.parseEntityTable(BFast.fromArray(buffer))
      result.set(tableName, next)
    }
    return result
  }

  private static parseEntityTable (bfast: BFast): EntityTable {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const columnName = bfast.names[i]
      // eslint-disable-next-line no-unused-vars
      const [columnType, ..._] = columnName.split(':')
      const buffer = bfast.buffers[i]

      let length: number
      let ctor:
        | Int8ArrayConstructor
        | Float32ArrayConstructor
        | Float64ArrayConstructor
        | Int32ArrayConstructor
      switch (columnType) {
        case 'byte':
          length = buffer.byteLength
          ctor = Int8Array
          break
        case 'float':
          length = buffer.byteLength / 4
          ctor = Float32Array
          break
        case 'double':
        case 'numeric': // legacy (vim0.9)
          length = buffer.byteLength / 8
          ctor = Float64Array
          break
        case 'string': // i.e. indices into the string table
        case 'index':
        case 'int':
        case 'properties': // legacy (vim0.9)
          length = buffer.byteLength / 4
          ctor = Int32Array
          break
        default:
          throw new Error('Unrecognized column type ' + columnType)
      }

      // eslint-disable-next-line new-cap
      const columnData = new ctor(buffer.buffer, buffer.byteOffset, length)
      result.set(columnName, columnData)
    }
    return result
  }
}
