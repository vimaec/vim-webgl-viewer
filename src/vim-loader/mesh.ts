import { Vim } from './vim'

export class Mesh {
  /**
   * the wrapped THREE mesh
   */
  three: THREE.Mesh

  /**
   * Vim file from which this mesh was created.
   */
  vim: Vim | undefined

  /**
   * Wether the mesh is merged or not.
   */
  merged: boolean

  /**
   * Indices of the g3d instances that went into creating the mesh
   */
  instances: number[]

  /**
   * startPosition of each submesh on a merged mesh.
   */
  submeshes: number[]
  /**
   * bounding box of each instance
   */
  boxes: THREE.Box3[]

  /**
   * Set to true to ignore SetMaterial calls.
   */
  ignoreSceneMaterial: boolean

  /**
   * Total bounding box for this mesh.
   */
  boundingBox: THREE.Box3

  /**
   * initial material.
   */
  private _material: THREE.Material | THREE.Material[]

  private constructor (
    mesh: THREE.Mesh,
    instance: number[],
    boxes: THREE.Box3[]
  ) {
    this.three = mesh
    this.three.userData.vim = this
    this.instances = instance
    this.boxes = boxes
    this.boundingBox = this.unionAllBox(boxes)
  }

  private unionAllBox (boxes: THREE.Box3[]) {
    const box = boxes[0].clone()
    for (let i = 1; i < boxes.length; i++) {
      box.union(boxes[i])
    }
    return box
  }

  setMaterial (value: THREE.Material) {
    if (this._material === value) return
    if (this.ignoreSceneMaterial) return

    this._material = value
    if (value) {
      if (!this._material) {
        this._material = this.three.material
      }
      this.three.material = value
    } else {
      if (this._material) {
        this.three.material = this._material
        this._material = undefined
      }
    }
  }

  static createMerged (
    mesh: THREE.Mesh,
    instances: number[],
    boxes: THREE.Box3[],
    submeshes: number[]
  ) {
    const result = new Mesh(mesh, instances, boxes)
    result.merged = true
    result.submeshes = submeshes
    return result
  }

  static createInstanced (
    mesh: THREE.Mesh,
    instances: number[],
    boxes: THREE.Box3[]
  ) {
    const result = new Mesh(mesh, instances, boxes)
    result.merged = false
    return result
  }

  /**
   * Returns submesh for given index.
   */
  getSubMesh (index: number) {
    return new Submesh(this, index)
  }

  /**
   * Returns submesh corresponding to given face on a merged mesh.
   */
  getSubmeshFromFace (faceIndex: number) {
    if (!this.merged) {
      throw new Error('Can only be called when mesh.merged = true')
    }
    const index = this.binarySearch(this.submeshes, faceIndex * 3)
    return new Submesh(this, index)
  }

  /**
   *
   * @returns Returns all submeshes
   */
  getSubmeshes () {
    return this.instances.map((s, i) => new Submesh(this, i))
  }

  private binarySearch (array: number[], element: number) {
    let m = 0
    let n = array.length - 1
    while (m <= n) {
      const k = (n + m) >> 1
      const cmp = element - array[k]
      if (cmp > 0) {
        m = k + 1
      } else if (cmp < 0) {
        n = k - 1
      } else {
        return k
      }
    }
    return m - 1
  }
}

export class Submesh {
  mesh: Mesh
  index: number

  constructor (mesh: Mesh, index: number) {
    this.mesh = mesh
    this.index = index
  }

  /**
   * Returns parent three mesh.
   */
  get three () {
    return this.mesh.three
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
    return this.mesh.instances[this.index]
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox () {
    return this.mesh.boxes[this.index]
  }

  /**
   * Returns starting position in parent mesh for merged mesh.
   */
  get meshStart () {
    return this.mesh.submeshes[this.index]
  }

  /**
   * Returns ending position in parent mesh for merged mesh.
   */
  get meshEnd () {
    return this.index + 1 < this.mesh.submeshes.length
      ? this.mesh.submeshes[this.index + 1]
      : this.three.geometry.index!.count
  }

  /**
   * Returns vim object for this submesh.
   */
  get object () {
    return this.mesh.vim.getObjectFromInstance(this.instance)
  }
}
