# VIM WebGL Viewer

[![npm](https://img.shields.io/npm/v/vim-webgl-viewer)](https://npmjs.com/package/vim-webgl-viewer)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fvimaec.github.io%2Fvim-webgl-viewer)](https://vimaec.github.io/vim-webgl-viewer/)

# Documentation

https://vimaec.github.io/vim-webgl-viewer/api/

# Live Demo

## Web
- [Small Model Demo - Residence](https://vimaec.github.io/vim-webgl-viewer)
- [Medium Model Demo - Medical Tower](https://vimaec.github.io/vim-webgl-viewer?vim=https://vim02.azureedge.net/samples/skanska.vim)
- [Large Model Demo - Stadium](https://vimaec.github.io/vim-webgl-viewer?vim=https://vim02.azureedge.net/samples/stadium.vim) (_Warning_: slow download times)

## JsFiddle
- [JsFiddle - Hello World](https://jsfiddle.net/simon_vimaec/oym1L2ar/)
- [JsFiddle - General usage](https://jsfiddle.net/simon_vimaec/5hL06tvp/)
- [JsFiddle - Plan View](https://jsfiddle.net/simon_vimaec/hLp62f50/)
- [JsFiddle - Coloring](https://jsfiddle.net/simon_vimaec/pcLdzvne/)
- [JsFiddle - Visibility](https://jsfiddle.net/simon_vimaec/j5uhyp7k)
- [JsFiddle - Outlines](https://jsfiddle.net/simon_vimaec/nfLsab8k/)
- [JsFiddle - Isolation](https://jsfiddle.net/simon_vimaec/amp65cb8/)
- [JsFiddle - Measure](https://jsfiddle.net/simon_vimaec/anLh63tv/)
- [JsFiddle - Section Box](https://jsfiddle.net/simon_vimaec/ryeu9L40/)
- [JsFiddle - Embedding](https://jsfiddle.net/simon_vimaec/wd4zr6hq)
- [JsFiddle - Custom http request](https://jsfiddle.net/simon_vimaec/k5jn9sd8/)
- [JsFiddle - Custom Input](https://jsfiddle.net/simon_vimaec/ow82jmLv/)


# Overview

The VIM WebGL Viewer is an open-source high-performance 3D model viewer that specializes
in loading extremely large AEC (Architectural/Engineering/Construction)
models represented as VIM files.

It is built on top of the popular [Three.JS](https://threejs.org) WebGL framework to provide commonly used AEC related features.
It can be simply included via script tags or consumed using esm imports.

The VIM file format is a high-performance 3D scene format that supports rich BIM data, and can be easily extended to support
other relational or non-relation data sets.

Unlike IFC the VIM format is already tessellated, and ready to render. This results in very fast load times. Unlike glTF the VIM format is faster to load, scales better, and has a consistent structure for relational BIM data.

More information on the vim format can be found here: https://github.com/vimaec/vim

# Using the Viewer from a Web Page

The following is an example of the simplest usage of the VIM viewer:

```html
<html>
  <head>
    <title>VIM Viewer</title>
  </head>
      <style>
      /*Makes full screen and remove scrollbars*/
      html,
      body {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        /*This prevents touches from being eaten up by the browser.*/
        touch-action: none;
      }
    </style>
  <body>
    <script src="https://unpkg.com/three@0.143.0"></script>
    <script src="https://unpkg.com/vim-webgl-viewer@1.6.0"></script>
    <script>
	  async function load(){
		// Create a new viewer. 
		const viewer = new VIM.Viewer()

		// Open the vim file
		const vim = await VIM.open(
		  'https://vim02.azureedge.net/samples/residence.v1.2.75.vim',
		  {
		    rotation: new VIM.THREE.Vector3(270, 0, 0)
		  }
		)
		  
		// Load all geometry from vim file.
		await vim.loadAll()

		// Add loaded vim to the viewer.
		viewer.add(vim)

		// Immediately frame loaded vim.
		viewer.camera.do().frame(vim)
	  }
	  // Need function because you can't have top level async
	  load()
    </script>
  </body>
</html>

```

You can also [try it out in a JsFiddle](https://jsfiddle.net/simon_vimaec/oym1L2ar/)!

# Running Locally

- Checkout repo
- Run `npm install` to install all dependencies
- Run `npm run dev` to launch a dev-server and watch for change
- Navigate to the indicated localhost url in your browser

# Folder Structure

- `docs` - this is the root folder for the GitHub page at `https://vimaec.github.io/vim-webgl-viewer`. The `docs\index.html` file is meant to demo the latest stable patch release, while the `docs\index-dev.html` Is meant to test the latest dev release.
- `src` - contains the TypeScript source code for the viewer.
- `dist` - created by running the build script for creating a
  distributable package. It contains five items after running the `build` script:
  - `dist\vim-webgl-viewer.es.js` - an EcmaScript module
  - `dist\vim-webgl-viewer.es.js.map` - Typescript source map file map for the EcmaScript module
  - `dist\vim-webgl-viewer.iife.js` - an immediately-invocable function expression (IIFE) intended for consumption from a web-page
  - `dist\vim-webgl-viewer.iife.js.map` - Typescript source map file map for the IIFE
  - `types\` - A folder containing Typescript type declarations for the package.

## Scripts

The following scripts are defined in the package.json, and can each be executed from within VSCode by right-clicking the script name, or from the command line by writing `npm run <script-name>` where `<script-name>` is the name of the script:

- `dev` - launches a development environment using Vite
- `build` - compiles an IIFE JavaScript module and ES module using Vite and the configuration file, placing the output in the `dist` folder
- `serve-docs` - launches a web server with the `docs` folder as the root folder, for testing a published NPM package (tagged develop or latest) locally
- `eslint` - runs ESLint and reports all syntactic inconsistencies
- `documentation` - generates API documentation at `docs/api`
- `declarations` - generates TypeScript declarations at `dist/types`"

## Contributing:

- Source code is formatted using prettier-eslint using the standardjs format.
- On VSCode it is recommended to install ESLint and Prettier ESLint extensions.

## The Sources and Dependencies

The distributable files do not contain the underlying source for [Three.JS](https://threejs.org) to avoid duplication. Please include Three.JS on your own.

## Camera Controls

### Keyboard

**W/Up:** Move camera forward  
**A/Left:** Move camera to the left  
**S/Down:** Move camera backward  
**D/Right:** Move camera to the right  
**E:** Move camera up  
**Q:** Move camera down  
**Shift + direction:** faster camera movement  
**+:** Increase camera speed  
**-:** Decrease camera speed

**Space bar** Toggle orbit mode  
**Home:** Frame model  
**Escape:** Clear selection  
**F:** Frame selection

### Mouse

**Hold left click + Move mouse:** Rotate camera in current mode  
**Hold right click + Move mouse:** Pan/Tilt camera
**Hold middle click + Move mouse:** Truck/Pedastal camera
**Mouse wheel:** Dolly Camera  
**Left click:** Select object  
**Ctrl + Mouse wheel:** Increase/Decrease camera speed

### Touch

**One Finger swipe:** Tilt/Pan camera  
**Two Finger swipe:** Truck/Pedestal camera  
**Two Finger pinch/spread:** Dolly Camera

(https://blog.storyblocks.com/video-tutorials/7-basic-camera-movements/)

