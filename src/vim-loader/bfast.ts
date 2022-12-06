/**
 * @module vim-loader
 */

import { RemoteValue } from './remoteValue'
import { RemoteBuffer } from './remoteBuffer'

type ArrayConstructor =
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | Int32ArrayConstructor

export class Range {
  start: number
  end: number
  get count () {
    return this.end - this.start
  }

  constructor (start: number, end: number) {
    this.start = start
    this.end = end
  }

  offset (offset: number) {
    return new Range(this.start + offset, this.end + offset)
  }
}

function typeSize (type: string) {
  switch (type) {
    case 'byte':
      return 1
    case 'short':
      return 2
    case 'int':
    case 'float':
      return 4
    case 'long':
    case 'double':
      return 8
    default:
      return 4
  }
}

function typeConstructor (type: string): ArrayConstructor {
  switch (type) {
    case 'byte':
      return Int8Array
    case 'short':
      return Int16Array
    case 'int':
      return Int32Array
    case 'float':
      return Float32Array
    case 'long':
    case 'double':
      return Float64Array
    default:
      return Int32Array
  }
}

/**
 * Bfast header, mainly for validation.
 * See https://github.com/vimaec/bfast
 */
export class BFastHeader {
  magic: number
  dataStart: number
  dataEnd: number
  numArrays: number

  constructor (
    magic: number,
    dataStart: number,
    dataEnd: number,
    numArrays: number
  ) {
    if (magic !== 0xbfa5) {
      throw new Error('Invalid Bfast. Invalid Magic number')
    }
    if (dataStart <= 32 || dataStart > Number.MAX_SAFE_INTEGER) {
      throw new Error('Invalid Bfast. Data start is out of valid range')
    }
    if (dataEnd < dataStart || dataEnd > Number.MAX_SAFE_INTEGER) {
      throw new Error('Invalid Bfast. Data end is out of valid range')
    }
    if (numArrays < 0 || numArrays > dataEnd) {
      throw new Error('Invalid Bfast. Number of arrays is invalid')
    }

    this.magic = magic
    this.dataStart = dataStart
    this.dataEnd = dataEnd
    this.numArrays = numArrays
  }

  static createFromArray (array: Uint32Array): BFastHeader {
    // Check validity of data
    // TODO: check endianness

    if (array[1] !== 0) {
      throw new Error('Invalid Bfast. Expected 0 in byte position 0')
    }
    if (array[3] !== 0) {
      throw new Error('Invalid Bfast. Expected 0 in byte position 8')
    }
    if (array[5] !== 0) {
      throw new Error('Invalid Bfast. Expected 0 in position 16')
    }
    if (array[7] !== 0) {
      throw new Error('Invalid Bfast. Expected 0 in position 24')
    }

    return new this(array[0], array[2], array[4], array[6])
  }

  static createFromBuffer (array: ArrayBuffer): BFastHeader {
    return BFastHeader.createFromArray(new Uint32Array(array))
  }
}

/**
 * See https://github.com/vimaec/bfast for bfast format spec
 * This implementation can either lazily request content as needed from http
 * Or it can serve the data directly from an ArrayBuffer
 * Remote mode can transition to buffer mode if server doesnt support partial http request
 */
export class BFast {
  source: RemoteBuffer | ArrayBuffer
  offset: number
  name: string
  private _header: RemoteValue<BFastHeader>
  private _ranges: RemoteValue<Map<string, Range>>
  private _children: Map<string, RemoteValue<BFast | undefined>>

  constructor (
    source: RemoteBuffer | ArrayBuffer,
    offset: number = 0,
    name: string = ''
  ) {
    this.source = source
    this.offset = offset
    this.name = name

    this._header = new RemoteValue(() => this.requestHeader(), name + '.header')
    this._children = new Map<string, RemoteValue<BFast>>()
    this._ranges = new RemoteValue(() => this.requestRanges(), name + '.ranges')
  }

  /**
   * @returns Bfast Header
   */
  async getHeader () {
    return this._header.get()
  }

  /**
   * @returns a map of all buffers by names
   */
  async getRanges () {
    return this._ranges.get()
  }

  /**
   * Returns the buffer associated with name as a new bfast.
   * This value is cached for future requests.
   * @param name buffer name
   */
  async getBfast (name: string) {
    let request = this._children.get(name)
    if (!request) {
      request = new RemoteValue(() => this.requestBfast(name))
      this._children.set(name, request)
    }
    return request.get()
  }

  async getLocalBfast (name: string) {
    const buffer = await this.getBuffer(name)
    if (!buffer) return
    return new BFast(buffer, 0, name)
  }

  /**
   * Returns a new local bfast equivalent to this bfast.
   */
  async getSelf () {
    const header = await this._header.get()
    const range = new Range(0, header.dataEnd)
    const buffer = await this.request(range, this.name)
    if (!buffer) return
    const result = new BFast(buffer, 0, this.name)
    return result
  }

  /**
   * Returns the raw buffer associated with a name
   * This value is not cached.
   * @param name buffer name
   */
  async getBuffer (name: string) {
    const ranges = await this.getRanges()
    const range = ranges.get(name)
    if (!range) return

    const buffer = await this.request(range, name)
    return buffer
  }

