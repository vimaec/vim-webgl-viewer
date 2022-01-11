class AttributeDescriptor {
  // original descriptor string
  description: string
  // Indicates the part of the geometry that this attribute is associated with
  association: string
  // the role of the attribute
  semantic: string
  // each attribute type should have it's own index ( you can have uv0, uv1, etc. )
  attributeTypeIndex: string
  // the type of individual values (e.g. int32, float64)
  dataType: string
  // how many values associated with each element (e.g. UVs might be 2, geometry might be 3, quaternions 4, matrices 9 or 16)
  dataArity: number

  constructor (
    description: string,
    association: string,
    semantic: string,
    attributeTypeIndex: string,
    dataType: string,
    dataArity: string
  ) {
    if (!description.startsWith('g3d:')) {
      throw new Error(`${description} must start with 'g3d'`)
    }

    this.description = description
    this.association = association
    this.semantic = semantic
    this.attributeTypeIndex = attributeTypeIndex
    this.dataType = dataType
    this.dataArity = parseInt(dataArity)
  }

  static fromString (descriptor: string): AttributeDescriptor {
    const desc = descriptor.split(':')

    if (desc.length !== 6) {
      throw new Error(`${descriptor}, must have 6 components delimited by ':'`)
    }

    return new this(descriptor, desc[1], desc[2], desc[3], desc[4], desc[5])
  }

  matches (other: AttributeDescriptor) {
    const match = (a: string, b: string) => a === '*' || b === '*' || a === b

    return (
      match(this.association, other.association) &&
      match(this.semantic, other.semantic) &&
      match(this.attributeTypeIndex, other.attributeTypeIndex) &&
      match(this.dataType, other.dataType)
    )
  }
}

class Attribute {
  descriptor: AttributeDescriptor
  bytes: Uint8Array
  data: Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array

  constructor (descriptor: AttributeDescriptor, bytes: Uint8Array) {
    this.descriptor = descriptor
    this.bytes = bytes
    this.data = Attribute.castData(bytes, descriptor.dataType)
  }

  static fromString (descriptor: string, buffer: Uint8Array): Attribute {
    return new this(AttributeDescriptor.fromString(descriptor), buffer)
  }

  // Converts a VIM attribute into a typed array from its raw data
  static castData (
    bytes: Uint8Array,
    dataType: string
  ): Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array {
    // This is a UInt8 array

    switch (dataType) {
      case 'float32':
        return new Float32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 4
        )
      case 'float64':
        throw new Float64Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 8
        )
      case 'int8':
        return bytes
      case 'int16':
        return new Int16Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 2
        )
      case 'int32':
        return new Int32Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 4
        )
      // case "int64": return new Int64Array(data.buffer, data.byteOffset, data.byteLength / 8);
      default:
        throw new Error('Unrecognized attribute data type ' + dataType)
    }
  }
}

class G3d {
  meta: string
  attributes: Attribute[]

  constructor (meta: string, attributes: Attribute[]) {
    this.meta = meta
    this.attributes = attributes
  }

  findAttribute (descriptor: string): Attribute | null {
    const filter = AttributeDescriptor.fromString(descriptor)
    for (let i = 0; i < this.attributes.length; ++i) {
      const attribute = this.attributes[i]
      if (attribute.descriptor.matches(filter)) return attribute
    }
    return null
  }
}

class VimAttributes {
  static position = 'g3d:vertex:position:0:float32:3'
  static indices = 'g3d:corner:index:0:int32:1'
  static instanceMeshes = 'g3d:instance:mesh:0:int32:1'
  static instanceTransforms = 'g3d:instance:transform:0:float32:16'
  static meshSubmeshes = 'g3d:mesh:submeshoffset:0:int32:1'
  static submeshIndexOffsets = 'g3d:submesh:indexoffset:0:int32:1'
  static submeshMaterials = 'g3d:submesh:material:0:int32:1'
  static materialColors = 'g3d:material:color:0:float32:4'
}

class VimG3d {
  positions: Float32Array
  indices: Int32Array
  instanceMeshes: Int32Array
  instanceTransforms: Float32Array
  meshSubmeshes: Int32Array
  submeshIndexOffset: Int32Array
  submeshMaterial: Int32Array
  materialColors: Float32Array
  rawG3d: G3d

  matrixArity = 16
  colorArity = 4
  positionArity = 3

  constructor (g3d: G3d) {
    this.rawG3d = g3d

    this.positions = g3d.findAttribute(VimAttributes.position)
      ?.data as Float32Array

    this.indices = g3d.findAttribute(VimAttributes.indices)?.data as Int32Array

    this.meshSubmeshes = g3d.findAttribute(VimAttributes.meshSubmeshes)
      ?.data as Int32Array

    this.submeshIndexOffset = g3d.findAttribute(
      VimAttributes.submeshIndexOffsets
    )?.data as Int32Array

    this.submeshMaterial = g3d.findAttribute(VimAttributes.submeshMaterials)
      ?.data as Int32Array

    this.materialColors = g3d.findAttribute(VimAttributes.materialColors)
      ?.data as Float32Array

    this.instanceMeshes = g3d.findAttribute(VimAttributes.instanceMeshes)
      ?.data as Int32Array

    this.instanceTransforms = g3d.findAttribute(
      VimAttributes.instanceTransforms
    )?.data as Float32Array
  }

  getInstanceCount = () => this.instanceMeshes.length
  getMeshCount = () => this.meshSubmeshes.length

  getMeshSubmeshRange (mesh: number): [number, number] {
    const start = this.meshSubmeshes[mesh]
    const end =
      mesh < this.meshSubmeshes.length - 1
        ? this.meshSubmeshes[mesh + 1]
        : this.submeshIndexOffset.length
    return [start, end]
  }

