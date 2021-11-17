import * as THREE from 'three'

// vim
import { VIMLoader } from '../vim-loader/VIMLoader'
import { VimScene } from '../vim-loader/vimScene'

// Other loaders
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import {
  ColladaLoader,
  Collada
} from 'three/examples/jsm/loaders/ColladaLoader'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { GCodeLoader } from 'three/examples/jsm/loaders/GCodeLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

// Material
const defaultMaterial = new THREE.MeshPhongMaterial({
  color: 0x999999,
  vertexColors: true,
  flatShading: true,
  // TODO: experiment without being double-sided
  side: THREE.DoubleSide,
  shininess: 70
})

function getExt (fileName: string): string {
  const indexOfQueryParams = fileName.lastIndexOf('?')
  if (indexOfQueryParams >= 0) {
    fileName = fileName.substring(0, indexOfQueryParams)
  }
  const extPos = fileName.lastIndexOf('.')
  return fileName.slice(extPos + 1).toLowerCase()
}

export const loadAny = function (
  fileName: string,
  onFileLoaded: (
    result:
      | VimScene
      | THREE.Scene
      | THREE.Group
      | THREE.Object3D
      | THREE.BufferGeometry
  ) => void,
  onProgress: (progress: ProgressEvent) => void,
  onError: (error: ErrorEvent) => void,
  overrideFileExtension: string | null = null
) {
  const ext = overrideFileExtension ?? getExt(fileName)

  switch (ext) {
    case '3ds': {
      new TDSLoader().load(fileName, onFileLoaded)
      return
    }
    case 'fbx': {
      new FBXLoader().load(fileName, onFileLoaded)
      return
    }
    case 'dae': {
      new ColladaLoader().load(fileName, (result: Collada) => {
        onFileLoaded(result.scene)
      })
      return
    }
    case 'gltf': {
      new GLTFLoader().load(fileName, (result: GLTF) => {
        onFileLoaded(result.scene)
      })
      return
    }
    case 'gcode': {
      new GCodeLoader().load(fileName, onFileLoaded)
      break
    }
    case 'obj': {
      new OBJLoader().load(fileName, onFileLoaded)
      break
    }
    case 'pcd': {
      new PCDLoader().load(fileName, onFileLoaded)
      break
    }
    case 'ply': {
      new PLYLoader().load(fileName, onFileLoaded)
      break
    }
    case 'stl': {
      new STLLoader().load(fileName, onFileLoaded)
      break
    }
    case 'vim': {
      new VIMLoader(defaultMaterial).load(
        fileName,
        onFileLoaded,
        onProgress,
        onError
      )
      break
    }
    default:
      throw new Error(
        "Unrecognized file type extension '" + ext + "' for file " + fileName
      )
  }
}
