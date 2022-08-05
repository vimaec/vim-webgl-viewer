import { G3d } from './g3d'
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

    // Add shared geometry
    const shared = this.createFromInstanciableMeshes(
      g3d,
      transparency,
      instances
    )
    scene.merge(shared)

    // Add unique opaque geometry
    if (transparency !== 'transparentOnly') {
      const opaque = this.createFromMergeableMeshes(
        g3d,
        transparency === 'allAsOpaque' ? 'allAsOpaque' : 'opaqueOnly',
        instances
      )
      if (opaque) scene.merge(opaque)
    }

    // Add unique transparent geometry
    if (Transparency.isTransparent(transparency)) {
      const transparent = this.createFromMergeableMeshes(
        g3d,
        'transparentOnly',
        instances
      )
      if (transparent) scene.merge(transparent)
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
    transparency: Transparency.Mode,
    instances: number[] | undefined = undefined
  ) {
    const mesh = this.meshBuilder.createMergedMesh(g3d, transparency, instances)
    if (!mesh) return
    return new Scene(this).addMergedMesh(mesh)
  }
}
