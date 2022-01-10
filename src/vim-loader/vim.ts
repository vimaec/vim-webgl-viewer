import { BFast } from './bfast'
import { VimG3d } from './g3d'

export type EntityTable = Map<string, ArrayLike<number>>

export class Vim {
  static tableElement = 'Vim.Element'
  static tableElementLegacy = 'Rvt.Element'
  static tableNode = 'Vim.Node'

  header: string
  assets: BFast
  g3d: VimG3d
  entities: Map<string, EntityTable>
  strings: string[]

  constructor (
    header: string,
    assets: BFast,
    g3d: VimG3d,
    entities: Map<string, EntityTable>,
    strings: string[]
  ) {
    this.header = header
    this.assets = assets
    this.g3d = g3d
    this.entities = entities
    this.strings = strings
  }

  getEntity (type: string, index: number): any {
    const r = {}
    if (index < 0) return {}
    const table = this.entities?.get(type)
    for (const k of table.keys()) {
      const parts = k.split(':')
      let val: number | string = table.get(k)[index]
      if (parts[0] === 'string') {
        val = this.strings[val]
      }
      const name = parts[parts.length - 1]
      r[name] = val
    }
    return r
  }
}
