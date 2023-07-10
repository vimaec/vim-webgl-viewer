import * as THREE from 'three'
import { G3d, G3dMesh, G3dMeshOffsets } from 'vim-format'
import { Vim, VimMaterials } from '../vim'
import { SignalDispatcher } from 'ste-signals'

export class InsertableMesh {
  offsets: G3dMeshOffsets
  mesh: THREE.Mesh
  vim: Vim

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  /**
   * Wether the mesh is merged or not.
   */
  merged: boolean

  /**
   * Wether the mesh is transparent or not.
   */
  transparent: boolean

  get meshes () {
    return this.offsets.meshes
  }

  /**
   * Total bounding box for this mesh.
   */
  get boundingBox () {
    return this.geometry.boundingBox
  }

  /**
   * Set to true to ignore SetMaterial calls.
   */
  ignoreSceneMaterial: boolean

  /**
   * initial material.
   */
  private _material: THREE.Material | THREE.Material[] | undefined

  geometry: InsertableGeometry

  constructor (offsets: G3dMeshOffsets, transparent: boolean) {
    this.offsets = offsets
    this.transparent = transparent
    this.merged = true

    this.geometry = new InsertableGeometry(offsets, transparent)

    this._material = transparent
      ? VimMaterials.getInstance().transparent.material
      : VimMaterials.getInstance().opaque.material

    this.mesh = new THREE.Mesh(this.geometry.geometry, this._material)
    this.mesh.userData.vim = this
  }

  insertAllMesh (g3d: G3dMesh, mesh: number) {
    this.geometry.insert(g3d, mesh)
  }

  update () {
    this.geometry.update()
    this._onUpdate.dispatch()
  }

  /**
   * Returns submesh corresponding to given face on a merged mesh.
   */
  getSubmeshFromFace (faceIndex: number) {
    // TODO: not iterate through all submeshes
    const hitIndex = faceIndex * 3
    for (const [instance, submesh] of this.geometry.submeshes.entries()) {
      if (hitIndex >= submesh.start && hitIndex < submesh.end) {
        return new InsertableSubmesh(this, instance)
      }
    }
  }

  /**
   *
   * @returns Returns all submeshes
   */
  getSubmeshes () {
    return [...this.geometry.submeshes.keys()].map(
      (i) => new InsertableSubmesh(this, i)
    )
  }

  /**
   *
   * @returns Returns all submeshes
   */
  getSubmesh (index: number) {
    return [...this.geometry.submeshes.keys()].map(
      (i) => new InsertableSubmesh(this, i)
    )
  }

  /**
   * Overrides mesh material, set to undefine to restore initial material.
   */
  setMaterial (value: THREE.Material) {
    if (this._material === value) return
    if (this.ignoreSceneMaterial) return

    if (value) {
      if (!this._material) {
        this._material = this.mesh.material
      }
      this.mesh.material = value
    } else {
      if (this._material) {
        this.mesh.material = this._material
        this._material = undefined
      }
    }
  }
}

// TODO Merge both submeshes class.
class GeometrySubmesh {
  geometry: InsertableGeometry
  instance: number
  start: number
  end: number
  boundingBox: THREE.Box3
}

class InsertableGeometry {
  offsets: G3dMeshOffsets

  geometry: THREE.BufferGeometry
  indexAttribute: THREE.Uint32BufferAttribute
  vertexAttribute: THREE.BufferAttribute
  colorAttribute: THREE.BufferAttribute

  submeshes = new Map<number, GeometrySubmesh>()
  boundingBox: THREE.Box3

  // reusable objects to avoid allocs
  vector = new THREE.Vector3()
  matrix = new THREE.Matrix4()

  constructor (offsets: G3dMeshOffsets, transparent: boolean) {
    this.offsets = offsets

    this.indexAttribute = new THREE.Uint32BufferAttribute(
      offsets.counts.indices,
      1
    )

    this.vertexAttribute = new THREE.Float32BufferAttribute(
      offsets.counts.vertices * G3d.POSITION_SIZE,
      G3d.POSITION_SIZE
    )

    const colorSize = transparent ? 4 : 3
    this.colorAttribute = new THREE.Float32BufferAttribute(
      offsets.counts.vertices * colorSize,
      colorSize
    )

    this.indexAttribute.count = 0
    this.vertexAttribute.count = 0
    this.colorAttribute.count = 0

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setIndex(this.indexAttribute)
    this.geometry.setAttribute('position', this.vertexAttribute)
    this.geometry.setAttribute('color', this.colorAttribute)
  }

