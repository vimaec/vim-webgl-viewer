/**
 * Provides methods to create Three.Mesh from BufferGeometry and g3d geometry data.
 * @module vim-loader
 */

import * as THREE from 'three'
import { ShaderChunk, ShaderLib } from 'three'
import { G3d } from './g3d'
import * as vimGeometry from './geometry'

/**
 * Builds meshes from the g3d and BufferGeometry
 * Allows to reuse the same material for all new built meshes
 */
export class MeshBuilder {
  materialOpaque: THREE.Material
  materialTransparent: THREE.Material | undefined
  wireframeMaterial: THREE.Material | undefined

  constructor (
    materialOpaque?: THREE.Material,
    materialTransparent?: THREE.Material,
    wireframeMaterial?: THREE.Material
  ) {
    this.materialOpaque = materialOpaque ?? this.createDefaultOpaqueMaterial2()
    this.materialTransparent =
      materialTransparent ?? this.createDefaultTransparentMaterial2()
    this.wireframeMaterial =
      wireframeMaterial ?? this.createDefaultWireframeMaterial()
  }

  /**
   * Creates a new instance of the default loader opaque material
   * @returns a THREE.MeshPhongMaterial
   */
  createDefaultOpaqueMaterial () {
    const phong = new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      shininess: 70
    })
    /*
    phong.defines = { USE_UV: true }
    phong.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        'float d = length(outgoingLight);\n' +
          'gl_FragColor = vec4(vColor * (1.0f - vUv.y) * d + outgoingLight * vUv.y , 1);'
      )
      phong.userData.shader = shader
    }
    phong.customProgramCacheKey = () => 'custom'
*/
    return phong
  }

  createDefaultOpaqueMaterial2 () {
    const phong = new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      shininess: 70
    })

    phong.defines = { USE_UV: true }
    phong.onBeforeCompile = (shader) => {
      this.patchMixedShader(shader)
      phong.userData.shader = shader
    }

    return phong
  }

  patchMergedShader (shader: THREE.Shader) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      'float d = length(outgoingLight);\n' +
        'gl_FragColor = vec4(vColor * (1.0f - vUv.y) * d + outgoingLight * vUv.y , 1);'
    )
    return shader
  }

  patchInstancedShader (shader: THREE.Shader) {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <color_pars_vertex>',
        '#include <color_pars_vertex>\n' + 'attribute float useVertexColor;'
      )
      .replace(
        '#include <color_vertex>',
        `vColor = color;
     #ifdef USE_INSTANCING_COLOR
       vColor.xyz = ((1.0f - useVertexColor) * instanceColor.xyz) + (useVertexColor * outgoingLight.xyz);
     #endif`
      )
    return shader
  }

  patchMixedShader (shader: THREE.Shader) {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <color_pars_vertex>',
        `
        #include <color_pars_vertex>
        #ifdef USE_INSTANCING 
        attribute float useVertexColor;
        #endif
        `
      )
      .replace(
        '#include <color_vertex>',
        `
        #include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vColor.xyz = ((1.0f - useVertexColor) * instanceColor.xyz) + (useVertexColor * color.xyz);
        #endif
        `
      )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `
      #ifdef USE_INSTANCING 
        #include <output_fragment>
      #else
        float d = length(outgoingLight);
        gl_FragColor = vec4(vColor.xyz * (1.0f - vUv.y) * d + outgoingLight.xyz * vUv.y , diffuseColor.a);
      #endif
      `
    )
    return shader
  }

  createDefaultTransparentMaterial2 () {
    const phong = new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
      transparent: true,
      shininess: 70
    })

    phong.defines = { USE_UV: true }
    phong.onBeforeCompile = (shader) => {
      this.patchMixedShader(shader)
      phong.userData.shader = shader
    }
    return phong
  }

  /**
   * Creates a new instance of the default loader transparent material
   * @returns a THREE.MeshPhongMaterial
   */
  createDefaultTransparentMaterial () {
    const phong = new THREE.MeshPhongMaterial({
      color: 0x999999,
      vertexColors: true,
      flatShading: true,
      // TODO: experiment without being double-sided
      side: THREE.DoubleSide,
      transparent: true,
      shininess: 70
    })
    /*
    phong.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <color_pars_vertex>',
          '#include <color_pars_vertex>\n' + 'attribute float useVertexColor;'
        )
        .replace(
          '#include <color_vertex>',
          `vColor = color;
         #ifdef USE_INSTANCING_COLOR
	         vColor.xyz = ((1.0f - useVertexColor) * instanceColor.xyz) + (useVertexColor * vColor.xyz);
         #endif`
        )

        ShaderChunk.color_vertex.replace(
          'vColor.xyz *= instanceColor.xyz;',
          // 'vColor.xyz = instanceColor.xyz;'
          'vColor.xyz = vec3(0,0,0);'
        )
      // )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        'gl_FragColor = vec4(vColor);'

        // 'float d = length(outgoingLight);\n' +
        // 'gl_FragColor = vec4(vColor.xyz * (1.0f - vUseLight) * d + outgoingLight * vUseLight , vColor.w);'
      )

      phong.userData.shader = shader
    }
    phong.customProgramCacheKey = () => 'custom'
*/
    return phong
  }

  /**
   * Creates a new instance of the default wireframe material
   * @returns a THREE.LineBasicMaterial
   */
  createDefaultWireframeMaterial (): THREE.Material {
    const material = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    return material
  }

  /**
   * Creates Instanced Meshes from the g3d data
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances instance indices from the g3d for which meshes will be created.
   *  If undefined, all multireferenced meshes will be created.
   * @returns an array of THREE.InstancedMesh
   */
  createInstancedMeshes (
    g3d: G3d,
    transparency: vimGeometry.TransparencyMode,
    instances?: number[]
  ): THREE.InstancedMesh[] {
    const result: THREE.InstancedMesh[] = []
    const set = instances ? new Set(instances) : undefined
    for (let mesh = 0; mesh < g3d.getMeshCount(); mesh++) {
      let meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances) continue
      meshInstances = set
        ? meshInstances.filter((i) => set.has(i))
        : meshInstances
      if (meshInstances.length <= 1) continue
      if (
        !vimGeometry.transparencyMatches(
          transparency,
          g3d.meshTransparent[mesh]
        )
      ) {
        continue
      }

      const useAlpha =
        vimGeometry.transparencyRequiresAlpha(transparency) &&
        g3d.meshTransparent[mesh]
      const geometry = vimGeometry.createFromMesh(g3d, mesh, useAlpha)
      const resultMesh = this.createInstancedMesh(
        geometry,
        g3d,
        meshInstances,
        useAlpha
      )

      result.push(resultMesh)
    }

    return result
  }

  /**
   * Creates a InstancedMesh from g3d data and given instance indices
   * @param geometry Geometry to use in the mesh
   * @param instances Instance indices for which matrices will be applied to the mesh
   * @param useAlpha Specify whether to use RGB or RGBA
   * @returns a THREE.InstancedMesh
   */
  createInstancedMesh (
    geometry: THREE.BufferGeometry,
    g3d: G3d,
    instances: number[],
    useAlpha: boolean
  ) {
    const material = useAlpha ? this.materialTransparent : this.materialOpaque

    const result = new THREE.InstancedMesh(geometry, material, instances.length)

    for (let i = 0; i < instances.length; i++) {
      const matrix = vimGeometry.getInstanceMatrix(g3d, instances[i])
      result.setMatrixAt(i, matrix)
    }
    result.userData.instances = instances
    return result
  }

  /**
   * Create a merged mesh from g3d instance indices
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a THREE.Mesh
   */
  createMergedMesh (
    g3d: G3d,
    transparency: vimGeometry.TransparencyMode,
    instances?: number[]
  ): THREE.Mesh {
    const merger = instances
      ? vimGeometry.MeshMerger.MergeInstances(g3d, instances, transparency)
      : vimGeometry.MeshMerger.MergeUniqueMeshes(g3d, transparency)

    const geometry = merger.toBufferGeometry()
    const material = vimGeometry.transparencyRequiresAlpha(transparency)
      ? this.materialTransparent
      : this.materialOpaque

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.merged = true
    mesh.userData.instances = merger.instances
    mesh.userData.submeshes = merger.submeshes

    return mesh
  }

  createWireframe (g3d: G3d, instances: number[]) {
    const geometry = vimGeometry.createFromInstances(g3d, instances)

    const wireframe = new THREE.WireframeGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    return new THREE.LineSegments(wireframe, material)
  }
}

let defaultBuilder: MeshBuilder
export function getDefaultBuilder () {
  return defaultBuilder ?? (defaultBuilder = new MeshBuilder())
}
