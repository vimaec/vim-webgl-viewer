# VIM Three.JS 3D Viewer 

The VIM Three.JS 3D Viewer is an open-source and easy to configure and use 3D model viewer built as a thin wrapper on top of the popular 
[Three.JS](https://threejs.org) WebGL framework. It is enhanced with a loader for the VIM format which is specialized in 
the transfer of large AEC data. 

The VIM Three.JS 3D viewer combines the Three.JS library with several common loaders and utilities, to reduce boilerplate code, into a single file 
(`vim-webgl-viewer.js`) making it easy to integrate a custom 3D viewer into your website with just a couple of lines of code.

## Running Locally:

* Checkout repo
* Run `npm install` to install all dependencies
* Run `npm run serve` to launch a web-server
* Run `npm run build` to compile and bundle typescript scripts
* (Optional) Run `npm run watch` to compile and bundle every time you make changes to a script

* Navigate to [http://127.0.0.1:8080/index.html in your browser

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

```
<html>
<head>
    <title>VIM Viewer</title>
</head>
    <body>
        <script src="./vim-webgl-viewer.js"></script>
        <script> 
            var viewer = new vim.Viewer();
            viewer.view({
                url: './residence.vim',
                object: {
                    scale: 0.1,
                    rotation: { x: 270 },
                    position: { y: 0 }
                },
                plane:
                    { show: false },
                showStats: true
            });
        </script> 
    </body>
</html>

```

## API

TBD


## The Sources and Dependencies

The distributable file `vim-webgl-viewer.js` is a webpack bundle of: 

* [Three.JS](https://threejs.org)
    * The main Three.JS distributable
    * WebGL statistics utility
    * Several file loaders for Three.JS from the `examples/loaders` folder
    * Three.JS Orbit controls from the `examples/controls` folder    
    * The custom `VIMLoader.js` file
* [Dat.GUI](https://github.com/dataarts/dat.gui) 
* The `vim-webgl-viewer.js` source file which encapsulates common Three JS boiler plate 

