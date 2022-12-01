import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

// Follows the structure of
// https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutlinePass.js
// Based on https://github.com/OmarShehata/webgl-outlines/blob/cf81030d6f2bc20e6113fbf6cfd29170064dce48/threejs/src/CustomOutlinePass.js

export class SelectionOutlinePass extends Pass {
  private _camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private _resolution: THREE.Vector2
  private _fsQuad: FullScreenQuad
  private _uniforms: { [uniform: string]: THREE.IUniform<any> }

  constructor (
    resolution: THREE.Vector2,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    sceneTexture: THREE.Texture
  ) {
    super()

    this._camera = camera
    this._resolution = new THREE.Vector2(resolution.x, resolution.y)

    this._fsQuad = new FullScreenQuad(null)
    const mat = this.createOutlinePostProcessMaterial()
    this._fsQuad.material = mat
    this._uniforms = mat.uniforms
    this._uniforms.sceneColorBuffer.value = sceneTexture
  }

  dispose () {
    this._fsQuad.dispose()
  }

  get camera () {
    return this._camera
  }

  set camera (value: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this._uniforms.cameraNear.value = value.near
    this._uniforms.cameraFar.value = value.far
    this._camera = value
  }

  setSize (width, height) {
    this._resolution.set(width, height)

    this._uniforms.screenSize.value.set(
      this._resolution.x,
      this._resolution.y,
      1 / this._resolution.x,
      1 / this._resolution.y
    )
  }

  get strokeBias () {
    return this._uniforms.strokeBias.value
  }

  set strokeBias (value: number) {
    this._uniforms.strokeBias.value = value
  }

  get strokeMultiplier () {
    return this._uniforms.strokeMultiplier.value
  }

  set strokeMultiplier (value: number) {
    this._uniforms.strokeMultiplier.value = value
  }

  get color () {
    return this._uniforms.outlineColor.value
  }

  set color (value: THREE.Color) {
    this._uniforms.outlineColor.value.set(value)
  }

  render (
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    // Turn off writing to the depth buffer
    // because we need to read from it in the subsequent passes.
    const depthBufferValue = writeBuffer.depthBuffer
    writeBuffer.depthBuffer = false
    this._uniforms.depthBuffer.value = readBuffer.depthTexture

    // 2. Draw the outlines using the depth texture and normal texture
    // and combine it with the scene color
    if (this.renderToScreen) {
      // If this is the last effect, then renderToScreen is true.
      // So we should render to the screen by setting target null
      // Otherwise, just render into the writeBuffer that the next effect will use as its read buffer.
      renderer.setRenderTarget(null)
      this._fsQuad.render(renderer)
    } else {
      renderer.setRenderTarget(writeBuffer)
      this._fsQuad.render(renderer)
    }

    // Reset the depthBuffer value so we continue writing to it in the next render.
    writeBuffer.depthBuffer = depthBufferValue
  }

  get vertexShader () {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
      `
  }

  get fragmentShader () {
    return `
    #include <packing>
    // The above include imports "perspectiveDepthToViewZ"
    // and other GLSL functions from ThreeJS we need for reading depth.
    uniform sampler2D sceneColorBuffer;
    uniform sampler2D depthBuffer;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec4 screenSize;
    uniform vec3 outlineColor;
    uniform float strokeMultiplier;
    uniform float strokeBias;
    uniform int debugVisualize;

    varying vec2 vUv;

    // Helper functions for reading from depth buffer.
    float readDepth (sampler2D depthSampler, vec2 coord) {
      float fragCoordZ = texture2D(depthSampler, coord).x;
      float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
      return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
    }
    float getLinearDepth(vec3 pos) {
      return -(viewMatrix * vec4(pos, 1.0)).z;
    }

    float getLinearScreenDepth(sampler2D map) {
        vec2 uv = gl_FragCoord.xy * screenSize.zw;
        return readDepth(map,uv);
    }
    // Helper functions for reading normals and depth of neighboring pixels.
    float getPixelDepth(int x, int y) {
      // screenSize.zw is pixel size 
      // vUv is current position
      return readDepth(depthBuffer, vUv + screenSize.zw * vec2(x, y));
    }

    float saturate(float num) {
      return clamp(num, 0.0, 1.0);
    }

    void main() {
      vec4 sceneColor = texture2D(sceneColorBuffer, vUv);
      float depth = getPixelDepth(0, 0);

      // Get the difference between depth of neighboring pixels and current.
      float depthDiff = 0.0;
      depthDiff += abs(depth - getPixelDepth(1, 0));
      depthDiff += abs(depth - getPixelDepth(-1, 0));
      depthDiff += abs(depth - getPixelDepth(0, 1));
      depthDiff += abs(depth - getPixelDepth(0, -1));

      depthDiff += abs(depth - getPixelDepth(1, 1));
      depthDiff += abs(depth - getPixelDepth(1, -1));
      depthDiff += abs(depth - getPixelDepth(-1, 1));
      depthDiff += abs(depth - getPixelDepth(-1, -1));

      depthDiff += abs(depth - getPixelDepth(2, 0));
      depthDiff += abs(depth - getPixelDepth(-2, 0));
      depthDiff += abs(depth - getPixelDepth(0, 2));
      depthDiff += abs(depth - getPixelDepth(0, -2));

      depthDiff = depthDiff  / 12.0f; 
      
      depthDiff = depthDiff * strokeMultiplier;
      depthDiff = saturate(depthDiff);
      depthDiff = pow(depthDiff, strokeBias);

      float outline = depthDiff;

      // Combine outline with scene color.
      vec4 outlineColor = vec4(outlineColor, 1.0f);
      gl_FragColor = vec4(mix(sceneColor, outlineColor, outline));
      //gl_FragColor = vec4( outline,outline,outline,outline);

      // For debug visualization of the different inputs to this shader.
      if (debugVisualize == 1) {
        gl_FragColor = sceneColor;
      }
      if (debugVisualize == 2) {
        gl_FragColor = vec4(vec3(depth), 1.0);
      }
      if (debugVisualize == 4) {
        gl_FragColor = vec4(vec3(outline * outlineColor), 1.0);
      }
    }
    `
  }

  createOutlinePostProcessMaterial () {
    return new THREE.ShaderMaterial({
      uniforms: {
        debugVisualize: { value: 0 },
        sceneColorBuffer: { value: null },
        depthBuffer: { value: null },
        outlineColor: { value: new THREE.Color(0xffffff) },
        // 4 scalar values packed in one uniform: depth multiplier, depth bias, and same for normals.
        strokeMultiplier: { value: 2 },
        strokeBias: { value: 2 },
        cameraNear: { value: this._camera.near },
        cameraFar: { value: this._camera.far },
        screenSize: {
          value: new THREE.Vector4(
            this._resolution.x,
            this._resolution.y,
            1 / this._resolution.x,
            1 / this._resolution.y
          )
        }
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader
    })
  }
}
