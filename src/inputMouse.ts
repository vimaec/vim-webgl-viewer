import * as THREE from 'three'
import { ViewerCamera } from './viewerCamera'
import { Viewer } from './viewer'
import { Mesh, Vector2 } from 'three'

export class InputMouse {
  // Consts
  MouseMoveSensitivity: number = 0.05
  MouseRotateSensitivity: number = 0.2
  MouseScrollSensitivity: number = 0.05

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
    const delta = new THREE.Vector2(deltaX, deltaY)

    if (event.buttons & 2) {
      this.camera.panCameraBy(delta)
    } else {
      delta.multiplyScalar(this.MouseRotateSensitivity)
      this.camera.rotateCameraBy(delta)
    }
  }

  onMouseWheel = (event: any) => {
    event.preventDefault()
    event.stopPropagation()
    if (this.ctrlDown) {
      this.camera.SpeedMultiplier -= event.deltaY * 0.01
    } else if (this.camera.MouseOrbit) {
      this.camera.updateOrbitalDistance(
        -event.deltaY * this.MouseScrollSensitivity
      )
    } else {
      const impulse = new THREE.Vector3(
        0,
        0,
        event.deltaY *
          this.MouseScrollSensitivity *
          this.camera.getSpeedMultiplier()
      )
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
    console.time('raycast')
    const hits = this.mouseRaycast(position)
    const [mesh, index] = this.findHitMeshIndex(hits)
    console.timeEnd('raycast')

    // 0 is a valid value
    if (index !== null) {
      this.viewer.select(mesh, index)
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
  ): [Mesh, number] {
    if (!hits?.length) {
      console.log('Raycast: No hit.')
      return [null, null]
    }

    const mesh = hits[0].object
    if (!(mesh instanceof THREE.Mesh)) {
      console.log(`Raycast hit object: ${mesh} of unsupported type. Ignoring.`)
      return [null, null]
    }

    const [index, meshType]: [number, string] = mesh.userData.merged
      ? [Math.round(hits[0].uv.x), 'Merged']
      : [hits[0].instanceId, 'Instanced']

    console.log(
      `Raycast: Hit ${meshType} Mesh with MeshId:${mesh.id} and NodeIndex: ${index}`
    )

    console.log(
      `Raycast hit. Position (${hits[0].point.x}, ${hits[0].point.y}, ${hits[0].point.z})`
    )

    return [mesh, index]
  }
}
