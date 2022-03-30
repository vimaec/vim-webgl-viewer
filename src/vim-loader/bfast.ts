/**
 * @module vim-loader
 */

import { RemoteValue } from './remoteValue'

export type ArrayConstructor =
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | Int32ArrayConstructor

export type Array =
  | Int8Array
  | Int16Array
  | Float32Array
  | Float64Array
  | Int32Array

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
}

export function typeSize (type: string) {
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

export function typeConstructor (type: string): ArrayConstructor {
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
export class Header {
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
      throw new Error('Not a BFAST file, or endianness is swapped')
    }
    if (dataStart <= 32 || dataStart > Number.MAX_SAFE_INTEGER) {
      throw new Error('Data start is out of valid range')
    }
    if (dataEnd < dataStart || dataEnd > Number.MAX_SAFE_INTEGER) {
      throw new Error('Data end is out of valid range')
    }
    if (numArrays < 0 || numArrays > dataEnd) {
      throw new Error('Number of arrays is invalid')
    }

    this.magic = magic
    this.dataStart = dataStart
    this.dataEnd = dataEnd
    this.numArrays = numArrays
  }

  static createFromArray (array: Uint32Array): Header {
    // Check validity of data
    // TODO: check endianness

    if (array[1] !== 0) throw new Error('Expected 0 in byte position 0')
    if (array[3] !== 0) throw new Error('Expected 0 in byte position 8')
    if (array[5] !== 0) throw new Error('Expected 0 in position 16')
    if (array[7] !== 0) throw new Error('Expected 0 in position 24')

    return new this(array[0], array[2], array[4], array[6])
  }

  static createFromBuffer (array: ArrayBuffer): Header {
    return Header.createFromArray(new Uint32Array(array))
  }
}

export class BFast {
  source: string | ArrayBuffer
  offset: number
  name: string
  private _header: RemoteValue<Header>
  private _ranges: RemoteValue<Map<string, Range>>
  private _children: Map<string, RemoteValue<BFast>>

  constructor (
    source: string | ArrayBuffer,
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

  async getHeader () {
    return this._header.get()
  }

  async getRanges () {
    return this._ranges.get()
  }

  async getBfast (name: string) {
    if (!this._children.has(name)) {
      this._children.set(name, new RemoteValue(() => this.requestBfast(name)))
    }
    return this._children.get(name).get()
  }

  async getBuffer (name: string) {
    const ranges = await this.getRanges()
    const range = ranges.get(name)
    if (!range) return

    const buffer = await this.request(range, name)
    return buffer
  }

  async getArray (name: string) {
    const buffer = await this.getBuffer(name)
    const type = name.split(':')[0]
    const Ctor = typeConstructor(type)
    const array = new Ctor(buffer)
    return Array.from(array)
  }

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
    const Ctor = typeConstructor(type)
    const array = new Ctor(buffer)
    return array[0]
  }

  async getBytes (name: string) {
    const buffer = await this.getBuffer(name)
    const array = new Uint8Array(buffer)
    return array
  }

  async getRow (index: number) {
    const ranges = await this.getRanges()
    if (!ranges) return
    const result = new Map<string, number>()
    const promises = []
    for (const name of ranges.keys()) {
      const p = this.getValue(name, index).then((v) => result.set(name, v))
      promises.push(p)
    }

    await Promise.all(promises)
    return result
  }

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

  private async requestRanges () {
    const header = await this.getHeader()
    const buffer = await this.request(
      new Range(32, 32 + header.numArrays * 16),
      'Ranges'
    )

    // Parse range
    const array = new Uint32Array(buffer)
    const ranges: Range[] = []
    for (let i = 0; i < array.length; i += 4) {
      ranges.push(new Range(array[i], array[i + 2]))
    }

    const names = await this.requestNames(ranges[0])
    if (ranges.length !== names.length + 1) {
      throw new Error('Mismatched ranges and names')
    }

    // Map ranges and names
    const map = new Map<string, Range>()
    for (let i = 0; i < names.length; i++) {
      map.set(names[i], ranges[i + 1])
    }

    return map
  }

  private async requestNames (range: Range) {
    const buffer = await this.request(range, 'Names')
    const names = new TextDecoder('utf-8').decode(buffer)
    const result = names.slice(0, -1).split('\0')
    return result
  }

  private async requestHeader () {
    const buffer = await this.request(new Range(0, 32), 'Header')
    const result = Header.createFromBuffer(buffer)
    return result
  }

  private async request (range: Range, label: string): Promise<ArrayBuffer> {
    const buffer =
      this.local(range, label) ??
      (await this.http(range, label)) ??
      (await this.http(undefined, label))
    if (buffer.byteLength > range.count) {
      this.source = buffer
    }
    return buffer
  }

  private async http (range: Range, label: string) {
    if (typeof this.source !== 'string') return
    const xhr = new XMLHttpRequest()
    xhr.open('GET', this.source)
    xhr.responseType = 'arraybuffer'
    const str = `WebRequest ${this.name}.${label}`

    if (range) {
      const start = this.offset + range.start
      const end = this.offset + range.end
      xhr.setRequestHeader('Range', `bytes=${start}-${end - 1}`)
      console.log(`${str} : [${start}, ${end}] of ${this.source}`)
    } else {
      console.log(`${str} of ${this.source}`)
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
      xhr.send()
      xhr.onprogress = (e) =>
        console.log(`${str} : ${Math.round(e.loaded / 1000000)} MB`)
      xhr.onload = () => resolve(xhr.response)
      xhr.onerror = (_) => {
        resolve(undefined)
      }
    })
  }

  private local (range: Range, label: string) {
    if (typeof this.source === 'string') return
    console.log(`Returning local ${this.name}.${label}`)
    const start = this.offset + range.start
    const end = this.offset + range.end
    return this.source.slice(start, end)
  }
}
