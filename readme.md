# VIM WebGL Viewer

[![npm](https://img.shields.io/npm/v/vim-webgl-viewer)](https://npmjs.com/package/vim-webgl-viewer)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fvimaec.github.io%2Fvim-webgl-viewer)](https://vimaec.github.io/vim-webgl-viewer/)

# Live Demo

- [Small Model Demo - Residence](https://vimaec.github.io/vim-webgl-viewer)
- [Medium Model Demo - Medical Tower](https://vimaec.github.io/vim-webgl-viewer?model=https://vim.azureedge.net/samples/skanska.vim)
- [Large Model Demo - Stadium](https://vimaec.github.io/vim-webgl-viewer?model=https://vim.azureedge.net/samples/stadium.vim) (_Warning_: slow download times)

# Overview

The VIM WebGL Viewer is an open-source high-performance 3D model viewer built on top of the popular
[Three.JS](https://threejs.org) WebGL framework that specializes
in loading extremely large AEC (Architectural/Engineering/Construction)
models represented as VIM files.

The VIM WebGL viewer combines the Three.JS library with several common loaders and utilities, to reduce boilerplate code. It can be simply included via script tags or consumed using esm imports.

The VIM file format is a high-performance 3D scene format that supports rich BIM data, and can be easily extended to support
other relational or non-relation data sets.

Unlike IFC the VIM format is already tessellated, and ready to render. This results in very fast load times. Unlike glTF the VIM format is faster to load, scales better, and has a consistent structure for relational BIM data.

# Using the Viewer from a Web Page

Virtually the simplest usage of the VIM viewer is the following example:

```html
<html>
  <head>
    <title>VIM Viewer</title>
  </head>
  <body>
    <script src="https://unpkg.com/three@0.133.1/build/three.min.js"></script>
    <script src="https://unpkg.com/vim-webgl-viewer"></script>
    <script>
      var viewer = new vim.Viewer({
        url: 'https://vim.azureedge.net/samples/residence.vim',
        object: { rotation: { x: 270 } }
      })
    </script>
  </body>
</html>
```

# Running Locally

- Checkout repo
- Run `npm install` to install all dependencies
- Run `npm run dev` to launch a dev-server and watch for change
- Navigate to http://localhost:3000 in your browser

# Folder Structure

- `docs` - this is the root folder for the GitHub page at `https://vimaec.github.io/vim-webgl-viewer`. The `docs\index.html` file uses
  the latest published default NPM release package (`@latest`), while the `docs\index-dev.html` uses the latest published dev NPM package (`@dev`). Also contains a mustache template and file for generating the various index.html files from
- `src` - contains the TypeScript source code for the viewer and loader.
- `dist` - created by running the build script for creating a
  distributable package. It contains three files after running the `build` script:
  - `dist\vim-webgl-viewer.es.js` - an EcmaScript module
  - `dist\vim-webgl-viewer.iife.js` - an immediately-invocable function expression (IIFE) intended for consumption from a web-page
  - `index.html` - an index.html test file that can be used to test the IIFE output locally, before packaging on NPM.

# For Contributors

## Making a Pre-Release

1. First develop and test the feature using `npm run dev`
2. When satisfied using `npm run build` to build the distribution files.
3. Use `npm run serve-dist` to test the built distribution files locally. Or `npm run test-dist` to combine steps 2 and 3.
4. When satisfied merge into and checkout the `main` branch (the default branch).
5. Assure that `git status` is clean
6. Login to npm if needed using `npm login`
7. Use `npm run release-dev` to create a pre-release NPM package, and test it on the GitHub pages.

After making a pre-release package test it by running `npm run test-dev`. This will open `https://vimaec.github.io/vim-webgl-viewer/index-dev.html`.

## Making a Patch Release

Login to npm if needed using `npm login`

After creating and validating the pre-release, and assuring `main` is checked out, and the git status is clean, run `npm run release-patch`.

After making a release package test it by running `npm run test-latest`. This will open `https://vimaec.github.io/vim-webgl-viewer/index.html`

## Scripts

The following scripts are defined in the package.json, and can each be
executed from within VSCode by right-clicking the script name, or from the
command line by writing `npm run <script-name>` where `<script-name>` is the name of the script.

- `dev` - launch a dev environment using Vite
- `build` - compiles an IIFE JavaScript module and ES module using Vite and the configuration file, placing the output in the `dist` folder.
- `bump-dev` - increments the pre-release version of the NPM package, with the id `dev`. This will update the `package.json` version number with a pre-release tag and number value (e.g. 1.0.0-dev.42). It will also create corresponding tag and commit it to Git.
- `publish-dev` - publishes the current package to NPM with a `dev` tag, as opposed to the default tag `latest`.
- `serve-docs` - launches a web-server with the docs folder as the root folder, for testing a published NPM packages (tagged develop or latest) locally
- `serve-dist`: - launches a web-server with the dist folder as the root folder, for testing the built artifacts locally before publishing
- `gen-docs` - Uses mustache to create index.html files
- `test-latest` - Opens the GitHub page with a test file and using the latest release on NPM.
- `test-dist` - Locally serves the `dist` folder for testing before releasing a package.
- `release-patch` - Increments the patch number and publishes an NPM package using the default tag (`@latest`). Intended to be called from the `main` branch only after the pre-release package has been created and tested.
- `release-dev` - Increments the prerelease number and publishes an NPM prerelease package using the `@dev` tag. Intended to be called from the `main` branch after the features has been tested and built locally.

## Contributing:

- Source code is formatted using prettier-eslint using the standardjs format.
- On VSCode it is recommended to install ESLint and Prettier ESLint extensions.

## The Sources and Dependencies

The distributable file `vim-webgl-viewer.iife.js` does not contain the underlying source for [Three.JS](https://threejs.org) to avoid duplication. Please include Three.JS on your own.

## Meshes, Nodes and Elements

The viewer is broadly divided into three layer.

**Meshes:** The scene is rendered using a collection of InstancedMesh, specific object are refered by a (Mesh, instanceIndex) pair.

**Nodes:** The vim scene is a collection of nodes with a transform and a geometry, each node will result in zero or one object added to Three to be rendered. Nodes are refered by Index.

**Elements:** objects from the original the bim software containing rich data. Each element can have from 0 to N nodes associated with it. Elements are refered to by Id or Index.

**Example:**  
A table has elementId 12321  
it gets exported into 5 nodes, 4 legs and a table top.  
the 5 nodes are rendered using 2 meshes, one for the table top, one for all 4 legs.

## How To

**Frame the camera on an element**
`
// if you already have element index from the vim you can skip this line
const elementIndex = viewer.getElementIndexFromId(MY_ELEMENT_ID)

viewer.lookAtElementIndex(elementIndex)

// Optional highlight for your element
// call disposer() to remove highligh
const disposer = viewer.highlightElementByIndex(755)
` 
