import * as THREE from 'three'
import { Scene } from '../vim-loader/scene'

export class RenderScene {
  scene: THREE.Scene

  // state
  private _scenes: Scene[] = []
  private _boundingBox: THREE.Box3 | undefined

  constructor () {
    this.scene = new THREE.Scene()
  }

  /**
   * Returns the bounding sphere encompasing all rendererd objects.
   * @param target sphere in which to copy result, a new instance is created if undefined.
   */
  getBoundingSphere (target: THREE.Sphere = new THREE.Sphere()) {
    return (
      this._boundingBox?.getBoundingSphere(target) ??
      target.set(new THREE.Vector3(0, 0, 0), 1)
    )
  }

  /**
   * Returns the bounding box encompasing all rendererd objects.
   * @param target box in which to copy result, a new instance is created if undefined.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._boundingBox
      ? target.copy(this._boundingBox)
      : target.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
  }

  /**
   * Add object to be rendered
   */
  add (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.addScene(target)
    } else {
      this.scene.add(target)
    }
  }

  /**
   * Remove object from rendering
   */
  remove (target: Scene | THREE.Object3D) {
    if (target instanceof Scene) {
      this.removeScene(target)
    } else {
      this.scene.remove(target)
    }
  }

  /**
   * Removes all rendered objects
   */
  clear () {
    this.scene.clear()
    this._boundingBox = undefined
  }

  private addScene (scene: Scene) {
    this._scenes.push(scene)
    scene.meshes.forEach((m) => {
      this.scene.add(m)
    })

    // Recompute bounding box
    this._boundingBox = this._boundingBox
      ? this._boundingBox.union(scene.getBoundingBox())
      : scene.getBoundingBox()
  }

  private removeScene (scene: Scene) {
    // Remove from array
    this._scenes = this._scenes.filter((f) => f !== scene)

    // Remove all meshes from three scene
    for (let i = 0; i < scene.meshes.length; i++) {
      this.scene.remove(scene.meshes[i])
    }

    // Recompute bounding box
    this._boundingBox =
      this._scenes.length > 0
        ? this._scenes
          .map((s) => s.getBoundingBox())
          .reduce((b1, b2) => b1.union(b2))
        : undefined
  }
}
