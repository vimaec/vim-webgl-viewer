/**
 * @module vim-loader
 */

import * as THREE from 'three'

export namespace Materials {
  /**
   * Defines the materials to be used by the vim loader and allows for material injection.
   */
  export class Library {
    opaque: THREE.Material
    transparent: THREE.Material | undefined
    wireframe: THREE.LineBasicMaterial | undefined

    constructor (
      opaque?: THREE.Material,
      transparent?: THREE.Material,
      wireframe?: THREE.LineBasicMaterial
    ) {
      this.opaque = opaque ?? createOpaque()
      this.transparent = transparent ?? createTransparent()
      this.wireframe = wireframe ?? createWireframe()
    }

    dispose () {
      this.opaque.dispose()
      this.transparent.dispose()
      this.wireframe.dispose()

      this.opaque = undefined
      this.transparent = undefined
      this.wireframe = undefined
    }
  }

  /**
   * Creates a non-custom instance of phong material as used by the vim loader
   * @returns a THREE.MeshPhongMaterial
   */
  export function createBase () {
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
  export function createOpaque () {
    const mat = createBase()
    patchMaterial(mat)
    return mat
  }

  /**
   * Creates a new instance of the default loader transparent material
   * @returns a THREE.MeshPhongMaterial
   */
  export function createTransparent () {
    const mat = createBase()
    mat.transparent = true
    patchMaterial(mat)
    return mat
  }

  /**
   * Adds feature to default three material to support color change.
   * Developed and tested for Phong material, but might work for other materials.
   */
  export function patchMaterial (material: THREE.Material) {
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
      // Adding declarations for attributes and varying for visibility and coloring.
      .replace(
        '#include <color_pars_vertex>',
        `
        #include <color_pars_vertex>
        
        // COLORING

        // Vertex attribute for color override
        #ifdef USE_INSTANCING
          attribute float ignoreVertexColor;
        #endif

        // There seems to be an issue where setting mehs.instanceColor
        // doesn't properly set USE_INSTANCING_COLOR
        // so we always use it as a fix
        #ifndef USE_INSTANCING_COLOR
        attribute vec3 instanceColor;
        #endif

        // Passed to fragment to ignore phong model
        varying float vIgnorePhong;
        
        // VISIBILITY
      
        // Passed to fragment to discard them
        varying float vIgnore;

        // Instance or vertex attribute to hide objects 
        #ifdef USE_INSTANCING
          attribute float ignoreInstance;
        #else
          attribute float ignoreVertex;
        #endif
        `
      )
      // Adding vertex shader logic for visility and coloring
      .replace(
        '#include <color_vertex>',
        `
          vColor = color;
          vIgnorePhong = 0.0f;

          // COLORING

          // ignoreVertexColor == 1 -> instance color
          // ignoreVertexColor == 0 -> vertex color
          #ifdef USE_INSTANCING
            vIgnorePhong = ignoreVertexColor;
            vColor.xyz = ignoreVertexColor * instanceColor.xyz + (1.0f - ignoreVertexColor) * color.xyz;
          #endif


          // VISIBILITY

          // Set frag ignore from instance or vertex attribute
          #ifdef USE_INSTANCING
            vIgnore = ignoreInstance;
          #else
            vIgnore = ignoreVertex;
          #endif

        `
      )

    shader.fragmentShader = shader.fragmentShader
      // Adding declarations for varying defined in vertex shader
      .replace(
        '#include <clipping_planes_pars_fragment>',
        `
        #include <clipping_planes_pars_fragment>
        varying float vIgnore;
        varying float vIgnorePhong;
        `
      )
      // Adding fragment shader logic for visibility and coloring.
      .replace(
        '#include <output_fragment>',
        `
          // VISIBILITY
          if (vIgnore > 0.0f)
            discard;
         
          // COLORING
          // vIgnorePhong == 1 -> Vertex Color * light 
          // vIgnorePhong == 0 -> Phong Color 
          float d = length(outgoingLight);
          gl_FragColor = vec4(vIgnorePhong * vColor.xyz * d + (1.0f - vIgnorePhong) * outgoingLight.xyz, diffuseColor.a);
        `
      )
    return shader
  }

  /**
   * Creates a new instance of the default wireframe material
   * @returns a THREE.LineBasicMaterial
   */
  export function createWireframe () {
    const material = new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 1,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
    return material
  }
  let materials: Library

  /**
   * Get or create a singleton material library with default materials
   */
  export function getDefaultLibrary () {
    materials = materials ?? new Library()
    return materials
  }

  /**
   * Disposes the singleton material library
   */
  export function dispose () {
    materials.dispose()
    materials = undefined
  }
}
