import { BFast, BFastParser } from './bfast'
import { G3d, VimG3d, Attribute } from './g3d'
import { Vim } from './vim'
import { Logger } from './logger'

export class VimParser {
  logger: Logger | undefined
  constructor (logger: Logger) {
    this.logger = logger
  }

  // Given a BFAST container (header/names/buffers) constructs a VIM data structure
  public parseFromBFast = (bfast: BFast): Vim => {
    const bFastParser = new BFastParser()
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

    this.logger?.log(`Parsing header: ${headerData.length} bytes`)
    const header = new TextDecoder('utf-8').decode(headerData)

    this.logger?.log(`Constructing G3D: ${g3dData.length} bytes`)
    const g3d = new VimG3d(this.parseG3d(bFastParser.parseFromArray(g3dData)))
    this.logger?.log('Validating G3D')
    g3d.validate()

    this.logger?.log(`Retrieving assets: ${assetData.length} bytes`)
    const assets = bFastParser.parseFromArray(assetData)
    this.logger?.log(`Found ${assets.buffers.length} assets`)

    this.logger?.log(`Constructing entity tables: ${entityData.length} bytes`)
    const entities = this.parseEntityTables(
      bFastParser,
      bFastParser.parseFromArray(entityData)
    )
    this.logger?.log(`Found ${entities.size} entity tables`)

    this.logger?.log(`Decoding strings: ${stringData.length} bytes`)
    const strings = new TextDecoder('utf-8').decode(stringData).split('\0')
    this.logger?.log(`Found ${strings.length} strings`)

    return new Vim(header, assets, g3d, entities, strings)
  }

  private parseEntityTables (parser: BFastParser, bfast: BFast): Map<string, any> {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const current = bfast.names[i]
      const tableName = current.substring(current.indexOf(':') + 1)
      const buffer = bfast.buffers[i]
      this.logger?.log(
        `Constructing entity table ${current} which is ${buffer.length} size`
      )
      const next = this.parseEntityTable(parser.parseFromArray(buffer))
      result.set(tableName, next)
    }
    return result
  }

  private parseEntityTable (bfast: BFast): Map<string, any> {
    const result = new Map<string, any>()
    for (let i = 0; i < bfast.buffers.length; ++i) {
      const columnName = bfast.names[i]
      // eslint-disable-next-line no-unused-vars
      const [columnType, ..._] = columnName.split(':')
      const buffer = bfast.buffers[i]

      let length: number
      let ctor: Int8ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor | Int32ArrayConstructor;
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
  private parseG3d (bfast: BFast): G3d {
    this.logger?.log('Constructing G3D')

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
      this.logger?.log(`Attribute ${i} = ${attribute.descriptor.description}`)
    }

    return new G3d(meta, attributes)
  }
}
