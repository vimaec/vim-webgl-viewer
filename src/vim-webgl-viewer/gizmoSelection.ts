import * as THREE from 'three'
import { Viewer } from './viewer'

export class GizmoSelection {
  private line: THREE.LineSegments
  private viewer: Viewer
  private points: THREE.Vector3[]

  constructor (viewer: Viewer) {
    this.viewer = viewer

    const mat = new THREE.LineBasicMaterial({
      depthTest: false,
      color: new THREE.Color(0, 1, 0)
    })

    // prettier-ignore
    const vertices = new Float32Array([
      -0.5, -0.5, 0,
      0.5, -0.5, 0,

      0.5, -0.5, 0,
      0.5, 0.5, 0,

      0.5, 0.5, 0,
      -0.5, 0.5, 0,

      -0.5, 0.5, 0,
      -0.5, -0.5, 0
    ])

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

    this.line = new THREE.LineSegments(geo, mat)
    this.line.name = 'GizmoSelection'
    this.line.visible = false
    this.viewer.renderer.add(this.line)
  }

  dispose () {
    this.viewer.renderer.remove(this.line)
    this.line.geometry.dispose()
    ;(this.line.material as THREE.Material).dispose()
  }

  get visible () {
    return this.line.visible
  }

  set visible (value: boolean) {
    this.line.visible = value
  }

  update (posA: THREE.Vector2, posB: THREE.Vector2) {
    // Plane perpedicular to camera
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      this.viewer.camera.forward,
      this.viewer.camera.orbitPosition
    )

    // Points intersections with plane
    const A = this.getIntersection(plane, posA)
    const B = this.getIntersection(plane, posB)

    // Center is average of both points.
    const center = A.clone().add(B).multiplyScalar(0.5)

    const [dx, dy] = this.getBoxSize(A, B)
    this.updateRect(center, dx, dy)

    // Keep 4 corners and center for bounding box
    const AB = this.getIntersection(plane, new THREE.Vector2(posA.x, posB.y))
    const BA = this.getIntersection(plane, new THREE.Vector2(posB.x, posA.y))
    this.points = [A, B, AB, BA, center]
  }

  private getIntersection (plane: THREE.Plane, position: THREE.Vector2) {
    const raycaster = this.viewer.raycaster.fromPoint2(position)
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3())
  }

  private updateRect (position: THREE.Vector3, dx: number, dy: number) {
    // Update rectangle transform
    this.line.quaternion.copy(this.viewer.camera.camera.quaternion)
    this.line.position.copy(position)
    this.line.scale.set(dx, dy, 1)
    this.line.updateMatrix()
  }

  private getBoxSize (A: THREE.Vector3, B: THREE.Vector3) {
    const cam = this.viewer.camera
    // Compute the basis components of the projection plane.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      cam.camera.quaternion
    )

    // Transform the 3d positions to 2d on the projection plane.
    const Ax = A.dot(right)
    const Ay = A.dot(up)
    const Bx = B.dot(right)
    const By = B.dot(up)

    // Compute rectangle size
    const dx = Math.abs(Ax - Bx)
    const dy = Math.abs(Ay - By)
    return [dx, dy]
  }

  /**
   * Returns the bounding box of the selection.
   * The bouding box will be the projection of the selection rectangle
   * on the plane coplanar to the closest hit of 5 raycasts as follow:
   * X-----X
   * |  X  |
   * X-----X
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    const position = this.getClosestHit()
    const projections = position ? this.projectPoints(position) : this.points
    return target.setFromPoints(projections)
  }

  /**
   * Raycast from camera to all points, return closest hit position.
   */
  getClosestHit () {
    const hits = this.points
      .map((p) => this.viewer.raycaster.raycast3(p))
      .filter((h) => h.isHit)

    let position: THREE.Vector3
    let dist: number
    hits.forEach((h) => {
      if (dist === undefined || h.distance < dist) {
        dist = h.distance
        position = h.position
      }
    })
    return position
  }

  /**
   * Projects all points on a plane the coplanar to position.
   */
  projectPoints (position: THREE.Vector3) {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      this.viewer.camera.forward,
      position
    )

    return this.points.map((p) => plane.projectPoint(p, new THREE.Vector3()))
  }
}