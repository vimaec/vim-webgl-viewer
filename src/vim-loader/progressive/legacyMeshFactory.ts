/**
 * @module vim-loader
 */

import { InsertableMesh } from './insertableMesh'
import { Scene } from '../../vim-loader/scene'
import { G3dMaterial, G3d, MeshSection } from 'vim-format'
import { InstancedMeshFactory } from './instancedMeshFactory'
import { G3dSubset } from './g3dSubset'

/**
 * Mesh factory to load a standard vim using the progressive pipeline.
 */
export class VimMeshFactory {
  readonly g3d: G3d
  private _materials: G3dMaterial
  private _instancedFactory: InstancedMeshFactory
  private _scene: Scene

  constructor (g3d: G3d, materials: G3dMaterial, scene: Scene) {
    this.g3d = g3d
    this._materials = materials
    this._scene = scene
    this._instancedFactory = new InstancedMeshFactory(materials)
  }

  /**
   * Adds all instances from subset to the scene
   */
  public add (subset: G3dSubset) {
    const uniques = subset.filterUniqueMeshes()
    const nonUniques = subset.filterNonUniqueMeshes()

    // Create and add meshes to scene
    this.addInstancedMeshes(this._scene, nonUniques)
    this.addMergedMesh(this._scene, uniques)
  }

  private addMergedMesh (scene: Scene, subset: G3dSubset) {
    const opaque = this.createMergedMesh(subset, 'opaque', false)
    const transparents = this.createMergedMesh(subset, 'transparent', true)
    scene.addMesh(opaque)
    scene.addMesh(transparents)
  }

  private createMergedMesh (
    subset: G3dSubset,
    section: MeshSection,
    transparent: boolean
  ) {
    const offsets = subset.getOffsets(section)
    const opaque = new InsertableMesh(offsets, this._materials, transparent)

    const count = subset.getMeshCount()
    for (let m = 0; m < count; m++) {
      opaque.insertFromVim(this.g3d, m)
    }

    opaque.update()
    return opaque
  }

  private addInstancedMeshes (scene: Scene, subset: G3dSubset) {
    const count2 = subset.getMeshCount()
    for (let m = 0; m < count2; m++) {
      const mesh = subset.getSourceMesh(m)
      const instances =
        subset.getMeshInstances(m) ?? this.g3d.meshInstances[mesh]

      const opaque = this._instancedFactory.createOpaqueFromVim(
        this.g3d,
        mesh,
        instances
      )
      const transparent = this._instancedFactory.createTransparentFromVim(
        this.g3d,
        mesh,
        instances
      )
      scene.addMesh(opaque)
      scene.addMesh(transparent)
    }
  }
}
