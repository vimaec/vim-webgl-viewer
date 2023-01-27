/**
 * @module vim-loader
 */

import { G3d, MeshSection } from './g3d'
import { Transparency } from './geometry'
import { MeshBuilder } from './meshBuilder'
import { Scene } from './scene'

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
  createFromG3d (
    g3d: G3d,
    transparency: Transparency.Mode = 'all',
    instances: number[] | undefined = undefined
  ): Scene {
    const scene = new Scene(this)

    // Add instanced geometry
    const shared = this.createFromInstanciableMeshes(
      g3d,
      transparency,
      instances
    )
    scene.merge(shared)

    // Add merged geometry
    switch (transparency) {
      case 'all': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, 'opaque', false, instances)
        )
        scene.merge(
          this.createFromMergeableMeshes(g3d, 'transparent', true, instances)
        )
        break
      }
      case 'opaqueOnly': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, 'opaque', false, instances)
        )
        break
      }
      case 'transparentOnly': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, 'transparent', true, instances)
        )
        break
      }
      case 'allAsOpaque': {
        scene.merge(
          this.createFromMergeableMeshes(g3d, 'all', false, instances)
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
  createFromInstanciableMeshes (
    g3d: G3d,
    transparency: Transparency.Mode,
    instances: number[] | undefined = undefined
  ) {
    const meshes = this.meshBuilder.createInstancedMeshes(
      g3d,
      transparency,
      instances
    )
    const scene = new Scene(this)
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
  createFromMergeableMeshes (
    g3d: G3d,
    section: MeshSection,
    transparent: boolean,
    instances?: number[]
  ) {
    const scene = new Scene(this)
    const mesh = this.meshBuilder.createMergedMesh(
      g3d,
      section,
      transparent,
      instances
    )
    if (mesh) scene.addMesh(mesh)
    return scene
  }

  createFromFlag (g3d: G3d, flagTest?: (flag: number) => boolean) {
    const result = []
    const count = g3d.getInstanceCount()
    for (let i = 0; i < count; i++) {
      if (flagTest?.(g3d.instanceFlags[i])) result.push(i)
    }
    return this.createFromG3d(g3d, 'all', result)
  }
}
