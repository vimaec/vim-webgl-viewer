# VIM Three.JS 3D Viewer 

The VIM Three.JS 3D Viewer is an open-source and easy to configure and use 3D model viewer built as a thin wrapper on top of the popular 
[Three.JS](https://threejs.org) WebGL framework. It is enhanced with a loader for the VIM format which is specialized in 
the transfer of large AEC data. 

The VIM Three.JS 3D viewer combines the Three.JS library with several common loaders and utilities, to reduce boilerplate code. It can be simply included via script tags or consumed using esm imports.


## Running Locally:

* Checkout repo
* Run `npm install` to install all dependencies
* Run `npm run dev` to launch a dev-server and watching for changes
* Run `npm run build` to compile and bundle everything for publishing. Resulting files end up in ./dist

* Navigate to http://localhost:3000 in your browser

## Contributing:
* Source code is formatted using prettier-eslint using the standardjs format.
* On VSCode it is recommended to install ESLint and Prettier ESLint extensions.

## Features 

* Orbit controls - movement with the mouse
* Default scene set-up:
    * Ground plane 
    * Two shadowed lights 
    * Slow model rotation 
* Automatic phong material 
* UI controls for changing various settings 
* Frame rate and memory statistics 

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
    <script src="./dist/vim-webgl-viewer.iife.js"></script>
    <script>
        var viewer = new vim.Viewer();
        viewer.view({
            url: './residence.vim',
            object: {
                scale: 0.1,
                rotation: { x: 270 },
                position: { y: 0 }
            },
            plane: {
                show: false
            },
            showStats: true
        });
    </script> 
</body>
</html>

```

If you want to use esm imports, you do it as follows:

```js
// This will work if you use a bundler and installed the viewer via npm
import { Viewer } from 'vim-webgl-viewer'

// That will work if you use the bundled file directly
// However, you still need to have threejs installed via npm and use a bundler
import { Viewer } from './dist/vim-webgl-viewer.es.js'

const viewer = new Viewer();
viewer.view({
    url: './residence.vim',
    object: {
        scale: 0.1,
        rotation: { x: 270 },
        position: { y: 0 }
    },
    plane: {
        show: false
    },
    showStats: true
});
```

## API

TBD


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



