import * as THREE from 'three'
import { ViewerCamera } from './viewerCamera'
import { Viewer } from './viewer'
import { Mesh, Vector2 } from 'three'
import { ViewerRenderer } from './viewerRenderer'

type RaycastResult = [mesh: Mesh, index: number] | number | null

export class InputMouse {
  // Dependencies
  private camera: ViewerCamera
  private renderer: ViewerRenderer
  private viewer: Viewer

  // State
  private isMouseDown: Boolean = false
  private hasMouseMoved: Boolean = false
  private ctrlDown: Boolean = false

  constructor (camera: ViewerCamera, renderer: ViewerRenderer, viewer: Viewer) {
    this.camera = camera
    this.renderer = renderer
    this.viewer = viewer
  }

  reset = () => {
    this.isMouseDown = this.hasMouseMoved = this.ctrlDown = false
  }

  setCtrl = (value: Boolean) => {
    this.ctrlDown = value
  }

  onMouseOut = (_: any) => {
    this.isMouseDown = this.hasMouseMoved = false
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
    const [width, height] = this.renderer.getContainerSize()
    const delta = new THREE.Vector2(deltaX / width, deltaY / height)

    if (event.buttons & 2) {
      this.camera.truckPedestalCameraBy(delta)
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
    // Thus we only use the direction of the value
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
    this.renderer.canvas.focus()
  }

  onMouseUp = (event: any) => {
    if (this.isMouseDown && !this.hasMouseMoved) {
      this.onMouseClick(new THREE.Vector2(event.x, event.y), false)
    }
    this.isMouseDown = false
    event.preventDefault()
  }

  onDoubleClick = (event: any) => {
    this.onMouseClick(new THREE.Vector2(event.x, event.y), true)
  }

  onMouseClick = (position: Vector2, double: boolean) => {
    // Find geometry and bim data at mouse position
    console.time('raycast')
    const hits = this.mouseRaycast(position)
    console.timeEnd('raycast')
    const result = this.findHitMeshIndex(hits)

    const [element, error] = this.getElementIndex(result)
    if (element >= 0) {
      this.viewer.selectByElementIndex(element)
      if (double) this.viewer.lookAtSelection()
    } else {
      this.viewer.clearSelection()
      if (error) console.log(error)
    }
  }

  mouseRaycast (position: THREE.Vector2) {
    const [width, height] = this.renderer.getContainerSize()
    const x = (position.x / width) * 2 - 1
    const y = -(position.y / height) * 2 + 1
    const mouse = new THREE.Vector2(x, y)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera.camera)
    return raycaster.intersectObjects(this.viewer.render.meshes)
  }

  findHitMeshIndex (
    hits: THREE.Intersection<THREE.Object3D<THREE.Event>>[]
  ): RaycastResult {
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

  getElementIndex (
    raycast: RaycastResult
  ): [elementIndex: number, error: string] {
    // No hit
    if (raycast === null) {
      return [-1, undefined]
    }

    // Hit a merged mesh, we get node index
    if (typeof raycast === 'number') {
      const element = this.viewer.getElementIndexFromNodeIndex(raycast)
      return element >= 0
        ? [element, undefined]
        : [-1, 'Could not find elment for node index: ' + raycast]
    }

    // Hit a an instances mesh, we get mesh and index
    const element = this.viewer.getElementIndexFromMeshInstance(
      raycast[0],
      raycast[1]
    )
    return element >= 0
      ? [element, undefined]
      : [
          -1,
          `Could not find element for mesh: ${raycast[0]}, index: ${raycast[1]}`
        ]
  }
}
