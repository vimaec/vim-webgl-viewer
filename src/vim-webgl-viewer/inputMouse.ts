import * as THREE from 'three'
import { ViewerCamera } from './viewerCamera'
import { Viewer } from './viewer'
import { Mesh, Vector2 } from 'three'

export class InputMouse {
  // Consts
  // MouseMoveSensitivity: number = 0.05
  // MouseRotateSensitivity: number = 0.2
  // MouseScrollSensitivity: number = 0.02

  // Dependencies
  private camera: ViewerCamera
  private canvas: HTMLCanvasElement
  private viewer: Viewer

  // State
  private isMouseDown: Boolean = false
  private hasMouseMoved: Boolean = false
  private ctrlDown: Boolean = false

  constructor (camera: ViewerCamera, canvas: HTMLCanvasElement, viewer: Viewer) {
    this.camera = camera
    this.canvas = canvas
    this.viewer = viewer
  }

  reset = () => {
    this.isMouseDown = this.hasMouseMoved = this.ctrlDown = false
  }

  setCtrl = (value: Boolean) => {
    this.ctrlDown = value
  }

  onMouseMove = (event: any) => {
    if (!this.isMouseDown) {
      return
    }
    this.hasMouseMoved = true

    event.preventDefault()

    // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
    const deltaX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0
    const deltaY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0
    const delta = new THREE.Vector2(
      deltaX / window.innerWidth,
      deltaY / window.innerHeight
    )

    if (event.buttons & 2) {
      this.camera.panCameraBy(delta)
    } else {
      // delta.multiplyScalar(this.MouseRotateSensitivity)
      this.camera.rotateCameraBy(delta)
    }
  }

  onMouseWheel = (event: any) => {
    event.preventDefault()
    event.stopPropagation()

    // Value of event.deltaY will change from browser to browser
    // https://stackoverflow.com/questions/38942821/wheel-event-javascript-give-inconsistent-values
    // Thus we only use the direction of the valuw
    const scrollValue = Math.sign(event.deltaY)

    if (this.ctrlDown) {
      this.camera.SpeedMultiplier -= scrollValue
    } else if (this.camera.MouseOrbit) {
      this.camera.updateOrbitalDistance(-scrollValue)
    } else {
      const impulse = new THREE.Vector3(0, 0, scrollValue)
      this.camera.applyLocalImpulse(impulse)
    }
  }

  onMouseDown = (event: any) => {
    event.preventDefault()
    this.isMouseDown = true
    this.hasMouseMoved = false

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.canvas.focus ? this.canvas.focus() : window.focus()
  }

  onMouseUp = (event: any) => {
    if (this.isMouseDown && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.x, event.y))
    }
    this.isMouseDown = false
  }

  onMouseClick = (position: Vector2) => {
    // Find geometry and bim data at mouse position
    console.time('raycast')
    const hits = this.mouseRaycast(position)
    console.timeEnd('raycast')
    const result = this.findHitMeshIndex(hits)

    // No hit
    if (result === null) {
      this.viewer.clearSelection()
      return
    }

    // Hit a merged mesh, we get node index
    if (typeof result === 'number') {
      const element = this.viewer.getElementIndexFromNodeIndex(result)
      if (element) this.viewer.selectByElementIndex(element)
      else {
        console.error('Could not find elment for node index: ' + result)
      }
      return
    }

    // Hit a an instances mesh, we get mesh and index
    const element = this.viewer.getElementIndexFromMeshInstance(
      result[0],
      result[1]
    )
    if (element) this.viewer.selectByElementIndex(element)
    else {
      console.error(
        `Could not find element for mesh: ${result[0]}, index: ${result[1]}`
      )
    }
  }

  mouseRaycast (position: THREE.Vector2) {
    const x = (position.x / window.innerWidth) * 2 - 1
    const y = -(position.y / window.innerHeight) * 2 + 1
    const mouse = new THREE.Vector2(x, y)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera.camera)
    return raycaster.intersectObjects(this.viewer.render.meshes)
  }

  findHitMeshIndex (
    hits: THREE.Intersection<THREE.Object3D<THREE.Event>>[]
  ): [mesh: Mesh, index: number] | number | null {
    const hit = hits[0]
    if (!hit) {
      console.log('Raycast: No hit.')
      return null
    }

    console.log(
      'Raycast hit. \n' +
        `Position: (${hit.point.x}, ${hit.point.y}, ${hit.point.z}) \n` +
        `ObjectId: ${hit.object.id}`
    )

    // Merged mesh have node origin of each face encoded in uvs
    if (hit.object.userData.merged && hit.uv !== undefined) {
      const node = Math.round(hit.uv.x)
      console.log(
        `Mesh is merged mesh. Hit face ${hits[0].faceIndex} coming from Node: ${node}`
      )
      return node
    }

    // For instanced mesh we get the instance id directly from hit
    if (hit.instanceId !== undefined) {
      const instanceId = hit.instanceId
      console.log(`Mesh is Instanced. Instance Index: ${instanceId}`)
      return [hit.object as THREE.InstancedMesh, instanceId]
    }

    console.log(
      'Raycast hit unsupported object type. It might be an object not created by the vim api. Make sure such objects are not included in viewer this.viewer.render.meshes'
    )
    return null
  }
}
