import { BFast } from './bfast'
import { BufferGeometry, InstancedMesh, Material, Sphere } from 'three'
import { VimG3d } from './g3d'

// eslint-disable-next-line no-use-before-define
export { Vim, VimScene as BimDocument }

class Vim {
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

class VimScene {
  vim: Vim
  meshes: InstancedMesh<BufferGeometry, Material>[]
  boundingSphere: Sphere

  constructor (
    vim: Vim,
    meshes: InstancedMesh<BufferGeometry, Material>[],
    sphere: Sphere
  ) {
    this.vim = vim
    this.meshes = meshes
    this.boundingSphere = sphere
  }
}
