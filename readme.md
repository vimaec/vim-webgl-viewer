# VIM Three.JS 3D Viewer 

The VIM Three.JS 3D Viewer is an open-source and easy to configure and use 3D model viewer built as a thin wrapper on top of the popular 
[Three.JS](https://threejs.org) WebGL framework. It is enhanced with a loader for the VIM format which is specialized in 
the transfer of large AEC data. 

The VIM Three.JS 3D viewer combines the Three.JS library with several common loaders and utilities, to reduce boilerplate code, into a single file 
(`ara3d-viewer.js`) making it easy to integrate a custom 3D viewer into your website with just a couple of lines of code.

## Running Locally:

* Checkout repo
* Run `npm install` to install all dependencies
* Run `npm run watch` to set up a file change watcher 
* Run `npm run tswatch` to set up a typescript compiler and watcher 
* Run `npm run serve` to launch a web-server
* Navigate to [http://127.0.0.1:8080/examples/example.html](http://127.0.0.1:8080/examples/example.html) in your browser

## Features 

* Orbit controls - movement with the mouse
* Default scene set-up:
    * Ground plane 
    * Two shadowed lights 
    * Slow model rotation 
* Drag and drop of models 
* Automatic phong material 
* UI controls for changing various settings 
* Frame rate and memory statistics 
* WebGL detector 

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

Virtually the simplest usage of the Ara viewer is the following example: 

```
    <html>
    <head>
        <title>Simple Ara Viewer Example</title>
    </head>
    <script src="araviewer.js"></script>
    <script>
        ara.view({ url: 'testmodel.ply' });
    </script>
    <body>
    </body>
    </html>
```

## API

* .run
* .setOptions
* .defaultOptions
* .addModel
* .removeModel
* .scene
* .pause

## Build Process

Call `npm run build`. This will call a gulp script (`gulpfile.js`) that minifies and concatenates the sources. 

The main viewer code is writtein in TypeScript, and has to be built separately before running gulp.

## The Sources and Dependencies

The distributable file `ara-viewer.js` is a concatenation of: 

* [Three.JS](https://threejs.org)
    * The main Three.JS distributable
    * WebGL statistics utility
    * WebGL detector utility
    * Several file loaders for Three.JS from the `examples/loaders` folder
    * Three.JS Orbit controls from the `examples/controls` folder    
    * The custom `VIMLoader.js` file
* [Dat.GUI](https://github.com/dataarts/dat.gui) 
* The `ara-viewer-main.js` source file which encapsulates common Three JS boiler plate 

