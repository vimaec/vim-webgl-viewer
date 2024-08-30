import * as THREE from 'three'
import { AxesSettings } from './axesSettings'

export class Axis {
  axis: string
  direction: THREE.Vector3
  size: number
  color: string
  colorSub: string
  position: THREE.Vector3

  // Optional
  label: string | undefined
  line: number | undefined

  constructor (init: Axis) {
    this.axis = init.axis
    this.direction = init.direction
    this.size = init.size
    this.position = init.position
    this.color = init.color
    this.colorSub = init.colorSub

    // Optional
    this.line = init.line
    this.label = init.label
  }
}

export function createAxes (settings : AxesSettings) {
  return [
    new Axis({
      axis: 'x',
      direction: new THREE.Vector3(1, 0, 0),
      size: settings.bubbleSizePrimary,
      color: settings.colorX,
      colorSub: settings.colorXSub,
      line: settings.lineWidth,
      label: 'X',
      position: new THREE.Vector3(0, 0, 0)
    }),
    new Axis({
      axis: 'y',
      direction: new THREE.Vector3(0, 1, 0),
      size: settings.bubbleSizePrimary,
      color: settings.colorY,
      colorSub: settings.colorYSub,
      line: settings.lineWidth,
      label: 'Y',
      position: new THREE.Vector3(0, 0, 0)
    }),
    new Axis({
      axis: 'z',
      direction: new THREE.Vector3(0, 0, 1),
      size: settings.bubbleSizePrimary,
      color: settings.colorZ,
      colorSub: settings.colorZSub,
      line: settings.lineWidth,
      label: 'Z',
      position: new THREE.Vector3(0, 0, 0)
    }),
    new Axis({
      axis: '-x',
      direction: new THREE.Vector3(-1, 0, 0),
      size: settings.bubbleSizeSecondary,
      color: settings.colorX,
      colorSub: settings.colorXSub,
      line: undefined,
      label: undefined,
      position: new THREE.Vector3(0, 0, 0)
    }),
    new Axis({
      axis: '-y',
      direction: new THREE.Vector3(0, -1, 0),
      size: settings.bubbleSizeSecondary,
      color: settings.colorY,
      colorSub: settings.colorYSub,
      line: undefined,
      label: undefined,
      position: new THREE.Vector3(0, 0, 0)
    }),
    new Axis({
      axis: '-z',
      // inverted Z
      direction: new THREE.Vector3(0, 0, -1),
      size: settings.bubbleSizeSecondary,
      color: settings.colorZ,
      colorSub: settings.colorZSub,
      line: undefined,
      label: undefined,
      position: new THREE.Vector3(0, 0, 0)
    })
  ]
}
