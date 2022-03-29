import * as BFast from './bfast'
import { RemoteValue } from './remoteValue'

export class BFastRemote implements BFast.IBFast {
  url: string
  offset: number
  name: string
  buffer: ArrayBuffer
  private _header: RemoteValue<BFast.Header>
  private _ranges: RemoteValue<Map<string, BFast.Range>>
  private _children: Map<string, RemoteValue<BFastRemote>>

  constructor (url: string, offset: number = 0, name: string = '') {
    this.url = url
    this.offset = offset
    this.name = name

    this._header = new RemoteValue(() => this.requestHeader(), name + '.header')
    this._children = new Map<string, RemoteValue<BFastRemote>>()
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
    const Ctor = BFast.typeConstructor(type)
    const array = new Ctor(buffer)
    return Array.from(array)
  }

  async getValue (name: string, index: number) {
    const ranges = await this.getRanges()
    const range = ranges.get(name)
    if (!range) return

    const type = name.split(':')[0]
    const size = BFast.typeSize(type)
    const start = range.start + index * size
    const buffer = await this.request(
      new BFast.Range(start, start + size),
      `${name}[${index.toString()}]`
    )
    const Ctor = BFast.typeConstructor(type)
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

    const result = new BFastRemote(
      this.url,
      this.offset + range.start,
      this.name + '.' + name
    )
    result.buffer = this.buffer
    return result
  }

  private async requestRanges () {
    const header = await this.getHeader()
    const buffer = await this.request(
      new BFast.Range(32, 32 + header.numArrays * 16),
      'Ranges'
    )

    // Parse range
    const array = new Uint32Array(buffer)
    const ranges: BFast.Range[] = []
    for (let i = 0; i < array.length; i += 4) {
      ranges.push(new BFast.Range(array[i], array[i + 2]))
    }

    const names = await this.requestNames(ranges[0])
    if (ranges.length !== names.length + 1) {
      throw new Error('Mismatched ranges and names')
    }

    // Map ranges and names
    const map = new Map<string, BFast.Range>()
    for (let i = 0; i < names.length; i++) {
      map.set(names[i], ranges[i + 1])
    }

    return map
  }

  private async requestNames (range: BFast.Range) {
    const buffer = await this.request(range, 'Names')
    const names = new TextDecoder('utf-8').decode(buffer)
    const result = names.slice(0, -1).split('\0')
    return result
  }

  private async requestHeader () {
    const buffer = await this.request(new BFast.Range(0, 32), 'Header')
    const result = BFast.Header.createFromBuffer(buffer)
    return result
  }

  private async request (
    range: BFast.Range,
    label: string
  ): Promise<ArrayBuffer> {
    const buffer =
      this.local(range, label) ??
      (await this.http(range, label)) ??
      (await this.http(undefined, label))
    if (buffer.byteLength > range.count) {
      this.buffer = buffer
    }
    return buffer
  }

  private async http (range: BFast.Range, label: string) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', this.url)
    xhr.responseType = 'arraybuffer'
    const str = `WebRequest ${this.name}.${label}`

    if (range) {
      const start = this.offset + range.start
      const end = this.offset + range.end
      xhr.setRequestHeader('Range', `bytes=${start}-${end - 1}`)
      console.log(`${str} : [${start}, ${end}] of ${this.url}`)
    } else {
      console.log(`${str} of ${this.url}`)
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
      xhr.send()
      xhr.onprogress = (e) => console.log('downloading:' + e.loaded)
      xhr.onload = () => resolve(xhr.response)
      xhr.onerror = (_) => {
        resolve(undefined)
      }
    })
  }

  private local (range: BFast.Range, label: string) {
    if (!this.buffer) return
    console.log(`Returning local ${this.name}.${label}`)
    const start = this.offset + range.start
    const end = this.offset + range.end
    return this.buffer.slice(start, end)
  }
}
