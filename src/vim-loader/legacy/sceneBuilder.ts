/**
 * @module vim-loader
 */

import { G3d, MeshSection } from 'vim-format'
import { MergeArgs, Transparency } from '../geometry'
import { InstancingArgs, MeshBuilder } from './meshBuilder'
import { Scene } from '../scene'
import { VimSettings, VimPartialSettings } from '../vimSettings'

/**
 * Creates meshes and returns them as a scene from a g3d.
 */
export class SceneBuilder {
  readonly meshBuilder: MeshBuilder

  constructor (meshBuilder?: MeshBuilder) {
    this.meshBuilder = meshBuilder ?? new MeshBuilder()
  }

  /**
   * Creates a new Scene from a g3d by merging mergeble meshes and instancing instantiable meshes
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the Scene. All if undefined.
   */
  createFromG3d (g3d: G3d, settings: VimSettings): Scene {
    const scene = new Scene(this, settings.matrix)

    // Add instanced geometry
    const shared = this.createFromInstanciableMeshes(g3d, { ...settings })
    scene.merge(shared)

    // Add merged geometry
    switch (settings.transparency) {
      case 'all': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, {
            ...settings,
            section: 'opaque',
            transparent: false
          })
        )
        scene.merge(
          this.createFromMergeableMeshes(g3d, {
            ...settings,
            section: 'transparent',
            transparent: true
          })
        )
        break
      }
      case 'opaqueOnly': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, {
            ...settings,
            section: 'opaque',
            transparent: false
          })
        )
        break
      }
      case 'transparentOnly': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, {
            ...settings,
            section: 'transparent',
            transparent: true
          })
        )
        break
      }
      case 'allAsOpaque': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, {
            ...settings,
            section: 'all',
            transparent: false
          })
        )
        break
      }
    }

    return scene
  }

  /**
   * Creates a Scene from instantiable meshes from the g3d
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the Scene. All if undefined.
   * @param builder optional builder to reuse the same materials
   */
  createFromInstanciableMeshes (g3d: G3d, args: InstancingArgs) {
    const meshes = this.meshBuilder.createInstancedMeshes(g3d, args)
    const scene = new Scene(this, args.matrix)
    for (let m = 0; m < meshes.length; m++) {
      scene.addMesh(meshes[m])
    }
    return scene
  }

  // g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
  /**
   * Creates a Scene from mergeable meshes from the g3d
   * @param transparency Specify whether color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the Scene. All if undefined.
   * @param builder optional builder to reuse the same materials
   */
  createFromMergeableMeshes (g3d: G3d, args: MergeArgs) {
    const scene = new Scene(this, args.matrix)
    const mesh = this.meshBuilder.createMergedMesh(g3d, args)
    if (mesh) scene.addMesh(mesh)
    return scene
  }
}
