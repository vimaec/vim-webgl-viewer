/**
 * Defines how loader materials are created and allows replacement
 * @module vim-loader
 */

import * as THREE from 'three'

/**
 * Defines the materials to be used by the vim loader.
 * @returns a THREE.MeshPhongMaterial
 */
export class MaterialLibrary {
  opaque: THREE.Material
  transparent: THREE.Material | undefined
  wireframe: THREE.Material | undefined

  constructor (
    opaque?: THREE.Material,
    transparent?: THREE.Material,
    wireframe?: THREE.Material
  ) {
    this.opaque = opaque ?? createOpaqueMaterial()
    this.transparent = transparent ?? createTransparentMaterial()
    this.wireframe = wireframe ?? createWireframeMaterial()
  }
}

/**
 * Creates a non-custom instance of phong material as used by the vim loader
 * @returns a THREE.MeshPhongMaterial
 */
export function createBaseMaterial () {
  return new THREE.MeshPhongMaterial({
    color: 0x999999,
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
    shininess: 70
  })
}

/**
 * Creates a new instance of the default opaque material used by the vim-loader
 * @returns a THREE.MeshPhongMaterial
 */
export function createOpaqueMaterial () {
  const mat = createBaseMaterial()
  patchMaterial(mat)
  return mat
}

/**
 * Creates a new instance of the default loader transparent material
 * @returns a THREE.MeshPhongMaterial
 */
export function createTransparentMaterial () {
  const mat = createBaseMaterial()
  mat.transparent = true
  patchMaterial(mat)
  return mat
}

/**
 * Adds feature to default three material to support color change.
 * Developed and tested for Phong material, but might work for other materials.
 */
export function patchMaterial (material: THREE.Material) {
  material.defines = { USE_UV: true }
  material.onBeforeCompile = (shader) => {
    patchShader(shader)
    material.userData.shader = shader
  }
}

/**
 * Patches phong shader to be able to control when lighting should be applied to resulting color.
 * Instanced meshes ignore light when InstanceColor is defined
 * Instanced meshes ignore vertex color when instance attribute useVertexColor is 0
 * Regular meshes ignore light in favor of vertex color when uv.y = 0
 */
export function patchShader (shader: THREE.Shader) {
  shader.vertexShader = shader.vertexShader
    // Add useVertexColor when instanced colors are used.
    .replace(
      '#include <color_pars_vertex>',
      `
        #include <color_pars_vertex>
        #ifdef USE_INSTANCING_COLOR
        attribute float useVertexColor;
        #endif
        `
    )
    // Define uvs for instanced meshes
    .replace(
      '#include <uv_vertex>',
      `
        #include <uv_vertex>

        #ifdef USE_INSTANCING
          #ifdef USE_INSTANCING_COLOR
            vUv = vec2(uv.x, useVertexColor);
          #else
            vUv = vec2(uv.x, 1.0);
          #endif
        #endif
        `
    )
    // Ignore vertex colors when useVertexColor = 0 in instanced meshes
    .replace(
      '#include <color_vertex>',
      `
        #include <color_vertex>

        #ifdef USE_INSTANCING_COLOR
          vColor.xyz = ((1.0f - useVertexColor) * instanceColor.xyz) + (useVertexColor * color.xyz);
        #endif
        `
    )

  // Draw vertex color instead of phong model when Uv.y = 0
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <output_fragment>',
    `
        float d = length(outgoingLight);
        gl_FragColor = vec4(vColor.xyz * (1.0f - vUv.y) * d + outgoingLight.xyz * vUv.y , diffuseColor.a);
      `
  )
  return shader
}

/**
 * Creates a new instance of the default wireframe material
 * @returns a THREE.LineBasicMaterial
 */
export function createWireframeMaterial (): THREE.Material {
  const material = new THREE.LineBasicMaterial({
    depthTest: false,
    opacity: 0.5,
    color: new THREE.Color(0x0000ff),
    transparent: true
  })
  return material
}

let materials: MaterialLibrary
export const getDefaultMaterialLibrary = () =>
  materials ?? new MaterialLibrary()
