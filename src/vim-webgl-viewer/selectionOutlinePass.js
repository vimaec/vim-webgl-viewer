import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

// Follows the structure of
// https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutlinePass.js
// Based on https://github.com/OmarShehata/webgl-outlines/blob/cf81030d6f2bc20e6113fbf6cfd29170064dce48/threejs/src/CustomOutlinePass.js
export class CustomOutlinePass extends Pass {
  constructor (resolution, scene, camera) {
    super()

    this.renderScene = scene
    this.renderCamera = camera
    this.resolution = new THREE.Vector2(resolution.x, resolution.y)

    this.fsQuad = new FullScreenQuad(null)
    this.fsQuad.material = this.createOutlinePostProcessMaterial()
  }

  dispose () {
    this.fsQuad.dispose()
  }

  setSize (width, height) {
    this.resolution.set(width, height)

    this.fsQuad.material.uniforms.screenSize.value.set(
      this.resolution.x,
      this.resolution.y,
      1 / this.resolution.x,
      1 / this.resolution.y
    )
  }

  render (renderer, writeBuffer, readBuffer) {
    // Turn off writing to the depth buffer
    // because we need to read from it in the subsequent passes.
    const depthBufferValue = writeBuffer.depthBuffer
    writeBuffer.depthBuffer = false

    this.fsQuad.material.uniforms.depthBuffer.value = readBuffer.depthTexture
    // this.fsQuad.material.uniforms.sceneColorBuffer.value = readBuffer.texture

    // 2. Draw the outlines using the depth texture and normal texture
    // and combine it with the scene color
    if (this.renderToScreen) {
      // If this is the last effect, then renderToScreen is true.
      // So we should render to the screen by setting target null
      // Otherwise, just render into the writeBuffer that the next effect will use as its read buffer.
      renderer.setRenderTarget(null)
      this.fsQuad.render(renderer)
    } else {
      renderer.setRenderTarget(writeBuffer)
      this.fsQuad.render(renderer)
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
    uniform vec4 multiplierParameters;
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

      // Apply multiplier & bias to each 
      float depthBias = multiplierParameters.x;
      float depthMultiplier = multiplierParameters.y;

      depthDiff = depthDiff * depthMultiplier;
      depthDiff = saturate(depthDiff);
      depthDiff = pow(depthDiff, depthBias);

      float outline = depthDiff;

      // Combine outline with scene color.
      vec4 outlineColor = vec4(outlineColor, 1.0f);
      gl_FragColor = vec4(mix(sceneColor, outlineColor, outline));

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
        sceneColorBuffer: {},
        depthBuffer: {},
        outlineColor: { value: new THREE.Color(0xffffff) },
        // 4 scalar values packed in one uniform: depth multiplier, depth bias, and same for normals.
        multiplierParameters: { value: new THREE.Vector4(1, 1, 1, 1) },
        cameraNear: { value: this.renderCamera.near },
        cameraFar: { value: this.renderCamera.far },
        screenSize: {
          value: new THREE.Vector4(
            this.resolution.x,
            this.resolution.y,
            1 / this.resolution.x,
            1 / this.resolution.y
          )
        }
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader
    })
  }
}
