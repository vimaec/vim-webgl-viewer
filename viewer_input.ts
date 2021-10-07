import * as THREE from 'three'
import { ViewerCamera, direction } from './viewer_camera'
import { Viewer } from './viewer'

const KEYS = {
    KEY_0 = '0',
    KEY_1 = '1',
    KEY_2 = '2',
    KEY_3 = '3',
    KEY_4 = '4',
    KEY_5 = '5',
    KEY_6 = '6',
    KEY_7 = '7',
    KEY_8 = '8',
    KEY_9 = '9',

    KEY_LEFT = 0x25,
    KEY_RIGHT = 0x27,
    KEY_UP = 0x26,
    KEY_DOWN = 0x28,
    KEY_CTRL = 0x11,
    KEY_SHIFT = 0x10,
    KEY_ENTER = 0x0D,
    KEY_SPACE = 0x20,
    KEY_TAB = 0x09,
    KEY_ESCAPE = 0x1B,
    KEY_BACKSPACE = 0x08,
    KEY_HOME = 0x24,
    KEY_END = 0x23,
    KEY_INSERT = 0x2D,
    KEY_DELETE = 0x2E,
    KEY_ALT = 0x12,

    KEY_F1 = 0x70,
    KEY_F2 = 0x71,
    KEY_F3 = 0x72,
    KEY_F4 = 0x73,
    KEY_F5 = 0x74,
    KEY_F6 = 0x75,
    KEY_F7 = 0x76,
    KEY_F8 = 0x77,
    KEY_F9 = 0x78,
    KEY_F10 = 0x79,
    KEY_F11 = 0x7A,
    KEY_F12 = 0x7B,

    KEY_NUMPAD0 = 0x60,
    KEY_NUMPAD1 = 0x61,
    KEY_NUMPAD2 = 0x62,
    KEY_NUMPAD3 = 0x63,
    KEY_NUMPAD4 = 0x64,
    KEY_NUMPAD5 = 0x65,
    KEY_NUMPAD6 = 0x66,
    KEY_NUMPAD7 = 0x67,
    KEY_NUMPAD8 = 0x68,
    KEY_NUMPAD9 = 0x69,

    KEY_ADD = 0x6B,
    KEY_SUBTRACT = 0x6D,
    KEY_MULTIPLY = 0x6A,
    KEY_DIVIDE = 0x6F,
    KEY_SEPARATOR = 0x6C,
    KEY_DECIMAL = 0x6E,

    KEY_OEM_PLUS = 0xBB,
    KEY_OEM_MINUS = 0xBD,

    KEY_A = 'A',
    KEY_B = 'B',
    KEY_C = 'C',
    KEY_D = 'D',
    KEY_E = 'E',
    KEY_F = 'F',
    KEY_G = 'G',
    KEY_H = 'H',
    KEY_I = 'I',
    KEY_J = 'J',
    KEY_K = 'K',
    KEY_L = 'L',
    KEY_M = 'M',
    KEY_N = 'N',
    KEY_O = 'O',
    KEY_P = 'P',
    KEY_Q = 'Q',
    KEY_R = 'R',
    KEY_S = 'S',
    KEY_T = 'T',
    KEY_U = 'U',
    KEY_V = 'V',
    KEY_W = 'W',
    KEY_X = 'X',
    KEY_Y = 'Y',
    KEY_Z = 'Z',
  }
  
  export class ViewerInput {

    MouseMoveSensitivity: number = 0.05
    MouseRotateSensitivity: number = 0.001
    TouchMoveSensitivity: number = this.MouseMoveSensitivity * 20;
    TouchRotateSensitivity: number = this.MouseRotateSensitivity;
    MouseScrollSensitivity: number = 5;
    MaximumInclination: number = 1.4
    MinOrbitalDistance: number = 1.0
    ShiftMultiplier: number = 3
    CtrlMultiplier: number = 2 * this.ShiftMultiplier;
    CtrlShiftMultiplier: number = 2 * this.CtrlMultiplier;
    MinimumSpeedDifference: number = 0.01;
    VelocityBlendFactor: number = 0.0001;
    BaseKeyboardSpeed: number = 15;

    canvas: HTMLCanvasElement
    settings: any
    cameraController: ViewerCamera
    unregister: Function
    isMouseDown: Boolean
    
    MouseRotate : Boolean
    MouseOrbit : Boolean
    MouseMoveDolly : Boolean
    MouseMovePan : Boolean

    // TODO figure out the right pattern for inputs
    viewer: Viewer
    focusDisposer: Function
  
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
  /*    let speed = this.settings.camera.controls.speed
      if (event.shiftKey) {
        speed *= this.settings.camera.controls.shiftMultiplier
      }
      switch (event.keyCode) {
        case KEYS.A:
          this.cameraController.moveCameraBy(direction.left, speed)
          break
        case KEYS.LEFTARROW:
          this.cameraController.moveCameraBy(direction.left, speed, true)
          break
        case KEYS.D:
          this.cameraController.moveCameraBy(direction.right, speed)
          break
        case KEYS.RIGHTARROW:
          this.cameraController.moveCameraBy(direction.right, speed, true)
          break
        case KEYS.W:
          this.cameraController.moveCameraBy(direction.forward, speed)
          break
        case KEYS.UPARROW:
          this.cameraController.moveCameraBy(direction.forward, speed, true)
          break
        case KEYS.S:
          this.cameraController.moveCameraBy(direction.back, speed)
          break
        case KEYS.DOWNARROW:
          this.cameraController.moveCameraBy(direction.back, speed, true)
          break
        case KEYS.E:
        case KEYS.PAGEUP:
          this.cameraController.moveCameraBy(direction.up, speed)
          break
        case KEYS.Q:
        case KEYS.PAGEDOWN:
          this.cameraController.moveCameraBy(direction.down, speed)
          break
        case KEYS.HOME:
          this.cameraController.resetCamera()
          break
        default:
          return
      }*/

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
              case KEYS.KEY_F8: // TODO: this may cause contention with the F-key gestures defined in ExplorerWindow.xaml.
                    this.MouseOrbit = !this.MouseOrbit;
                    if (this.MouseOrbit)
                    {
                        this.cameraController.CurrentOrbitalDistance = this.cameraController.OrbitalTarget.sub(this.cameraController.Position).length();
                        this.cameraController.TargetOrbitalDistance = this.cameraController.CurrentOrbitalDistance;
                    }
                    break;
          }
      }

      var speed = keyDown ? this.BaseKeyboardSpeed : 0.0;
      switch (event.keyCode)
      {
          case KEYS.KEY_W:
          case KEYS.KEY_UP:
              this.cameraController.InputVelocity.y = speed;
              break;
          case KEYS.KEY_S:
          case KEYS.KEY_DOWN:
              this.cameraController.InputVelocity.y = -speed;
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
              this.cameraController.InputVelocity.z = speed;
              break;
          case KEYS.KEY_Q:
              this.cameraController.InputVelocity.z = -speed;
              break;
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
        this.cameraController.rotateCameraBy(delta)
      }
    }
  
    onMouseWheel = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const speed = this.settings.camera.controls.zoomSpeed
      const dir = event.deltaY > 0 ? direction.back : direction.forward
      this.cameraController.moveCameraBy(dir, speed)
    }
  
    onMouseDown = (event) => {
      event.preventDefault()
      this.isMouseDown = true
  
      const hits = this.mouseRaycast(event.x, event.y)
      if (hits.length > 0) {
        const mesh = hits[0].object
        const index = hits[0].instanceId
  
        const nodeIndex = this.viewer.getNodeIndex(mesh, index)
        const name = this.viewer.getElementNameFromNodeIndex(nodeIndex)
  
        this.focusDisposer?.(this)
        this.focusDisposer = this.viewer.focus(mesh, index)
  
        console.log('Raycast hit.')
        console.log(
          'Position:' +
            hits[0].point.x +
            ',' +
            hits[0].point.y +
            ',' +
            hits[0].point.z
        )
        console.log('Element: ' + name)
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