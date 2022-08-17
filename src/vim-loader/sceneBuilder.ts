import { G3d, MeshSection } from './g3d'
import { Transparency } from './geometry'
import { MeshBuilder } from './mesh'
import { Scene } from './scene'

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
      scene.addInstancedMesh(meshes[m])
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
    const mesh = this.meshBuilder.createMergedMesh(
      g3d,
      section,
      transparent,
      instances
    )
    return new Scene(this).addMergedMesh(mesh)
  }
}
