import * as THREE from 'three'
import { HitTestResult } from '../vim'

// TODO Finish this.
export class GizmoMeasure {
  private _viewer

  first: THREE.Mesh
  second: THREE.Mesh
  line: THREE.Line
  ballMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0, 0.75, 1)
  })

  measure () {
    if (this.first) {
      this._viewer.renderer.remove(this.first)
      this.first.geometry.dispose()
      this.first = undefined
    }
    if (this.second) {
      this._viewer.renderer.remove(this.second)
      this.second.geometry.dispose()
      this.second = undefined
    }

    if (this.line) {
      this._viewer.renderer.remove(this.line)
      this.line.geometry.dispose()
      this.line = undefined
    }

    const old = this._viewer.onMouseClick
    this._viewer.onMouseClick = (hit) => {
      if (!hit.object) return
      this.measureFirstClick(hit)
      this._viewer.onMouseClick = (hit) => {
        if (!hit.object) return
        this.measureSecondClick(hit)
        this._viewer.onMouseClick = old
      }
    }
  }

  measureFirstClick (hit: HitTestResult) {
    const g = new THREE.SphereGeometry(1)
    const m = new THREE.Mesh(g, this.ballMat)
    m.position.copy(hit.position)
    this.first = m
    this._viewer.renderer.add(this.first)
  }

  measureSecondClick (hit: HitTestResult) {
    const g = new THREE.SphereGeometry(1)
    const m = new THREE.Mesh(g, this.ballMat)
    m.position.copy(hit.position)
    this.second = m
    this._viewer.renderer.add(this.second)

    const points = new THREE.BufferGeometry().setFromPoints([
      this.first.position,
      this.second.position
    ])
    this.line = new THREE.Line(points)
    this._viewer.renderer.add(this.line)

    console.log(
      `Distance: ${this.first.position.distanceTo(this.second.position)}`
    )
    console.log(
      `
      X: ${this.first.position.x - this.second.position.x},
      Y: ${this.first.position.y - this.second.position.y},
      Z: ${this.first.position.z - this.second.position.z} 
      `
    )
  }
}
