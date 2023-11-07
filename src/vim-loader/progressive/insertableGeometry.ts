import * as THREE from 'three'
import { G3d, G3dMesh, G3dMaterial } from 'vim-format'
import { Scene } from '../scene'
import { G3dMeshOffsets } from './g3dOffsets'

// TODO Merge both submeshes class.
export class GeometrySubmesh {
  instance: number
  start: number
  end: number
  boundingBox = new THREE.Box3()

  expandBox (point: THREE.Vector3) {
    this.boundingBox =
      this.boundingBox?.expandByPoint(point) ??
      new THREE.Box3().set(point, point)
  }
}

export class InsertableGeometry {
  _scene: Scene
  materials: G3dMaterial
  offsets: G3dMeshOffsets
  geometry: THREE.BufferGeometry
  submeshes = new Array<GeometrySubmesh>()
  boundingBox: THREE.Box3

  private _computeBoundingBox = false
  private _indexAttribute: THREE.Uint32BufferAttribute
  private _vertexAttribute: THREE.BufferAttribute
  private _colorAttribute: THREE.BufferAttribute

  private _updateStartMesh = 0
  private _updateEndMesh = 0
  private _meshToUpdate = new Set<number>()

  constructor (
    offsets: G3dMeshOffsets,
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

    this.boundingBox = offsets.subset.getBoundingBox()
    if (this.boundingBox) {
      this.geometry.boundingBox = this.boundingBox
      this.geometry.boundingSphere = new THREE.Sphere()
      this.boundingBox.getBoundingSphere(this.geometry.boundingSphere)
    } else {
      this._computeBoundingBox = true
    }
  }

  get progress () {
    return this._indexAttribute.count / this._indexAttribute.array.length
  }

  // TODO: remove the need for mesh argument.
  insert (g3d: G3dMesh, mesh: number) {
    const added = new Array<number>()
    const section = this.offsets.section
    const indexStart = g3d.getIndexStart(section)
    const indexEnd = g3d.getIndexEnd(section)

    // Skip empty mesh
    if (indexStart === indexEnd) {
      this._meshToUpdate.add(mesh)
      return added
    }

    // Reusable matrix and vector3 to avoid allocations
    const matrix = new THREE.Matrix4()
    const vector = new THREE.Vector3()

    const vertexStart = g3d.getVertexStart(section)
    const vertexEnd = g3d.getVertexEnd(section)
    const vertexCount = vertexEnd - vertexStart
    const sectionOffset = g3d.getVertexStart(section)

    const subStart = g3d.getSubmeshStart(section)
    const subEnd = g3d.getSubmeshEnd(section)

    const indexOffset = this.offsets.getIndexOffset(mesh)
    const vertexOffset = this.offsets.getVertexOffset(mesh)

    let indexOut = 0
    let vertexOut = 0
    let colorOut = 0

    const instanceCount = this.offsets.getMeshInstanceCount(mesh)
    for (let instance_i = 0; instance_i < instanceCount; instance_i++) {
      const instance = this.offsets.getMeshInstance(mesh, instance_i)
      matrix.fromArray(g3d.getInstanceMatrix(instance))
      const submesh = new GeometrySubmesh()
      submesh.instance = g3d.getBimInstance(instance)

      // Append indices
      submesh.start = indexOffset + indexOut
      const vertexMergeOffset = vertexCount * instance_i
      for (let index = indexStart; index < indexEnd; index++) {
        this.setIndex(
          indexOffset + indexOut,
          vertexOffset + vertexMergeOffset + g3d.indices[index] - sectionOffset
        )
        indexOut++
      }
      submesh.end = indexOffset + indexOut

      // Append vertices
      for (let vertex = vertexStart; vertex < vertexEnd; vertex++) {
        vector.fromArray(g3d.positions, vertex * G3d.POSITION_SIZE)
        vector.applyMatrix4(matrix)
        this.setVertex(vertexOffset + vertexOut, vector)
        // submesh.expandBox(vector)
        vertexOut++
      }

      // Append Colors
      for (let sub = subStart; sub < subEnd; sub++) {
        const color = this.materials.getMaterialColor(g3d.submeshMaterial[sub])
        const vertexCount = g3d.getSubmeshVertexCount(sub)
        for (let v = 0; v < vertexCount; v++) {
          this.setColor(vertexOffset + colorOut, color, 0.25)
          colorOut++
        }
      }

      submesh.boundingBox.min.fromArray(g3d.getInstanceMin(instance))
      submesh.boundingBox.max.fromArray(g3d.getInstanceMax(instance))
      this.submeshes.push(submesh)
      added.push(this.submeshes.length - 1)
    }
    this._meshToUpdate.add(mesh)
    return added
  }

