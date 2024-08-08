import * as THREE from 'three'
import { AxesSettings } from '../gizmos/axes/axesSettings'
import { PartialViewerSettings, ViewerSettings } from './viewerSettings'
import deepmerge from 'deepmerge'

/**
 * Parses the url for settings and merges the result with the optional provided settings.
 * URL settings have priority
 * @param settings Settings to use if not defined in the url.
 * @param url URL string with standard parameters.
 * @returns A PartialSettings object that can further be merged with default values.
 */
export function getViewerSettingsFromUrl (url?: string, settings?: PartialViewerSettings) {
  const urlSettings = parseSettingsFromUrl(url)
  return deepmerge(settings, urlSettings) as PartialViewerSettings
}

function parseSettingsFromUrl (url: string) {
  const params = new URLSearchParams(url)
  function get<T> (key: string, parse? :(str: string) => T) {
    const p = params.get(key) ?? params.get(key.toLowerCase())
    if (p) {
      try {
        return parse?.(p)
      } catch {}
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
    skybox: {
      skyColor: get('skybox.skyColor', strToColor),
      groundColor: get('skybox.groundColor', strToColor),
      sharpness: get('skybox.sharpness', Number.parseFloat)
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
    sunLights: [
      {
        color: get('sunLights.0.color', strToColor),
        intensity: get('sunLights.0.intensity', Number.parseFloat),
        position: get('sunLights.0.position', strToVector3)
      },
      {
        color: get('sunLights.1.color', strToColor),
        intensity: get('sunLights.1.intensity', Number.parseFloat),
        position: get('sunLights.1.position', strToVector3)
      }
    ],
    materials: {
      standard: {
        color: get('materials.standard.color', strToColor)
      },
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
    axes: new AxesSettings(),
    rendering: {
      onDemand: get('rendering.onDemand', strToBool)
    }
  } as ViewerSettings

  // We remove undefined propertes because deepmerge only writes properties that not declared.
  return removeUndefinedProperties(parsed) as PartialViewerSettings
}

function strToBool (str: string): boolean {
  return JSON.parse(str.toLowerCase()) as boolean
}

function strToVector3 (str: string) {
  if (str[0] !== '(') return
  if (str[str.length - 1] !== ')') return
  const split = str.split(',')
  if (split.length !== 3) return
  try {
    const x = Number.parseFloat(split[0])
    const y = Number.parseFloat(split[1])
    const z = Number.parseFloat(split[2])
    return new THREE.Vector3(x, y, z)
  } catch {}
}

function strToVector2 (str: string) {
  if (str[0] !== '(') return
  if (str[str.length - 1] !== ')') return
  const split = str.split(',')
  if (split.length !== 2) return
  try {
    const x = Number.parseFloat(split[0])
    const y = Number.parseFloat(split[1])
    return new THREE.Vector2(x, y)
  } catch {}
}

function strToColor (str: string) {
  if (str.startsWith('0x')) {
    return new THREE.Color(parseInt(str))
  }
  return new THREE.Color(str)
}

function removeUndefinedProperties (obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedProperties)
  }

  const result = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = removeUndefinedProperties(obj[key])
      if (value !== undefined) {
        result[key] = value
      }
    }
  }
  return result
}
