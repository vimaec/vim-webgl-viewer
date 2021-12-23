import { BFast, BFastHeader } from './bfast'

export class BFastParser {
  static parseFromArray (bytes: Uint8Array) {
    return this.parseFromBuffer(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  // BFAST is the container format for an array of binary arrays
  static parseFromBuffer (
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