  // TODO: remove the need for mesh argument.
  insert (g3d: G3dMesh, mesh: number) {
    const section = this.offsets.section
    const indexStart = g3d.getIndexStart(section)
    const indexEnd = g3d.getIndexEnd(section)
    if (indexStart === indexEnd) return

    const vertexStart = g3d.getVertexStart(section)
    const vertexEnd = g3d.getVertexEnd(section)
    const vertexCount = vertexEnd - vertexStart
    const sectionOffset = g3d.getVertexStart(section)

    const subStart = g3d.getSubmeshStart(section)
    const subEnd = g3d.getSubmeshEnd(section)

    const indexOffset = this.offsets.indexOffsets[mesh]
    const vertexOffset = this.offsets.vertexOffsets[mesh]

    let i = 0
    let v = 0
    let c = 0

    // TODO : Improve this when mesh param is removed
    const meshIndex = this.offsets.meshes[mesh]
    const instanceCount = this.offsets.instances
      ? this.offsets.instances.get(meshIndex).length
      : g3d.getInstanceCount()

    for (let instance = 0; instance < instanceCount; instance++) {
      this.matrix.fromArray(g3d.getInstanceMatrix(instance))
      const submesh = new GeometrySubmesh()

      // Sets the first point of the bounding boxes to avoid including (0,0,0)
      this.vector.fromArray(g3d.positions, vertexStart * G3d.POSITION_SIZE)
      this.vector.applyMatrix4(this.matrix)
      const box = new THREE.Box3().set(this.vector, this.vector)

      const index = this.offsets.instances
        ? this.offsets.instances.get(meshIndex)[instance]
        : instance
      submesh.instance = g3d.instanceNodes[index]

      // Append indices
      submesh.start = indexOffset + i
      const vertexMergeOffset = vertexCount * instance
      for (let index = indexStart; index < indexEnd; index++) {
        this.indexAttribute.setX(
          indexOffset + i,
          vertexOffset + vertexMergeOffset + g3d.indices[index] - sectionOffset
        )
        i++
      }
      submesh.end = indexOffset + i

      // Append vertices
      for (let vertex = vertexStart; vertex < vertexEnd; vertex++) {
        this.vector.fromArray(g3d.positions, vertex * G3d.POSITION_SIZE)
        this.vector.applyMatrix4(this.matrix)
        this.vertexAttribute.setXYZ(
          vertexOffset + v,
          this.vector.x,
          this.vector.y,
          this.vector.z
        )
        box.expandByPoint(this.vector)
        v++
      }

      // Append Colors
      for (let sub = subStart; sub < subEnd; sub++) {
        const color = g3d.getSubmeshColor(sub)
        const vCount = g3d.getSubmeshVertexCount(sub)
        for (let subV = 0; subV < vCount; subV++) {
          this.colorAttribute.setXYZ(
            vertexOffset + c,
            color[0],
            color[1],
            color[2]
          )

          if (this.colorAttribute.itemSize === 4) {
            this.colorAttribute.setW(vertexOffset + c, 0.25)
          }
          c++
        }
      }
      this.updateCount(indexOffset + i, vertexOffset + v)

      submesh.boundingBox = box
      this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
      this.submeshes.set(submesh.instance, submesh)
    }
  }

  private updateCount (index: number, vertex: number) {
    this.indexAttribute.count = Math.max(this.indexAttribute.count, index)
    const max = Math.max(vertex, this.vertexAttribute.count)
    this.vertexAttribute.count = max
    this.colorAttribute.count = max
  }

  update () {
    this.geometry.computeBoundingBox()
    this.geometry.computeBoundingSphere()
    this.indexAttribute.needsUpdate = true
    this.vertexAttribute.needsUpdate = true
    this.colorAttribute.needsUpdate = true
  }
}

export class InsertableSubmesh {
  mesh: InsertableMesh
  index: number

  constructor (mesh: InsertableMesh, index: number) {
    this.mesh = mesh
    this.index = index
  }

  /**
   * Returns parent three mesh.
   */
  get three () {
    return this.mesh.mesh
  }

  /**
   * True if parent mesh is merged.
   */
  get merged () {
    return this.mesh.merged
  }

  /**
   * Returns vim instance associated with this submesh.
   */
  get instance () {
    return this.index
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox () {
    return this.mesh.geometry.submeshes.get(this.index).boundingBox
  }

  /**
   * Returns starting position in parent mesh for merged mesh.
   */
  get meshStart () {
    return this.mesh.geometry.submeshes.get(this.index).start
  }

  /**
   * Returns ending position in parent mesh for merged mesh.
   */
  get meshEnd () {
    return this.mesh.geometry.submeshes.get(this.index).end
  }

  /**
   * Returns vim object for this submesh.
   */
  get object () {
    return this.mesh.vim.getObjectFromInstance(this.instance)
  }
}
