import { BFast } from './bfast'
import { G3d } from './g3d'

export type EntityTable = Map<string, ArrayLike<number>>

export class Vim {
  static tableElement = 'Vim.Element'
  static tableElementLegacy = 'Rvt.Element'
  static tableNode = 'Vim.Node'

  header: string
  assets: BFast
  g3d: G3d
  entities: Map<string, EntityTable>
  strings: string[]

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

  getEntity (type: string, index: number): any {
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

  static parseFromArrayBuffer (data: ArrayBuffer) {
    const bfast = BFast.fromArrayBuffer(data)
    return Vim.parseFromBFast(bfast)
  }

  // Given a BFAST container (header/names/buffers) constructs a VIM data structure
  static parseFromBFast (bfast: BFast): Vim {
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
    const entities = Vim.parseEntityTables(BFast.fromArray(entityData))
    const strings = new TextDecoder('utf-8').decode(stringData).split('\0')

    g3d.validate()

    return new Vim(header, assets, g3d, entities, strings)
  }

  static parseEntityTables (bfast: BFast): Map<string, EntityTable> {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const current = bfast.names[i]
      const tableName = current.substring(current.indexOf(':') + 1)
      const buffer = bfast.buffers[i]
      const next = Vim.parseEntityTable(BFast.fromArray(buffer))
      result.set(tableName, next)
    }
    return result
  }

  static parseEntityTable (bfast: BFast): EntityTable {
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
