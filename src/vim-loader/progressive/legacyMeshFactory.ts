// loader
import { VimSettings } from '../vimSettings'
import { InsertableMesh } from './insertableMesh'
import { Scene } from '../../vim'
import { G3dMaterial, G3d, MeshSection } from 'vim-format'
import { InstancedMeshFactory } from './instancedMeshFactory'
import { G3dSubset } from './g3dSubset'

export class LegacyMeshFactory {
  g3d: G3d
  materials: G3dMaterial
  settings: VimSettings
  instancedFactory: InstancedMeshFactory

  constructor (g3d: G3d, materials: G3dMaterial, settings: VimSettings) {
    this.g3d = g3d
    this.materials = materials
    this.settings = settings
    this.instancedFactory = new InstancedMeshFactory(materials)
  }

  createScene () {
    // Apply filters and split meshes to be instanced/merged
    const subset = new G3dSubset(this.g3d).filter(
      this.settings.filterMode,
      this.settings.filter
    )

    const uniques = subset.filterUniqueMeshes()
    const nonUniques = subset.filterNonUniqueMeshes()

    // Create and add meshes to scene
    const scene = new Scene(undefined, this.settings.matrix)
    this.addInstancedMeshes(scene, nonUniques)
    this.addMergedMesh(scene, uniques)
    return scene
  }

  addMergedMesh (scene: Scene, subset: G3dSubset) {
    const opaque = this.createMergedMesh(subset, 'opaque', false)
    const transparents = this.createMergedMesh(subset, 'transparent', true)
    scene.addMesh(opaque)
    scene.addMesh(transparents)
  }

  createMergedMesh (
    subset: G3dSubset,
    section: MeshSection,
    transparent: boolean
  ) {
    const offsets = subset.getOffsets(section)
    const opaque = new InsertableMesh(offsets, this.materials, transparent)

    const count = subset.getMeshCount()
    for (let m = 0; m < count; m++) {
      opaque.insertFromVim(this.g3d, m)
    }

    opaque.update()
    return opaque
  }

  addInstancedMeshes (scene: Scene, subset: G3dSubset) {
    const factory = new InstancedMeshFactory(this.materials)

    const count2 = subset.getMeshCount()
    for (let m = 0; m < count2; m++) {
      const mesh = subset.getSourceMesh(m)
      const instances =
        subset.getMeshInstances(m) ?? this.g3d.meshInstances[mesh]

      const opaque = factory.createOpaqueFromVim(this.g3d, mesh, instances)
      const transparent = factory.createTransparentFromVim(
        this.g3d,
        mesh,
        instances
      )
      scene.addMesh(opaque)
      scene.addMesh(transparent)
    }
  }
}
