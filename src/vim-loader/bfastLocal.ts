/**
 * @module vim-loader
 */

import * as BFast from './bfast'
/**
 * BFAST is a data format for simple, efficient, and reliable serialization
 * and deserialization of collections of binary data with optional names as a single block of data.
 * See https://github.com/vimaec/bfast
 */
export class BFastLocal implements BFast.IBFast {
  buffer: ArrayBuffer
  header: BFast.Header
  ranges: Map<string, BFast.Range>

  constructor (
    buffer: ArrayBuffer,
    header: BFast.Header,
    ranges: Map<string, BFast.Range>
  ) {
    this.header = header
    this.buffer = buffer
    this.ranges = ranges
  }

  async getHeader (): Promise<BFast.Header> {
    return this.header
  }

  async getRanges (): Promise<Map<string, BFast.Range>> {
    return this.ranges
  }

  async getBfast (name: string): Promise<BFast.IBFast> {
    const range = this.ranges.get(name)
    return BFastLocal.createFromArrayBuffer(
      this.buffer,
      range.start,
      range.count
    )
  }

  async getBuffer (name: string): Promise<ArrayBuffer> {
    const range = this.ranges.get(name)
    return this.buffer.slice(range.start, range.end)
  }

  async getArray (name: string): Promise<Number[]> {
    const range = this.ranges.get(name)
    const type = name.split(':')[0]
    const Ctor = BFast.typeConstructor(type)
    const array = new Ctor(this.buffer, range.start, range.count)
    return Array.from(array)
  }

  async getValue (name: string, index: number): Promise<number> {
    const range = this.ranges.get(name)
    const type = name.split(':')[0]
    const size = BFast.typeSize(type)
    const start = range.start + index * size

    const Ctor = BFast.typeConstructor(type)
    const array = new Ctor(this.buffer, start, size)
    return array[0]
  }

  async getBytes (name: string): Promise<Uint8Array> {
    const range = this.ranges.get(name)
    const result = new Uint8Array(this.buffer, range.start, range.end)
    return result
  }

  async getRow (index: number): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    for (const name of this.ranges.keys()) {
      await this.getValue(name, index).then((v) => result.set(name, v))
    }

    return result
  }

  /**
   * Returns a newly constructed bfast instance from parsing the data of arrayBuffer
   * @param bytes an array of bytes from which to construct the bfast
   * @returns a bfast instance
   */
  static createFromArray (bytes: Uint8Array): BFastLocal {
    return this.createFromArrayBuffer(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    )
  }

  /**
   * Returns a newly constructed bfast instance from parsing the data of arrayBuffer
   * @param arrayBuffer an array of bytes from which to construct the bfast
   * @param byteOffset where to start parsing the array
   * @param byteLength how many bytes to parse from the array
   * @returns a bfast instance
   */
  static createFromArrayBuffer (
    arrayBuffer: ArrayBuffer,
    byteOffset: number = 0,
    byteLength: number = arrayBuffer.byteLength - byteOffset
  ): BFastLocal {
    // Cast the input data to 32-bit integers
    // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers,
    // and it would bust the amount of memory we can work with in most browsers and low-power devices
    // const data = new Int32Array(arrayBuffer, byteOffset, byteLength / 4)

    // Parse the header
    const header = BFast.Header.createFromBuffer(arrayBuffer)
    const rangeBuffer = new Int32Array(arrayBuffer, 32, header.numArrays * 16)

    // Compute each buffer
    const ranges: BFast.Range[] = []
    for (let i = 0; i < header.numArrays; i += 4) {
      ranges.push(new BFast.Range(rangeBuffer[i + 0], rangeBuffer[i + 2]))
    }
    const nameBuffer = new Uint8Array(
      arrayBuffer,
      ranges[0].start,
      ranges[0].count
    )

    const names = new TextDecoder('utf-8')
      .decode(nameBuffer)
      .slice(0, -1)
      .split('\0')

    const map = new Map<string, BFast.Range>()
    for (let i = 0; i < names.length; i++) {
      map.set(names[i], ranges[i + 1])
    }

    return new BFastLocal(arrayBuffer, header, map)
  }
}
