/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'

import { Camera } from './camera'
import { Viewer } from './viewer'

export const KEYS = {
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
  KEY_ENTER: 0x0d,
  KEY_SPACE: 0x20,
  KEY_TAB: 0x09,
  KEY_ESCAPE: 0x1b,
  KEY_BACKSPACE: 0x08,
  KEY_HOME: 0x24,
  KEY_END: 0x23,
  KEY_INSERT: 0x2d,
  KEY_DELETE: 0x2e,
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
  KEY_F11: 0x7a,
  KEY_F12: 0x7b,

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

  KEY_ADD: 0x6b,
  KEY_SUBTRACT: 0x6d,
  KEY_MULTIPLY: 0x6a,
  KEY_DIVIDE: 0x6f,
  KEY_SEPARATOR: 0x6c,
  KEY_DECIMAL: 0x6e,

  KEY_OEM_PLUS: 0xbb,
  KEY_OEM_MINUS: 0xbd,

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
  KEY_Z: 90
}

/**
 * Manages keyboard user inputs
 */
export class Keyboard {
  // Settings
  private SHIFT_MULTIPLIER: number = 3.0

  // Dependencies
  private _camera: Camera
  private _viewer: Viewer

  // State
  isUpPressed: boolean
  isDownPressed: boolean
  isLeftPressed: boolean
  isRightPressed: boolean
  isEPressed: boolean
  isQPressed: boolean
  isShiftPressed: boolean = false
  isCtrlPressed: boolean

  constructor (camera: Camera, viewer: Viewer) {
    this._camera = camera
    this._viewer = viewer
  }

  reset = () => {
    this.isUpPressed = false
    this.isDownPressed = false
    this.isLeftPressed = false
    this.isRightPressed = false
    this.isEPressed = false
    this.isQPressed = false
    this.isShiftPressed = false
    this.isCtrlPressed = false
  }

  onKeyUp = (event: any) => {
    this.onKey(event, false)
  }

  onKeyDown = (event: any) => {
    this.onKey(event, true)
  }

  onKey = (event: any, keyDown: boolean) => {
    // Buttons that activate once on key up
    if (!keyDown) {
      switch (event.keyCode) {
        case KEYS.KEY_ADD:
        case KEYS.KEY_OEM_PLUS:
          this._camera.speedMultiplier += 1
          event.preventDefault()
          break
        case KEYS.KEY_SUBTRACT:
        case KEYS.KEY_OEM_MINUS:
          this._camera.speedMultiplier -= 1
          event.preventDefault()
          break
        case KEYS.KEY_F8:
        case KEYS.KEY_SPACE:
          this._camera.orbitMode = !this._camera.orbitMode
          event.preventDefault()
          break
        case KEYS.KEY_HOME:
          this._viewer.frameContent()
          event.preventDefault()
          break
        // Selection
        case KEYS.KEY_ESCAPE:
          this._viewer.selectObject(undefined)
          event.preventDefault()
          break
        case KEYS.KEY_Z:
        case KEYS.KEY_F:
          this._viewer.frameSelection()
          event.preventDefault()
          break
      }
    }

    // Camera Movement, Buttons that need constant state refresh
    switch (event.keyCode) {
      case KEYS.KEY_W:
      case KEYS.KEY_UP:
        this.isUpPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_S:
      case KEYS.KEY_DOWN:
        this.isDownPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_D:
      case KEYS.KEY_RIGHT:
        this.isRightPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_A:
      case KEYS.KEY_LEFT:
        this.isLeftPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_E:
        this.isEPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_Q:
        this.isQPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_SHIFT:
        this.isShiftPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_CTRL:
        this.isCtrlPressed = keyDown
        console.log('Control:' + keyDown)
        event.preventDefault()
        break
    }
  }

  private applyMove = () => {
    const move = new THREE.Vector3(
      (this.isRightPressed ? 1 : 0) - (this.isLeftPressed ? 1 : 0),
      (this.isEPressed ? 1 : 0) - (this.isQPressed ? 1 : 0),
      (this.isUpPressed ? 1 : 0) - (this.isDownPressed ? 1 : 0)
    )
    const speed = this.isShiftPressed ? this.SHIFT_MULTIPLIER : 1
    move.multiplyScalar(speed)
    this._camera.setLocalVelocity(move)
  }
}