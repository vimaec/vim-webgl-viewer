import * as THREE from 'three'
import { ViewerCamera, direction } from './viewer_camera'
import { Viewer } from './viewer'

const KEYS = {
    KEY_0: 48,
    KEY_1: 49,
    KEY_2: 50,
    KEY_3: 51,
    KEY_4: 52,
    KEY_5: 53,
    KEY_6: 54,
    KEY_7: 55,
    KEY_8: 56,
    KEY_9: 57,

    KEY_LEFT: 0x25,
    KEY_RIGHT: 0x27,
    KEY_UP: 0x26,
    KEY_DOWN: 0x28,
    KEY_CTRL: 0x11,
    KEY_SHIFT: 0x10,
    KEY_ENTER: 0x0D,
    KEY_SPACE: 0x20,
    KEY_TAB: 0x09,
    KEY_ESCAPE: 0x1B,
    KEY_BACKSPACE: 0x08,
    KEY_HOME: 0x24,
    KEY_END: 0x23,
    KEY_INSERT: 0x2D,
    KEY_DELETE: 0x2E,
    KEY_ALT: 0x12,

    KEY_F1: 0x70,
    KEY_F2: 0x71,
    KEY_F3: 0x72,
    KEY_F4: 0x73,
    KEY_F5: 0x74,
    KEY_F6: 0x75,
    KEY_F7: 0x76,
    KEY_F8: 0x77,
    KEY_F9: 0x78,
    KEY_F10: 0x79,
    KEY_F11: 0x7A,
    KEY_F12: 0x7B,

    KEY_NUMPAD0: 0x60,
    KEY_NUMPAD1: 0x61,
    KEY_NUMPAD2: 0x62,
    KEY_NUMPAD3: 0x63,
    KEY_NUMPAD4: 0x64,
    KEY_NUMPAD5: 0x65,
    KEY_NUMPAD6: 0x66,
    KEY_NUMPAD7: 0x67,
    KEY_NUMPAD8: 0x68,
    KEY_NUMPAD9: 0x69,

    KEY_ADD: 0x6B,
    KEY_SUBTRACT: 0x6D,
    KEY_MULTIPLY: 0x6A,
    KEY_DIVIDE: 0x6F,
    KEY_SEPARATOR: 0x6C,
    KEY_DECIMAL: 0x6E,

    KEY_OEM_PLUS: 0xBB,
    KEY_OEM_MINUS: 0xBD,

    KEY_A: 65,
    KEY_B: 66,
    KEY_C: 67,
    KEY_D: 68,
    KEY_E: 69,
    KEY_F: 70,
    KEY_G: 71,
    KEY_H: 72,
    KEY_I: 73,
    KEY_J: 74,
    KEY_K: 75,
    KEY_L: 76,
    KEY_M: 77,
    KEY_N: 78,
    KEY_O: 79,
    KEY_P: 80,
    KEY_Q: 81,
    KEY_R: 82,
    KEY_S: 83,
    KEY_T: 84,
    KEY_U: 85,
    KEY_V: 86,
    KEY_W: 87,
    KEY_X: 88,
    KEY_Y: 89,
    KEY_Z: 90,
  }
  
  export class ViewerInput {

    MouseMoveSensitivity: number = 0.05
    MouseRotateSensitivity: number = 0.2
    TouchMoveSensitivity: number = this.MouseMoveSensitivity * 20;
    TouchRotateSensitivity: number = this.MouseRotateSensitivity;
    MouseScrollSensitivity: number = 0.05;
    MaximumInclination: number = 1.4
    MinOrbitalDistance: number = 1.0
    ShiftMultiplier: number = 3.0
    MinimumSpeedDifference: number = 0.01;
    VelocityBlendFactor: number = 0.0001;
    BaseKeyboardSpeed: number = 15;

    canvas: HTMLCanvasElement
    settings: any
    cameraController: ViewerCamera
    unregister: Function
    isMouseDown: Boolean
    
  // TODO: Fix circular dependency
    viewer: Viewer
    focusDisposer: Function

    ctrlDown: boolean
    shftDown: boolean
  
    constructor (
      canvas: HTMLCanvasElement,
      settings: any,
      cameraController: ViewerCamera
    ) {
      this.canvas = canvas
      this.settings = settings
      this.cameraController = cameraController
      this.unregister = function () {}
      this.isMouseDown = false
    }
  
    register () {
      this.canvas.addEventListener('mousedown', this.onMouseDown)
      this.canvas.addEventListener('wheel', this.onMouseWheel)
      this.canvas.addEventListener('mousemove', this.onMouseMove)
      this.canvas.addEventListener('mouseup', this.onMouseUp)
      document.addEventListener('keydown', this.onKeyDown)
      document.addEventListener('keyup', this.onKeyUp)
  
      this.unregister = function () {
        this.canvas.removeEventListener('mousedown', this.onMouseDown)
        this.canvas.removeEventListener('wheel', this.onMouseWheel)
        this.canvas.removeEventListener('mousemove', this.onMouseMove)
        this.canvas.removeEventListener('mouseup', this.onMouseUp)
        document.removeEventListener('keydown', this.onKeyDown)
        document.removeEventListener('keyup', this.onKeyUp)
  
        this.isMouseDown = false
        this.unregister = function () {}
      }
    }
    
    onKeyUp = (event) => {
        this.onKey(event, false);
    }
  
    onKeyDown = (event) => {
        this.onKey(event, true);
    }
    
    onKey = (event, keyDown) => {
      if (!keyDown)
      {
          switch (event.keyCode)
          {
              case KEYS.KEY_ADD:
              case KEYS.KEY_OEM_PLUS:
                  this.cameraController.SpeedMultiplier += 1;
                  break;
              case KEYS.KEY_SUBTRACT:
              case KEYS.KEY_OEM_MINUS:
                  this.cameraController.SpeedMultiplier -= 1;
                  break;
              case KEYS.KEY_F8: 
                    this.cameraController.MouseOrbit = !this.cameraController.MouseOrbit;
                    if (this.cameraController.MouseOrbit)
                    {
                        this.cameraController.CurrentOrbitalDistance = this.cameraController.OrbitalTarget.sub(this.cameraController.Position).length();
                        this.cameraController.TargetOrbitalDistance = this.cameraController.CurrentOrbitalDistance;
                    }
                    break;
          }
      }

      var speed = keyDown ? this.BaseKeyboardSpeed * (this.shftDown ? this.ShiftMultiplier : 1.0) : 0.0;
      switch (event.keyCode)
      {
      // Selection
      case KEYS.ESCAPE:
        this.viewer.clearSelection()
        break
      case KEYS.Z:
        this.viewer.focusSelection()
        break
      // Camera
          case KEYS.KEY_W:
          case KEYS.KEY_UP:
              this.cameraController.InputVelocity.z = -speed;
              break;
          case KEYS.KEY_S:
          case KEYS.KEY_DOWN:
              this.cameraController.InputVelocity.z = speed;
              break;
          case KEYS.KEY_D:
          case KEYS.KEY_RIGHT:
              this.cameraController.InputVelocity.x = speed;
              break;
          case KEYS.KEY_A:
          case KEYS.KEY_LEFT:
              this.cameraController.InputVelocity.x = -speed;
              break;
          case KEYS.KEY_E:
              this.cameraController.InputVelocity.y = speed;
              break;
          case KEYS.KEY_Q:
              this.cameraController.InputVelocity.y = -speed;
              break;
          case KEYS.KEY_CTRL:
              this.ctrlDown = keyDown;
              break;
          case KEYS.KEY_SHIFT:
              if (this.shftDown != keyDown)
              {
                this.shftDown = keyDown;
                if (keyDown)
                {
                  this.cameraController.InputVelocity.multiplyScalar(this.ShiftMultiplier);
                }
                else 
                {
                  this.cameraController.InputVelocity.multiplyScalar(1.0 / this.ShiftMultiplier);
                }
              }
              break;
      case KEYS.HOME:
        this.cameraController.resetCamera()
        break
      }

      event.preventDefault()
    }
  
    onMouseMove = (event) => {
      if (!this.isMouseDown) {
        return
      }
  
      event.preventDefault()
  
      // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
      const deltaX =
        event.movementX || event.mozMovementX || event.webkitMovementX || 0
      const deltaY =
        event.movementY || event.mozMovementY || event.webkitMovementY || 0
      const delta = new THREE.Vector2(deltaX, deltaY)
  
      if (event.buttons & 2) {
        this.cameraController.panCameraBy(delta)
      } else {
        delta.multiplyScalar(this.MouseRotateSensitivity)
        this.cameraController.rotateCameraBy(delta)
      }
    }
  
    onMouseWheel = (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (this.ctrlDown)
        {
            this.cameraController.SpeedMultiplier -= event.deltaY * 0.01;
        }
        else
        {
/*            const speed = this.settings.camera.controls.zoomSpeed
            const dir = event.deltaY > 0 ? direction.back : direction.forward
            this.cameraController.moveCameraBy(dir, speed)*/
            
            var impulse = new THREE.Vector3(0, 0, event.deltaY * this.MouseScrollSensitivity * this.cameraController.getSpeedMultiplier());
            this.cameraController.applyLocalImpulse(impulse);
        }
    }
  
  onMouseDown = (event) => {
    event.preventDefault()
    this.isMouseDown = true

    const hits = this.mouseRaycast(event.x, event.y)
    if (hits.length > 0) {
      const mesh = hits[0].object
      const index = hits[0].instanceId

      console.log(
        `Raycast hit. Position (${hits[0].point.x}, ${hits[0].point.y}, ${hits[0].point.z})`
      )
      this.viewer.select(mesh, index)
    }
  
      // Manually set the focus since calling preventDefault above
      // prevents the browser from setting it automatically.
      this.canvas.focus ? this.canvas.focus() : window.focus()
    }
  
    mouseRaycast (mouseX, mouseY) {
      const x = (mouseX / window.innerWidth) * 2 - 1
      const y = -(mouseY / window.innerHeight) * 2 + 1
      const mouse = new THREE.Vector2(x, y)
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, this.cameraController.camera)
      // raycaster.firstHitOnly = true;
      return raycaster.intersectObjects(this.viewer.meshes)
    }
  
    onMouseUp = (_) => {
      this.isMouseDown = false
    }
  }