  getSubmeshIndexRange (submesh: number): [number, number] {
    const start = this.submeshIndexOffset[submesh]
    const end =
      submesh < this.submeshIndexOffset.length - 1
        ? this.submeshIndexOffset[submesh + 1]
        : this.indices.length

    return [start, end]
  }

  getTransformMatrixAsArray (tranformIndex: number): Float32Array {
    return this.instanceTransforms.subarray(
      tranformIndex * this.matrixArity,
      (tranformIndex + 1) * this.matrixArity
    )
  }

  getMeshReferenceCounts = (): Int32Array => {
    const meshRefCounts = new Int32Array(this.getMeshCount())
    for (let i = 0; i < this.instanceMeshes.length; ++i) {
      const mesh = this.instanceMeshes[i]
      if (mesh < 0) continue
      meshRefCounts[mesh]++
    }
    return meshRefCounts
  }

  /**
   * Creates a map to go from mesh index to instance indices.
   * Note: many instances can share the same mesh.
   * @param instances if defined, return array will only contain values for given instances.
   * @returns a two dimensional such that array[meshIndex] = {instanceIndex1, instanceIndex2, ... }.
   */
  buildMeshIndexToInstanceIndicesMap = (instances?: number[]): number[][] => {
    const meshIndexToInstanceIndices: number[][] = []
    const getOrAdd = (instance) => {
      const mesh = this.instanceMeshes[instance]
      if (mesh < 0) return
      const instanceIndices = meshIndexToInstanceIndices[mesh]
      if (instanceIndices) instanceIndices.push(instance)
      else meshIndexToInstanceIndices[mesh] = [instance]
    }

    if (instances) {
      instances.forEach(getOrAdd)
    } else {
      for (let i = 0; i < this.instanceMeshes.length; i++) {
        getOrAdd(i)
      }
    }

    return meshIndexToInstanceIndices
  }

  validate () {
    const isPresent = (attribute: any, label: string) => {
      if (!attribute) {
        throw new Error(`Missing Attribute Buffer: ${label}`)
      }
    }
    isPresent(this.positions, 'position')
    isPresent(this.indices, 'indices')
    isPresent(this.instanceMeshes, 'instanceMeshes')
    isPresent(this.instanceTransforms, 'instanceTransforms')
    isPresent(this.meshSubmeshes, 'meshSubmeshes')
    isPresent(this.submeshIndexOffset, 'submeshIndexOffset')
    isPresent(this.submeshMaterial, 'submeshMaterial')
    isPresent(this.materialColors, 'materialColors')

    // Basic
    if (this.positions.length % this.positionArity !== 0) {
      throw new Error(
        'Invalid position buffer, must be divisible by ' + this.positionArity
      )
    }

    if (this.indices.length % 3 !== 0) {
      throw new Error('Invalid Index Count, must be divisible by 3')
    }

    for (let i = 0; i < this.indices.length; i++) {
      if (this.indices[i] < 0 || this.indices[i] >= this.positions.length) {
        throw new Error('Vertex index out of bound')
      }
    }

    // Instances
    if (
      this.instanceMeshes.length !==
      this.instanceTransforms.length / this.matrixArity
    ) {
      throw new Error('Instance buffers mismatched')
    }

    if (this.instanceTransforms.length % this.matrixArity !== 0) {
      throw new Error(
        'Invalid InstanceTransform buffer, must respect arity ' +
          this.matrixArity
      )
    }

    for (let i = 0; i < this.instanceMeshes.length; i++) {
      if (this.instanceMeshes[i] >= this.meshSubmeshes.length) {
        throw new Error('Instance Mesh Out of range.')
      }
    }

    // Meshes
    for (let i = 0; i < this.meshSubmeshes.length; i++) {
      if (
        this.meshSubmeshes[i] < 0 ||
        this.meshSubmeshes[i] >= this.submeshIndexOffset.length
      ) {
        throw new Error('MeshSubmeshOffset out of bound at')
      }
    }

    for (let i = 0; i < this.meshSubmeshes.length - 1; i++) {
      if (this.meshSubmeshes[i] >= this.meshSubmeshes[i + 1]) {
        throw new Error('MeshSubmesh out of sequence.')
      }
    }

    // Submeshes
    if (this.submeshIndexOffset.length !== this.submeshMaterial.length) {
      throw new Error('Mismatched submesh buffers')
    }

    for (let i = 0; i < this.submeshIndexOffset.length; i++) {
      if (
        this.submeshIndexOffset[i] < 0 ||
        this.submeshIndexOffset[i] >= this.indices.length
      ) {
        throw new Error('SubmeshIndexOffset out of bound')
      }
    }

    for (let i = 0; i < this.submeshIndexOffset.length; i++) {
      if (this.submeshIndexOffset[i] % 3 !== 0) {
        throw new Error('Invalid SubmeshIndexOffset, must be divisible by 3')
      }
    }

    for (let i = 0; i < this.submeshIndexOffset.length - 1; i++) {
      if (this.submeshIndexOffset[i] >= this.submeshIndexOffset[i + 1]) {
        throw new Error('SubmeshIndexOffset out of sequence.')
      }
    }

    for (let i = 0; i < this.submeshMaterial.length; i++) {
      if (this.submeshMaterial[i] >= this.materialColors.length) {
        throw new Error('submeshMaterial out of bound')
      }
    }

    // Materials
    if (this.materialColors.length % this.colorArity !== 0) {
      throw new Error(
        'Invalid material color buffer, must be divisible by ' + this.colorArity
      )
    }
  }
}

export { VimG3d, G3d, Attribute, AttributeDescriptor }
