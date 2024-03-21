import * as THREE from 'three'
import { floor } from '../../images'
import { GizmoOptions } from '../gizmos/gizmoAxes'
import { defaultViewerSettings } from './defaultViewerSettings'
import { PartialSettings, Settings } from './viewerSettings'

export type TextureEncoding = 'url' | 'base64' | undefined
export { GizmoOptions } from '../gizmos/gizmoAxes'


function strToBool(str: string): boolean {
  return JSON.parse(str.toLowerCase()) as boolean;
}

function strToVector3(str: string){
  if(str[0] !== '(') return
  if(str[str.length - 1] !== ')') return
  const split = str.split(',')
  if(split.length !== 3) return
  try{
    const x = Number.parseFloat(split[0])
    const y = Number.parseFloat(split[1])
    const z = Number.parseFloat(split[2])
    return new THREE.Vector3(x,y,z)
  }
  catch{}
}

function strToVector2(str: string){
  if(str[0] !== '(') return
  if(str[str.length - 1] !== ')') return
  const split = str.split(',')
  if(split.length !== 2) return
  try{
    const x = Number.parseFloat(split[0])
    const y = Number.parseFloat(split[1])
    return new THREE.Vector2(x,y)
  }
  catch{}
}

function strToColor(str: string){
  return new THREE.Color(str)
}

export function parseSettingsFromUrl(url: string){
  
  const params = new URLSearchParams(url)
  function get<T>(key: string, parse? :(str: string) => T){
    const p = params.get(key) ?? params.get(key.toLowerCase())
    if(p){
      try{
        return parse?.(p)
      }
      catch{}
    }
  }

  const parsed = {
    canvas: {
      id: get('canvas.id'),
      resizeDelay: get('canvas.resizeDelay', Number.parseInt)
    },
    camera: {
        orthographic: get('camera.orthographic', strToBool),
        allowedMovement: get('camera.allowedMovement', strToVector3),
        allowedRotation: get('camera.allowedRotation', strToVector2),
        near: get('camera.near', Number.parseFloat),
        far: get('camera.far', Number.parseFloat),
        fov: get('camera.fov', Number.parseInt),
        zoom: get('camera.zoom', Number.parseFloat),
        forward: get('camera.forward', strToVector3),
        controls: {
          orbit: get('camera.controls.orbit', strToBool),
          rotateSpeed: get('camera.controls.rotateSpeed', Number.parseFloat),
          orbitSpeed: get('camera.controls.orbitSpeed', Number.parseFloat),
          moveSpeed: get('camera.controls.moveSpeed', Number.parseFloat),
          scrollSpeed: get('camera.controls.scrollSpeed', Number.parseFloat)
        },
        gizmo: {
          enable: get('camera.gizmo.enable', strToBool),
          size: get('camera.gizmo.size', Number.parseFloat),
          color: get('camera.gizmo.color', strToColor),
          opacity: get('camera.gizmo.opacity', Number.parseFloat),
          opacityAlways: get('camera.gizmo.opacityAlways', Number.parseFloat)
        }
    },
    background: {
      color: get('background.color', strToColor)
    },
    groundPlane: {
      visible: get('groundPlane.visible', strToBool),
      encoding: get('groundPlane.encoding'),
      texture: get('groundPlane.texture'),
      opacity: get('groundPlane.opacity', Number.parseFloat),
      color: get('groundPlane.color', strToColor),
      size: get('groundPlane.size', Number.parseFloat)
    },
    skylight: {
      skyColor: get('skylight.skyColor', strToColor),
      groundColor: get('skylight.groundColor', strToColor),
      intensity: get('skylight.intensity', Number.parseFloat)
    },
    sunLights: undefined,
    materials: {
      highlight: {
        color: get('materials.highlight.color', strToColor),
        opacity: get('materials.highlight.opacity', Number.parseFloat)
      },
      isolation: {
        color: get('materials.isolation.color', strToColor),
        opacity: get('materials.isolation.opacity', Number.parseFloat)
      },
      section: {
        strokeWidth: get('materials.section.strokeWidth', Number.parseFloat),
        strokeFalloff: get('materials.section.strokeFalloff', Number.parseFloat),
        strokeColor: get('materials.section.strokeColor', strToColor)
      },
      outline: {
        intensity: get('materials.outline.intensity', Number.parseFloat),
        falloff: get('materials.outline.falloff', Number.parseFloat),
        blur: get('materials.outline.blur', Number.parseFloat),
        color: get('materials.outline.color', strToColor)
      }
    },
    axes: new GizmoOptions(),
    rendering: {
      onDemand: get('rendering.onDemand', strToBool)
    }
  } as Settings

  return removeUndefinedProps(parsed) as PartialSettings

}

function removeUndefinedProps(obj) {
  if (typeof obj !== 'object' || obj === null) {
      return obj;
  }

  if (Array.isArray(obj)) {
      return obj.map(removeUndefinedProps);
  }

  const newObj = {};
  for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = removeUndefinedProps(obj[key]);
          if (value !== undefined) {
              newObj[key] = value;
          }
      }
  }
  return newObj;
}