  insertFromG3d (g3d: G3d, mesh: number) {
    const added = new Array<number>()
    const meshG3dIndex = this.offsets.getMesh(mesh)
    const subStart = g3d.getMeshSubmeshStart(meshG3dIndex, this.offsets.section)
    const subEnd = g3d.getMeshSubmeshEnd(meshG3dIndex, this.offsets.section)

    // Skip empty mesh
    if (subStart === subEnd) {
      this._meshToUpdate.add(mesh)
      return added
    }

    // Reusable matrix and vector3 to avoid allocations
    const matrix = new THREE.Matrix4()
    const vector = new THREE.Vector3()

    // Offsets for this mesh and all its instances
    const indexOffset = this.offsets.getIndexOffset(mesh)
    const vertexOffset = this.offsets.getVertexOffset(mesh)

    // Vertex range in the full g3d
    const vertexStart = g3d.getMeshVertexStart(meshG3dIndex)
    const vertexEnd = g3d.getMeshVertexEnd(meshG3dIndex)
    const vertexCount = vertexEnd - vertexStart

    let indexOut = 0
    let vertexOut = 0
    // Iterate over all included instances for this mesh.
    const instanceCount = this.offsets.getMeshInstanceCount(mesh)
    for (let instance = 0; instance < instanceCount; instance++) {
      const g3dInstance = this.offsets.getMeshInstance(mesh, instance)
      matrix.fromArray(g3d.getInstanceMatrix(g3dInstance))

      const submesh = new GeometrySubmesh()
      submesh.instance = g3d.instanceNodes[g3dInstance]
      submesh.start = indexOffset + indexOut

      const mergeOffset = instance * vertexCount
      for (let sub = subStart; sub < subEnd; sub++) {
        const color = g3d.getSubmeshColor(sub)

        const indexStart = g3d.getSubmeshIndexStart(sub)
        const indexEnd = g3d.getSubmeshIndexEnd(sub)

        // Merge all indices for this instance
        // Color referenced indices according to current submesh
        for (let index = indexStart; index < indexEnd; index++) {
          const v = vertexOffset + mergeOffset + g3d.indices[index]
          this.setIndex(indexOffset + indexOut, v)
          this.setColor(v, color, 0.25)
          indexOut++
        }
      }

      // Transform and merge vertices
      for (let vertex = vertexStart; vertex < vertexEnd; vertex++) {
        vector.fromArray(g3d.positions, vertex * G3d.POSITION_SIZE)
        vector.applyMatrix4(matrix)
        this.setVertex(vertexOffset + vertexOut, vector)
        submesh.expandBox(vector)
        vertexOut++
      }

      submesh.end = indexOffset + indexOut
      this.expandBox(submesh.boundingBox)
      this.submeshes.push(submesh)
      added.push(this.submeshes.length - 1)
    }

    this._meshToUpdate.add(mesh)
    return added
  }

  private setIndex (index: number, value: number) {
    this._indexAttribute.setX(index, value)
  }

  private setVertex (index: number, vector: THREE.Vector3) {
    this._vertexAttribute.setXYZ(index, vector.x, vector.y, vector.z)
  }

  private setColor (index: number, color: Float32Array, alpha: number) {
    this._colorAttribute.setXYZ(index, color[0], color[1], color[2])
    if (this._colorAttribute.itemSize === 4) {
      this._colorAttribute.setW(index, alpha)
    }
  }

  private expandBox (box: THREE.Box3) {
    if (!box) return
    this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
  }

  flushUpdate () {
    // Makes sure that the update range has reached the renderer.
    this._updateStartMesh = this._updateEndMesh
  }

  update () {
    // Update up to the mesh for which all preceding meshes are ready
    while (this._meshToUpdate.has(this._updateEndMesh)) {
      this._meshToUpdate.delete(this._updateEndMesh)
      this._updateEndMesh++
    }

    if (this._updateStartMesh === this._updateEndMesh) return

    // Compute index update range
    const indexStart = this.offsets.getIndexOffset(this._updateStartMesh)
    const indexEnd = this.offsets.getIndexOffset(this._updateEndMesh)

    // updated indices
    this._indexAttribute.updateRange.offset = indexStart
    this._indexAttribute.updateRange.count = indexEnd - indexStart
    this._indexAttribute.count = indexEnd
    this._indexAttribute.needsUpdate = true

    // Compute vertex update range
    const vertexStart = this.offsets.getVertexOffset(this._updateStartMesh)
    const vertexEnd = this.offsets.getVertexOffset(this._updateEndMesh)

    // update vertices
    const vSize = this._vertexAttribute.itemSize
    this._vertexAttribute.updateRange.offset = vertexStart * vSize
    this._vertexAttribute.updateRange.count = (vertexEnd - vertexStart) * vSize
    this._vertexAttribute.count = vertexEnd
    this._vertexAttribute.needsUpdate = true

    // update colors
    const cSize = this._colorAttribute.itemSize
    this._colorAttribute.updateRange.offset = vertexStart * cSize
    this._colorAttribute.updateRange.count = (vertexEnd - vertexStart) * cSize

    this._colorAttribute.count = vertexEnd
    this._colorAttribute.needsUpdate = true

    if (this._computeBoundingBox) {
      this.geometry.computeBoundingBox()
      this.geometry.computeBoundingSphere()
    }
  }
}