  /**
   * Returns a number array from the buffer associated with name
   * @param name buffer name
   */
  async getArray (name: string) {
    const buffer = await this.getBuffer(name)
    if (!buffer) return
    const type = name.split(':')[0]
    const Ctor = typeConstructor(type)
    const array = new Ctor(buffer)
    return Array.from(array)
  }

  /**
   * Returns a single value from given buffer name
   * @param name buffer name
   * @param index row index
   */
  async getValue (name: string, index: number) {
    const ranges = await this.getRanges()
    const range = ranges.get(name)
    if (!range) return

    const type = name.split(':')[0]
    const size = typeSize(type)
    const start = range.start + index * size
    const buffer = await this.request(
      new Range(start, start + size),
      `${name}[${index.toString()}]`
    )
    if (!buffer) return
    const Ctor = typeConstructor(type)
    const array = new Ctor(buffer)
    return array[0]
  }

  /**
   * Returns the buffer with given name as a byte array
   * @param name buffer name
   */
  async getBytes (name: string) {
    const buffer = await this.getBuffer(name)
    if (!buffer) return
    const array = new Uint8Array(buffer)
    return array
  }

  /**
   * Returns a map of name-values with the same index from all buffers.
   * @param name buffer name
   */
  async getRow (index: number) {
    const ranges = await this.getRanges()
    if (!ranges) return
    const result = new Map<string, number | undefined>()
    const promises = []
    for (const name of ranges.keys()) {
      const p = this.getValue(name, index).then((v) => result.set(name, v))
      promises.push(p)
    }

    await Promise.all(promises)
    return result
  }

  /**
   * Forces download of the full underlying buffer, from now on all calls will be local.
   */
  async forceDownload () {
    if (this.source instanceof ArrayBuffer) {
      console.log('Ignoring forceDownload on local buffer.')
      return
    }
    const buffer = await this.remote(undefined, this.name)
    if (!buffer) throw new Error('Failed to download BFAST.')
    this.source = buffer
  }

  /**
   * Downloads the appropriate range and cast it as a new sub bfast.
   */
  private async requestBfast (name: string) {
    const ranges = await this.getRanges()

    const range = ranges.get(name)
    if (!range) return

    const result = new BFast(
      this.source,
      this.offset + range.start,
      this.name + '.' + name
    )

    return result
  }

  /**
   * Downloads and parses ranges as a map of name->range
   */
  private async requestRanges () {
    const header = await this.getHeader()
    const buffer = await this.request(
      new Range(32, 32 + header.numArrays * 16),
      'Ranges'
    )
    if (!buffer) throw new Error('Could not get BFAST Ranges.')

    // Parse range
    const array = new Uint32Array(buffer)
    const ranges: Range[] = []
    for (let i = 0; i < array.length; i += 4) {
      if (array[i + 1] !== 0 || array[i + 3] !== 0) {
        throw new Error('Invalid Bfast. 64 bit ranges not supported')
      }
      ranges.push(new Range(array[i], array[i + 2]))
    }

    const names = await this.requestNames(ranges[0])
    if (ranges.length !== names.length + 1) {
      throw new Error('Mismatched ranges and names count')
    }

    // Map ranges and names
    const map = new Map<string, Range>()
    for (let i = 0; i < names.length; i++) {
      map.set(names[i], ranges[i + 1])
    }

    return map
  }

  /**
   * Downloads and parse names from remote.
   */
  private async requestNames (range: Range) {
    const buffer = await this.request(range, 'Names')
    const names = new TextDecoder('utf-8').decode(buffer)
    const result = names.slice(0, -1).split('\0')
    return result
  }

  /**
   * Downloads and parse header from remote.
   */
  private async requestHeader () {
    const buffer = await this.request(new Range(0, 32), 'Header')
    if (!buffer) throw new Error('Could not get BFAST Header')
    const result = BFastHeader.createFromBuffer(buffer)
    return result
  }

  /**
   * Gets array buffer from from cache, or partial http, fallback to full http
   * @param range range to get, or get full resource if undefined
   * @param label label for logs
   */
  private async request (range: Range, label: string) {
    const buffer =
      this.local(range, label) ??
      (await this.remote(range, label)) ??
      (await this.remote(undefined, label))

    if (!buffer) {
      throw new Error(`Could not load vim at ${this.source}`)
    }

    if (buffer.byteLength > range.count) {
      this.source = buffer
      return this.local(range, label)
    }
    return buffer
  }

  /**
   * returns requested range from cache.
   */
  private local (range: Range, label: string) {
    if (!(this.source instanceof ArrayBuffer)) return
    console.log(`Returning local ${this.name}.${label}`)
    const r = range.offset(this.offset)
    return this.source.slice(r.start, r.end)
  }

  /**
   * returns requested range from remote.
   */
  private async remote (range: Range | undefined, label: string) {
    if (!(this.source instanceof RemoteBuffer)) return
    const r = range?.offset(this.offset)
    const buffer = await this.source.http(r, `${this.name}.${label}`)
    if (range && (buffer?.byteLength ?? 0) < range.count) {
      console.log('Range request request failed.')
      return
    }
    return buffer
  }
}
