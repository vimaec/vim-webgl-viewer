# VIM WebGL Viewer 

[![npm](https://img.shields.io/npm/v/vim-webgl-viewer)](https://npmjs.com/package/vim-webgl-viewer)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fvimaec.github.io%2Fvim-webgl-viewer)](https://vimaec.github.io/vim-webgl-viewer/)


The VIM WebGL Viewer is an open-source high-performance 3D model viewer built on top of the popular 
[Three.JS](https://threejs.org) WebGL framework that specializes
in loading extremely large AEC (Architectural/Engineering/Construction)
models represented as VIM files.

The VIM WebGL viewer combines the Three.JS library with several common loaders and utilities, to reduce boilerplate code. It can be simply included via script tags or consumed using esm imports.

The VIM file format is a high-performance 3D scene format that supports rich BIM data, and can be easily extended to support 
other relational or non-relation data sets. 

Unlike IFC the VIM format is already tessellated, and ready to render.


## Running Locally

* Checkout repo
* Run `npm install` to install all dependencies
* Run `npm run dev` to launch a dev-server and watch for change 
* Navigate to http://localhost:3000 in your browser

## For Developers

* Run `npm run build` to compile and bundle everything for publishing. Resulting files end up in ./dist
* 

## Contributing:

* Source code is formatted using prettier-eslint using the standardjs format.
* On VSCode it is recommended to install ESLint and Prettier ESLint extensions.

## Supported File Formats 

* .vim
* .obj
* .ply
* .stl 
* .g3d
* .dae 
* .3ds
* .pdb
* .pcb
* .gcode
* .gltf 
* .fbx

## Using the Model Viewer 

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
            object: {
                rotation: { x: 270 },
            },
        });
    </script> 
</body>
</html>


## The Sources and Dependencies

The distributable file `vim-webgl-viewer.iife.js` does not contain the underlying source for [Three.JS](https://threejs.org) to avoid duplication. Please include Three.JS on your own. However, it comes bundled with:

* [Dat.GUI](https://github.com/dataarts/dat.gui)
* The `vim-webgl-viewer.js` source file which encapsulates common Three JS boiler plate

## Meshes, Nodes and Elements  
The viewer is broadly divided into three layer.  

**Meshes:** The scene is rendered using a collection of InstancedMesh, specific object are refered by a (Mesh, instanceIndex) pair.  
**Nodes:** The vim scene is a collection of nodes with a transform and a geometry, each node will result in zero or one object added to Three to be rendered. Nodes are refered by Index.  
**Elements:** objects from the original the bim software containing rich data. Each element can have from 0 to N nodes associated with it. Elements are refered to by Id or Index.  

**Exemple:**  
A table from Revit has elementId 12321  
it gets exported into 5 nodes, 4 legs and a table top.  
the 5 nodes are rendered using 2 meshes, one for the table top, one for all 4 legs.  



