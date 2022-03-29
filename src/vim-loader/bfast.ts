/**
 * @module vim-loader
 */
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

export interface IBFast {
  getHeader(): Promise<Header>
  getRanges(): Promise<Map<string, Range>>

  getBfast(name: string): Promise<IBFast>

  getBuffer(name: string): Promise<ArrayBuffer>
  getArray(name: string): Promise<Number[]>

  getValue(name: string, index: number): Promise<number>

  getBytes(name: string): Promise<Uint8Array>

  getRow(index: number): Promise<Map<string, number>>
}
