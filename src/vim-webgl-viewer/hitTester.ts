import * as THREE from 'three'
import { Mesh, Vector2, Vector3 } from "three"
import { Viewer } from "./viewer"

type ThreeIntersectionList = THREE.Intersection<THREE.Object3D<THREE.Event>>[]

export class HitTestResult {
    mousePosition: Vector2
    doubleClick: boolean
    nodeIndex: number = -1
    instanceId: number = -1
    intersections: ThreeIntersectionList
    isMerged: boolean
    isInstanced: boolean
    elementIndex: number = -1

    // Convenience functions and mnemonics
    get firstHit(): THREE.Intersection<THREE.Object3D<THREE.Event>> { return this.intersections[0] }
    get isHit(): boolean { return !!this.firstHit }
    get distance(): number { return this.firstHit.distance }
    get position(): Vector3 { return this.firstHit.point }
    get objectId(): number { return this.firstHit.object.id }
    get hitFace(): number { return this.firstHit.faceIndex }
}

export class HitTester {
    viewer: Viewer
    raycaster = new THREE.Raycaster()

    constructor(viewer: Viewer) {
        this.viewer = viewer
    }

    onMouseClick(position: Vector2, double: boolean): HitTestResult {
        let r = new HitTestResult()
        r.mousePosition = position
        r.doubleClick = double
        console.time('raycast')
        r.intersections = this.mouseRaycast(position)
        console.timeEnd('raycast')

        const hit = r.firstHit
        if (!!hit) {
            // Merged mesh have node origin of each face encoded in uvs
            if (hit.object.userData.merged && hit.uv !== undefined) {
                r.isMerged = true
                r.nodeIndex = Math.round(hit.uv.x)
                r.elementIndex = this.viewer.getElementIndexFromNodeIndex(r.nodeIndex)
            }
            else
            if (hit.instanceId !== undefined) {
                r.isInstanced = true
                r.elementIndex = this.viewer.getElementIndexFromMeshInstance(hit.object as THREE.InstancedMesh, r.instanceId)
            }
        }
        return r
    }

    mouseRaycast(position: Vector2): ThreeIntersectionList {
        const [width, height] = this.viewer.renderer.getContainerSize()
        const x = (position.x / width) * 2 - 1
        const y = -(position.y / height) * 2 + 1
        this.raycaster.setFromCamera(new Vector2(x, y), this.viewer.camera.camera)
        return this.raycaster.intersectObjects(this.viewer.renderer.meshes)
    }
}

