/**
 * @module vim-loader
 */

import * as THREE from 'three'

/**
 * Collection of Materials used to draw model and effects.
 * Vim default materials are are modified to add visibilty and coloring capabilites.
 */
export interface IMaterialLibrary {
  /**
   * Material used to draw opaque building surfaces.
   */
  get opaque(): THREE.Material
  /**
   * Material used to draw transparent building surfaces.
   */
  get transparent(): THREE.Material
  /**
   * Material used to draw selection highlights.
   */
  get wireframe(): THREE.Material
  /**
   * Material used for isolation mode to show objects in context.
   */
  get isolation(): THREE.Material
  dispose(): void
}

/**
 * Defines the materials to be used by the vim loader and allows for material injection.
 */
export class VimMaterials implements IMaterialLibrary {
  opaque: THREE.Material
  transparent: THREE.MeshPhongMaterial
  wireframe: THREE.LineBasicMaterial
  isolation: THREE.Material

  constructor (
    opaque?: THREE.Material,
    transparent?: THREE.MeshPhongMaterial,
    wireframe?: THREE.LineBasicMaterial,
    isolation?: THREE.Material
  ) {
    this.opaque = opaque ?? createOpaque()
    this.transparent = transparent ?? createTransparent()
    this.wireframe = wireframe ?? createWireframe()
    this.isolation = isolation ?? createIsolationMaterial()
  }

  applyWireframeSettings (color: THREE.Color, opacity: number) {
    this.wireframe.color = color
    this.wireframe.opacity = opacity
  }

  applyIsolationSettings (color: THREE.Color, opacity: number) {
    // this.isolation.uniforms.fillColor.value = color
    // this.isolation.uniforms.opacity.value = opacity
    // this.isolation.uniformsNeedUpdate = true
  }

  dispose () {
    this.opaque.dispose()
    this.transparent.dispose()
    this.wireframe.dispose()
    this.isolation.dispose()
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
    shininess: 5
  })
}

/**
 * Creates a new instance of the default opaque material used by the vim-loader
 * @returns a THREE.MeshPhongMaterial
 */
export function createOpaque () {
  const mat = createBase()
  patchBaseMaterial(mat)
  return mat
}

/**
 * Creates a new instance of the default loader transparent material
 * @returns a THREE.MeshPhongMaterial
 */
export function createTransparent () {
  const mat = createBase()
  mat.transparent = true
  mat.shininess = 70
  patchBaseMaterial(mat)
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
 * Patches phong shader to be able to control when lighting should be applied to resulting color.
 * Instanced meshes ignore light when InstanceColor is defined
 * Instanced meshes ignore vertex color when instance attribute useVertexColor is 0
 * Regular meshes ignore light in favor of vertex color when uv.y = 0
 */
export function patchBaseMaterial (material: THREE.Material) {
  material.onBeforeCompile = (shader) => {
    material.userData.shader = shader
    shader.vertexShader = shader.vertexShader
      // VERTEX DECLARATIONS
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
      // VERTEX IMPLEMENTATION
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
    // FRAGMENT DECLARATIONS
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
      // FRAGMENT IMPLEMENTATION
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
  }
}

/**
 * Material for isolation mode
 * Non visible item appear as transparent.
 * Visible items are flat shaded with a basic pseudo lighting.
 * Supports object coloring but in which.
 */
export function createIsolationMaterial () {
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
