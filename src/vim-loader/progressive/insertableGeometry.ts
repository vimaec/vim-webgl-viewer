import * as THREE from 'three'
import {
  G3d,
  G3dMesh, G3dMaterial,
  MeshOffsets
} from 'vim-format'

// TODO Merge both submeshes class.
export class GeometrySubmesh {
  geometry: InsertableGeometry
  instance: number
  start: number
  end: number
  boundingBox: THREE.Box3
}

export class InsertableGeometry {
  materials: G3dMaterial
  offsets: MeshOffsets
  geometry: THREE.BufferGeometry
  submeshes = new Map<number, GeometrySubmesh>()
  boundingBox: THREE.Box3

  private _indexAttribute: THREE.Uint32BufferAttribute
  private _vertexAttribute: THREE.BufferAttribute
  private _colorAttribute: THREE.BufferAttribute

  private _updatedMeshes = 0
  private _meshToUpdate = new Set<number>()

  // reusable objects to avoid allocs
  private _vector = new THREE.Vector3()
  private _matrix = new THREE.Matrix4()

  constructor (
    offsets: MeshOffsets,
    materials: G3dMaterial,
    transparent: boolean
  ) {
    this.offsets = offsets
    this.materials = materials

    this._indexAttribute = new THREE.Uint32BufferAttribute(
      offsets.counts.indices,
      1
    )

    this._vertexAttribute = new THREE.Float32BufferAttribute(
      offsets.counts.vertices * G3d.POSITION_SIZE,
      G3d.POSITION_SIZE
    )

    const colorSize = transparent ? 4 : 3
    this._colorAttribute = new THREE.Float32BufferAttribute(
      offsets.counts.vertices * colorSize,
      colorSize
    )

    this._indexAttribute.count = 0
    this._vertexAttribute.count = 0
    this._colorAttribute.count = 0

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setIndex(this._indexAttribute)
    this.geometry.setAttribute('position', this._vertexAttribute)
    this.geometry.setAttribute('color', this._colorAttribute)
  }

  get progress () {
    return this._indexAttribute.count / this._indexAttribute.array.length
  }

  // TODO: remove the need for mesh argument.
  insert (g3d: G3dMesh, mesh: number) {
    const section = this.offsets.section
    const indexStart = g3d.getIndexStart(section)
    const indexEnd = g3d.getIndexEnd(section)
    if (indexStart === indexEnd) {
      this._meshToUpdate.add(mesh)
      return
    }

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

    const instanceCount = this.offsets.getMeshInstanceCount(mesh)
    for (let instance_i = 0; instance_i < instanceCount; instance_i++) {
      const instance = this.offsets.getMeshInstance(mesh, instance_i)
      this._matrix.fromArray(g3d.getInstanceMatrix(instance))
      const submesh = new GeometrySubmesh()
      submesh.instance = g3d.instanceNodes[instance]

      // Sets the first point of the bounding boxes to avoid including (0,0,0)
      this._vector.fromArray(g3d.positions, vertexStart * G3d.POSITION_SIZE)
      this._vector.applyMatrix4(this._matrix)
      const box = new THREE.Box3().set(this._vector, this._vector)

      // Append indices
      submesh.start = indexOffset + i
      const vertexMergeOffset = vertexCount * instance_i
      for (let index = indexStart; index < indexEnd; index++) {
        this._indexAttribute.setX(
          indexOffset + i,
          vertexOffset + vertexMergeOffset + g3d.indices[index] - sectionOffset
        )
        i++
      }
      submesh.end = indexOffset + i

      // Append vertices
      for (let vertex = vertexStart; vertex < vertexEnd; vertex++) {
        this._vector.fromArray(g3d.positions, vertex * G3d.POSITION_SIZE)
        this._vector.applyMatrix4(this._matrix)
        this._vertexAttribute.setXYZ(
          vertexOffset + v,
          this._vector.x,
          this._vector.y,
          this._vector.z
        )
        box.expandByPoint(this._vector)
        v++
      }

      // Append Colors
      for (let sub = subStart; sub < subEnd; sub++) {
        const color = this.materials.getMaterialColor(g3d.submeshMaterial[sub])
        const vCount = g3d.getSubmeshVertexCount(sub)
        for (let subV = 0; subV < vCount; subV++) {
          this._colorAttribute.setXYZ(
            vertexOffset + c,
            color[0],
            color[1],
            color[2]
          )

          if (this._colorAttribute.itemSize === 4) {
            this._colorAttribute.setW(vertexOffset + c, 0.25)
          }
          c++
        }
      }

      submesh.boundingBox = box
      this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
      this.submeshes.set(submesh.instance, submesh)
    }
    this._meshToUpdate.add(mesh)
  }

