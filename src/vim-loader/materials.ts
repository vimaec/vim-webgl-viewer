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
    transparent: THREE.MeshPhongMaterial
    wireframe: THREE.LineBasicMaterial
    isolation: THREE.ShaderMaterial

    constructor (
      opaque?: THREE.Material,
      transparent?: THREE.MeshPhongMaterial,
      wireframe?: THREE.LineBasicMaterial,
      isolation?: THREE.ShaderMaterial
    ) {
      this.opaque = opaque ?? createOpaque()
      this.transparent = transparent ?? createTransparent()
      this.wireframe = wireframe ?? createWireframe()
      this.isolation = isolation ?? createCustomIsolationMaterial()
    }

    applyWireframeSettings (color: THREE.Color, opacity: number) {
      this.wireframe.color = color
      this.wireframe.opacity = opacity
    }

    applyIsolationSettings (color: THREE.Color, opacity: number) {
      this.isolation.uniforms.fillColor.value = color
      this.isolation.uniforms.opacity.value = opacity
      this.isolation.uniformsNeedUpdate = true
    }

    dispose () {
      this.opaque.dispose()
      this.transparent.dispose()
      this.wireframe.dispose()
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

  /**
   * Creates a new instance of the default shape material used for isolation
   * @returns a THREE.Material
   */
  export function createShape () {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0, 0.8, 1),
      flatShading: true
    })
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

        // attribute for color override
        // merged meshes use it as vertex attribute
        // instanced meshes use it as an instance attribute
        attribute float colored;

        // There seems to be an issue where setting mehs.instanceColor
        // doesn't properly set USE_INSTANCING_COLOR
        // so we always use it as a fix
        #ifndef USE_INSTANCING_COLOR
        attribute vec3 instanceColor;
        #endif

        // Passed to fragment to ignore phong model
        varying float vColored;
        
        // VISIBILITY

        // Instance or vertex attribute to hide objects 
        #ifdef USE_INSTANCING
          attribute float ignoreInstance;
        #else
          attribute float ignoreVertex;
        #endif

        // Passed to fragment to discard them
        varying float vIgnore;

        `
      )
      // Adding vertex shader logic for visility and coloring
      .replace(
        '#include <color_vertex>',
        `
          // COLORING
          vColor = color;
          vColored = colored;

          // colored == 1 -> instance color
          // colored == 0 -> vertex color
          #ifdef USE_INSTANCING
            vColor.xyz = colored * instanceColor.xyz + (1.0f - colored) * color.xyz;
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
        varying float vColored;
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
          // vColored == 1 -> Vertex Color * light 
          // vColored == 0 -> Phong Color 
          float d = length(outgoingLight);
          gl_FragColor = vec4(vColored * vColor.xyz * d + (1.0f - vColored) * outgoingLight.xyz, diffuseColor.a);
        `
      )
    return shader
  }

  export function createCustomIsolationMaterial () {
    return new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: 0.1 },
        fillColor: { value: new THREE.Vector3(0.5, 0.5, 0.5) }
      },
      vertexColors: true,
      transparent: true,
      clipping: true,
      vertexShader: /* glsl */ `

      #include <common>
      #include <logdepthbuf_pars_vertex>
      #include <clipping_planes_pars_vertex>
        
      // VISIBILITY
      // Instance or vertex attribute to hide objects 
      #ifdef USE_INSTANCING
        attribute float ignoreInstance;
      #else
        attribute float ignoreVertex;
      #endif

      // Passed to fragment to discard them
      varying float vIgnore;
      varying vec3 vPosition;


      // COLORING
      varying vec3 vColor;

      // attribute for color override
      // merged meshes use it as vertex attribute
      // instanced meshes use it as an instance attribute
      attribute float colored;

      // There seems to be an issue where setting mehs.instanceColor
      // doesn't properly set USE_INSTANCING_COLOR
      // so we always use it as a fix
      #ifndef USE_INSTANCING_COLOR
      attribute vec3 instanceColor;
      #endif

      void main() {
        #include <begin_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        #include <logdepthbuf_vertex>

        // VISIBILITY
        // Set frag ignore from instance or vertex attribute
        #ifdef USE_INSTANCING
          vIgnore = ignoreInstance;
        #else
          vIgnore = ignoreVertex;
        #endif

        // COLORING
        vColor = color.xyz;

        // colored == 1 -> instance color
        // colored == 0 -> vertex color
        #ifdef USE_INSTANCING
          vColor.xyz = colored * instanceColor.xyz + (1.0f - colored) * color.xyz;
        #endif


        // ORDERING
        if(vIgnore > 0.0f){
          gl_Position.z = 1.0f;
        }else{
          gl_Position.z = -1.0f;
        }

        // LIGHTING
        vPosition = vec3(mvPosition ) / mvPosition .w;
      }
      `,
      fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      varying float vIgnore;
      uniform float opacity;
      uniform vec3 fillColor;
      varying vec3 vPosition;
      varying vec3 vColor;

      void main() {
        #include <clipping_planes_fragment>

        if (vIgnore > 0.0f){
          gl_FragColor = vec4(fillColor, opacity);
        }
        else{ 
          gl_FragColor = vec4(vColor.x, vColor.y, vColor.z, 1.0f);

          // LIGHTING
          vec3 normal = normalize( cross(dFdx(vPosition), dFdy(vPosition)) );
          float light = dot(normal, normalize(vec3(1.4142f, 1.732f, 2.2360f)));
          light = 0.5 + (light *0.5);
          gl_FragColor.xyz *= light;
        }
      }
      `
    })
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
  }
}
