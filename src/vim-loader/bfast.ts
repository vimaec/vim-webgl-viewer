class BFastHeader {
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

class BFast {
  header: BFastHeader
  names: string[]
  buffers: Uint8Array[]

  constructor (header: BFastHeader, names: string[], buffers: Uint8Array[]) {
    this.header = header
    this.names = names
    this.buffers = buffers
  }
}

export { BFastHeader, BFast }