  // TODO: remove the need for mesh argument.
  insertFromVim (g3d: G3d, mesh: number) {
    const vector = new THREE.Vector3()
    const matrix = new THREE.Matrix4()
    const instances = g3d.meshInstances[mesh]
    if (!instances) {
      this._meshToUpdate.add(mesh)
      return
    }
    const indexOffset = this.offsets.indexOffsets[mesh]
    const vertexOffset = this.offsets.vertexOffsets[mesh]

    const subStart = g3d.getMeshSubmeshStart(mesh, this.offsets.section)
    const subEnd = g3d.getMeshSubmeshEnd(mesh, this.offsets.section)

    const vStart = g3d.getMeshVertexStart(mesh)
    const vEnd = g3d.getMeshVertexEnd(mesh)
    const vCount = vEnd - vStart

    let indexOut = 0
    let vertexOut = 0
    for (let instance_i = 0; instance_i < instances.length; instance_i++) {
      const mergeOffset = instance_i * vCount
      const instance = instances[instance_i]

      const submesh = new GeometrySubmesh()
      submesh.instance = instance

      matrix.fromArray(g3d.getInstanceMatrix(instance))

      for (let sub = subStart; sub < subEnd; sub++) {
        const color = new THREE.Color().fromArray(g3d.getSubmeshColor(sub))
        const alpha = g3d.getSubmeshAlpha(sub)

        const iStart = g3d.getSubmeshIndexStart(sub)
        const iEnd = g3d.getSubmeshIndexEnd(sub)

        submesh.start = indexOffset + indexOut
        for (let i = iStart; i < iEnd; i++) {
          this._indexAttribute.setX(
            indexOffset + indexOut,
            vertexOffset + mergeOffset + g3d.indices[i]
          )
          indexOut++
        }
        submesh.end = indexOffset + indexOut

        for (let v = vStart; v < vEnd; v++) {
          vector.fromArray(g3d.positions, v * G3d.POSITION_SIZE)
          vector.applyMatrix4(matrix)
          this._vertexAttribute.setXYZ(
            vertexOffset + vertexOut,
            vector.x,
            vector.y,
            vector.z
          )

          this._colorAttribute.setXYZ(
            vertexOffset + vertexOut,
            color.r,
            color.g,
            color.b
          )

          if (this._colorAttribute.itemSize === 4) {
            this._colorAttribute.setW(vertexOffset + vertexOut, alpha)
          }

          vertexOut++
        }
      }
      this.submeshes.set(instance, submesh)
    }

    this._meshToUpdate.add(mesh)
  }

  update () {
    // Compute mesh update range
    let meshEnd = this._updatedMeshes
    while (this._meshToUpdate.has(meshEnd)) {
      this._meshToUpdate.delete(meshEnd)
      meshEnd++
    }
    if (meshEnd === this._updatedMeshes) return
    // Compute index update range
    const indexStart = this.offsets.indexOffsets[this._updatedMeshes]
    const indexEnd =
      meshEnd < this.offsets.counts.meshes
        ? this.offsets.indexOffsets[meshEnd]
        : this.offsets.counts.indices

    // updated indices

    this._indexAttribute.updateRange.offset = indexStart
    this._indexAttribute.updateRange.count = indexEnd - indexStart

    this._indexAttribute.count = indexEnd
    this._indexAttribute.needsUpdate = true

    // Compute vertex update range
    const vertexStart = this.offsets.vertexOffsets[this._updatedMeshes]
    const vertexEnd =
      meshEnd < this.offsets.counts.meshes
        ? this.offsets.vertexOffsets[meshEnd]
        : this.offsets.counts.vertices

    // update vertices

    this._vertexAttribute.updateRange.offset =
      vertexStart * this._vertexAttribute.itemSize
    this._vertexAttribute.updateRange.count =
      (vertexEnd - vertexStart) * this._vertexAttribute.itemSize

    this._vertexAttribute.count = vertexEnd
    this._vertexAttribute.needsUpdate = true

    // update colors

    this._colorAttribute.updateRange.offset =
      vertexStart * this._colorAttribute.itemSize
    this._colorAttribute.updateRange.count =
      (vertexEnd - vertexStart) * this._colorAttribute.itemSize

    this._colorAttribute.count = vertexEnd
    this._colorAttribute.needsUpdate = true

    this._updatedMeshes = meshEnd
    this.geometry.computeBoundingBox()
    this.geometry.computeBoundingSphere()
  }
}
