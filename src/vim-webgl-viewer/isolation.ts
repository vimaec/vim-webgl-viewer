import { Materials, Viewer, Object } from '../vim'
import * as THREE from 'three'

export class Isolation {
  private _viewer: Viewer
  private _shapes: THREE.Mesh[] = []

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  isolate (target: Object | Object[]) {
    this.clearShapes()

    const mats = Materials.getDefaultLibrary()

    // Replace all scene materials
    this._viewer.vims[0].scene.material = mats.ghost

    // Create shapes for targets
    if (target instanceof Object) {
      this.createShape(target, mats.shape)
    } else {
      target.forEach((obj) => this.createShape(obj, mats.shape))
    }

    // Toggle plane
    this._viewer.environment.groundPlane.visible = false
  }

  clear () {
    this._viewer.vims[0].scene.material = undefined
    this.clearShapes()
    this._viewer.environment.groundPlane.visible = true
  }

  private createShape (object: Object, mat: THREE.Material) {
    const geo = object.createGeometry()
    const mesh = new THREE.Mesh(geo, mat)
    this._viewer.renderer.add(mesh)
    this._shapes.push(mesh)
  }

  private clearShapes () {
    this._shapes.forEach((t) => {
      this._viewer.renderer.remove(t)
      t.geometry.dispose()
    })
    this._shapes.length = 0
  }
}
