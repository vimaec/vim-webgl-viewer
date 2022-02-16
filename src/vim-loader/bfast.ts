/**
 * @module vim-loader
 */

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
    numArrays: number,
    byteLength: number
  ) {
    if (magic !== 0xbfa5) {
      throw new Error('Not a BFAST file, or endianness is swapped')
    }
    if (dataStart <= 32 || dataStart > byteLength) {
      throw new Error('Data start is out of valid range')
    }
    if (dataEnd < dataStart || dataEnd > byteLength) {
      throw new Error('Data end is out of vaid range')
    }
    if (numArrays < 0 || numArrays > dataEnd) {
      throw new Error('Number of arrays is invalid')
    }

    this.magic = magic
    this.dataStart = dataStart
    this.dataEnd = dataEnd
    this.numArrays = numArrays
  }

  static fromArray (array: Int32Array, byteLength: number): BFastHeader {
    // Check validity of data
    // TODO: check endianness

    if (array[1] !== 0) throw new Error('Expected 0 in byte position 0')
    if (array[3] !== 0) throw new Error('Expected 0 in byte position 8')
    if (array[5] !== 0) throw new Error('Expected 0 in position 16')
    if (array[7] !== 0) throw new Error('Expected 0 in position 24')

    return new this(array[0], array[2], array[4], array[6], byteLength)
  }
}

/**
 * BFAST is a data format for simple, efficient, and reliable serialization
 * and deserialization of collections of binary data with optional names as a single block of data.
 * See https://github.com/vimaec/bfast
 */
export class BFast {
  header: BFastHeader
  names: string[]
  buffers: Uint8Array[]

  constructor (header: BFastHeader, names: string[], buffers: Uint8Array[]) {
    this.header = header
    this.names = names
    this.buffers = buffers
  }

  /**
   * Returns a newly constructed bfast instance from parsing the data of arrayBuffer
   * @param bytes an array of bytes from which to construct the bfast
   * @returns a bfast instance
   */
  static fromArray (bytes: Uint8Array): BFast {
    return this.fromArrayBuffer(
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
  static fromArrayBuffer (
    arrayBuffer: ArrayBuffer,
    byteOffset: number = 0,
    byteLength: number = arrayBuffer.byteLength - byteOffset
  ): BFast {
    // Cast the input data to 32-bit integers
    // Note that according to the spec they are 64 bit numbers. In JavaScript you can't have 64 bit integers,
    // and it would bust the amount of memory we can work with in most browsers and low-power devices
    const data = new Int32Array(arrayBuffer, byteOffset, byteLength / 4)

    // Parse the header
    const header = BFastHeader.fromArray(data, byteLength)

    // Compute each buffer
    const buffers: Uint8Array[] = []
    let pos = 8
    for (let i = 0; i < header.numArrays; ++i) {
      const begin = data[pos + 0]
      const end = data[pos + 2]

      // Check validity of data
      if (data[pos + 1] !== 0) {
        throw new Error('Expected 0 in position ' + (pos + 1) * 4)
      }
      if (data[pos + 3] !== 0) {
        throw new Error('Expected 0 in position ' + (pos + 3) * 4)
      }
      if (begin < header.dataStart || begin > header.dataEnd) {
        throw new Error('Buffer start is out of range')
      }
      if (end < begin || end > header.dataEnd) {
        throw new Error('Buffer end is out of range')
      }

      pos += 4
      const buffer = new Uint8Array(
        arrayBuffer,
        begin + byteOffset,
        end - begin
      )
      buffers.push(buffer)
    }

    if (buffers.length < 0) {
      throw new Error('Expected at least one buffer containing the names')
    }

    // break the first one up into names
    const joinedNames = new TextDecoder('utf-8').decode(buffers[0])

    // Removing the trailing '\0' before spliting the names
    let names = joinedNames.slice(0, -1).split('\0')
    if (joinedNames.length === 0) names = []

    // Validate the number of names
    if (names.length !== buffers.length - 1) {
      throw new Error(
        'Expected number of names to be equal to the number of buffers - 1'
      )
    }

    return new BFast(header, names, buffers.slice(1))
  }
}
