import { BFast } from './bfast'
import { VimG3d } from './g3d'

export class Vim {
  static tableElement = 'Vim.Element'
  static tableElementLegacy = 'Rvt.Element'
  static tableNode = 'Vim.Node'

  header: string
  assets: BFast
  g3d: VimG3d
  bim: any
  strings: string[]

  constructor (
    header: string,
    assets: BFast,
    g3d: VimG3d,
    entities: any,
    strings: string[]
  ) {
    this.header = header
    this.assets = assets
    this.g3d = g3d
    this.bim = entities
    this.strings = strings
  }
}
