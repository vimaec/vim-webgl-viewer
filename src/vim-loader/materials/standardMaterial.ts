/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'

/**
 * Type alias for THREE uniforms
 */
export type ShaderUniforms = { [uniform: string]: THREE.IUniform<any> }

/**
 * Material used for both opaque and tranparent surfaces of a VIM model.
 */
export class StandardMaterial {
  material: THREE.Material
  uniforms: ShaderUniforms | undefined

  // Parameters
  _focusIntensity: number = 0.5
  _focusColor: THREE.Color = new THREE.Color(1, 1, 1)

  _sectionStrokeWitdh: number = 0.01
  _sectionStrokeFallof: number = 0.75
  _sectionStrokeColor: THREE.Color = new THREE.Color(0xf6, 0xf6, 0xf6)

  constructor (material: THREE.Material) {
    this.material = material
    this.patchShader(material)
  }

  get focusIntensity () {
    return this._focusIntensity
  }

  set focusIntensity (value: number) {
    this._focusIntensity = value
    if (this.uniforms) {
      this.uniforms.focusIntensity.value = value
    }
  }

  get focusColor () {
    return this._focusColor
  }

  set focusColor (value: THREE.Color) {
    this._focusColor = value
    if (this.uniforms) {
      this.uniforms.focusColor.value = value
    }
  }

  get sectionStrokeWitdh () {
    return this._sectionStrokeWitdh
  }

  set sectionStrokeWitdh (value: number) {
    this._sectionStrokeWitdh = value
    if (this.uniforms) {
      this.uniforms.sectionStrokeWitdh.value = value
    }
  }

  get sectionStrokeFallof () {
    return this._sectionStrokeFallof
  }

  set sectionStrokeFallof (value: number) {
    this._sectionStrokeFallof = value
    if (this.uniforms) {
      this.uniforms.sectionStrokeFallof.value = value
    }
  }

  get sectionStrokeColor () {
    return this._sectionStrokeColor
  }

  set sectionStrokeColor (value: THREE.Color) {
    this._sectionStrokeColor = value
    if (this.uniforms) {
      this.uniforms.sectionStrokeColor.value = value
    }
  }

  get clippingPlanes () {
    return this.material.clippingPlanes
  }

  set clippingPlanes (value: THREE.Plane[] | null) {
    this.material.clippingPlanes = value
  }

  dispose () {
    this.material.dispose()
  }

  /**
   * Patches phong shader to be able to control when lighting should be applied to resulting color.
   * Instanced meshes ignore light when InstanceColor is defined
   * Instanced meshes ignore vertex color when instance attribute useVertexColor is 0
   * Regular meshes ignore light in favor of vertex color when uv.y = 0
   */
  patchShader (material: THREE.Material) {
    material.onBeforeCompile = (shader) => {
      this.uniforms = shader.uniforms
      this.uniforms.focusIntensity = { value: this._focusIntensity }
      this.uniforms.focusColor = { value: this._focusColor }
      this.uniforms.sectionStrokeWidth = { value: this._sectionStrokeWitdh }
      this.uniforms.sectionStrokeFalloff = { value: this._sectionStrokeFallof }
      this.uniforms.sectionStrokeColor = { value: this._sectionStrokeColor }

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
        // Used as instance attribute for instanced mesh and as vertex attribute for merged meshes. 
        attribute float ignore; 

        // Passed to fragment to discard them
        varying float vIgnore;

        // FOCUS
        // Instance or vertex attribute to higlight objects
        // Used as instance attribute for instanced mesh and as vertex attribute for merged meshes. 
        attribute float focused; 
        varying float vHighlight;
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
          vIgnore = ignore;
          
          // FOCUS
          vHighlight = focused;
        `
        )
      // FRAGMENT DECLARATIONS
      shader.fragmentShader = shader.fragmentShader
        // Adding declarations for varying defined in vertex shader
        .replace(
          '#include <clipping_planes_pars_fragment>',
          `
        #include <clipping_planes_pars_fragment>
        // VISIBILITY
        varying float vIgnore;

        // COLORING
        varying float vColored;

        // SECTION
        uniform float sectionStrokeWidth;
        uniform float sectionStrokeFalloff;
        uniform vec3 sectionStrokeColor;

        // FOCUS
        varying float vHighlight;
        uniform float focusIntensity;
        uniform vec3 focusColor; 
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

          // FOCUS
          gl_FragColor = mix(gl_FragColor, vec4(focusColor,1.0f), vHighlight * focusIntensity);
          
          // STROKES WHERE GEOMETRY INTERSECTS CLIPPING PLANE
          #if NUM_CLIPPING_PLANES > 0
            vec4 strokePlane;
            float strokeDot;
            vec3 worldNormal;
            vec3 worldPlane;
            float worldDot;
            float thick = pow(vFragDepth,sectionStrokeFalloff) * sectionStrokeWidth;
            #pragma unroll_loop_start
            for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
              strokePlane = clippingPlanes[ i ];
              strokeDot = dot(vClipPosition, strokePlane.xyz);

              // We don't want fully perpendicular surface to become colored.
              worldNormal =  inverseTransformDirection(normal, viewMatrix);
              worldPlane = inverseTransformDirection(strokePlane.xyz, viewMatrix);
              worldDot = abs(dot(worldNormal, worldPlane));

              if (strokeDot > strokePlane.w) discard;
              if ((strokePlane.w - strokeDot) < thick) {
                float strength = (strokePlane.w - strokeDot) * pow(1.0f - worldDot, 2.0f) / thick;
                gl_FragColor = vec4(mix(gl_FragColor.xyz, sectionStrokeColor, strength), 1.0f);
                return;
              }
            }
            #pragma unroll_loop_end
          #endif  
        `
        )
    }
  }
}
