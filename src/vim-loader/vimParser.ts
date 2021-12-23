import { BFast } from './bfast'
import { G3d, VimG3d, Attribute } from './g3d'
import { Vim } from './vim'
import { BFastParser } from './bfastParser'

export class VimParser {
  private static log (msg: string) {
    console.timeLog('VimParser', msg)
  }

  // Given a BFAST container (header/names/buffers) constructs a VIM data structure
  public static parseFromBFast = (bfast: BFast): Vim => {
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

    this.log(`Parsing header: ${headerData.length} bytes`)
    const header = new TextDecoder('utf-8').decode(headerData)

    this.log(`Constructing G3D: ${g3dData.length} bytes`)
    const g3d = new VimG3d(this.parseG3d(BFastParser.parseFromArray(g3dData)))
    this.log('Validating G3D')
    g3d.validate()

    this.log(`Retrieving assets: ${assetData.length} bytes`)
    const assets = BFastParser.parseFromArray(assetData)
    this.log(`Found ${assets.buffers.length} assets`)

    this.log(`Constructing entity tables: ${entityData.length} bytes`)
    const entities = this.parseEntityTables(
      BFastParser.parseFromArray(entityData)
    )
    this.log(`Found ${entities.size} entity tables`)

    this.log(`Decoding strings: ${stringData.length} bytes`)
    const strings = new TextDecoder('utf-8').decode(stringData).split('\0')
    this.log(`Found ${strings.length} strings`)

    return new Vim(header, assets, g3d, entities, strings)
  }

  private static parseEntityTables (bfast: BFast) {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const current = bfast.names[i]
      const tableName = current.substring(current.indexOf(':') + 1)
      const buffer = bfast.buffers[i]
      this.log(
        `Constructing entity table ${current} which is ${buffer.length} size`
      )
      const next = this.parseEntityTable(BFastParser.parseFromArray(buffer))
      result.set(tableName, next)
    }
    return result
  }

  private static parseEntityTable (bfast: BFast) {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const columnName = bfast.names[i]
      // eslint-disable-next-line no-unused-vars
      const [columnType, ..._] = columnName.split(':')
      const buffer = bfast.buffers[i]

      let length
      let ctor
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

  // Given a BFAST container (header/names/buffers) constructs a G3D data structure
  private static parseG3d (bfast: BFast): G3d {
    console.log('Constructing G3D')

    if (bfast.buffers.length < 2) {
      throw new Error('G3D requires at least two BFast buffers')
    }

    // Parse first buffer as Meta
    const metaBuffer = bfast.buffers[0]
    if (bfast.names[0] !== 'meta') {
      throw new Error(
        "First G3D buffer must be named 'meta', but was named: " +
          bfast.names[0]
      )
    }
    const meta = new TextDecoder('utf-8').decode(metaBuffer)

    // Parse remaining buffers as Attributes
    const attributes: Attribute[] = []
    const nDescriptors = bfast.buffers.length - 1
    for (let i = 0; i < nDescriptors; ++i) {
      const attribute = Attribute.fromString(
        bfast.names[i + 1],
        bfast.buffers[i + 1]
      )
      attributes.push(attribute)
      console.log(`Attribute ${i} = ${attribute.descriptor.description}`)
    }

    return new G3d(meta, attributes)
  }
}
