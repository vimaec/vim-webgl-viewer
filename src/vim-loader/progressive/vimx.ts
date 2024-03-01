/**
 * @module vim-loader
 */

import { G3dMaterial, RemoteVimx, VimHeader, G3dScene } from 'vim-format'

/**
 * Interface to interact with a vimx
 */
export class Vimx {
  private readonly vimx: RemoteVimx
  readonly scene: G3dScene
  readonly materials: G3dMaterial
  readonly header: VimHeader

  static async fromRemote (vimx: RemoteVimx, downloadMeshes: boolean) {
    if (downloadMeshes) {
      await vimx.bfast.forceDownload()
    }
    const [header, scene, materials] = await Promise.all([
      await vimx.getHeader(),
      await vimx.getScene(),
      await vimx.getMaterials()
    ])

    return new Vimx(vimx, header, scene, materials)
  }

  private constructor (
    vimx: RemoteVimx,
    header: VimHeader,
    scene: G3dScene,
    material: G3dMaterial
  ) {
    this.vimx = vimx
    this.header = header
    this.scene = scene
    this.materials = material
  }

  getMesh (mesh: number) {
    return this.vimx.getMesh(mesh)
  }

  abort () {
    this.vimx.abort()
  }
}
