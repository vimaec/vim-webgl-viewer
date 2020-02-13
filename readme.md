# VIM Three.JS 3D Viewer 

The VIM Three.JS 3D Viewer is an open-source and easy to configure and use 3D model viewer built as a thin wrapper on top of the popular 
[Three.JS](https://threejs.org) WebGL framework. 

The VIM Three.JS 3D viewer combines the Three.JS library with several common loaders and utilities, to reduce boilerplate code, into a single file 
(`ara3d-viewer.js`) making it easy to integrate a custom 3D viewer into your website with just a couple of lines of code.

The other purpose of the VIM Three.JS viewer was to demonstrate and validate the performance of a loader for the G3D file format.

G3D is a high-perofrmance and simple generic binary file format for geoemetric mesh data. See 

## Running Locally:

NOTE: currently the type-script build chain has a small bug. We are using just  

* Run in a command-lin termain `npm run watch`
* `npm run serve`
* http://127.0.0.1:8080/examples/example.html

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

* .g3d
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

## Testing Process 

Testing is done using Mocha and can be executed by `npm test`:
https://threejs.org/docs/#manual/en/buildTools/Testing-with-NPM

## The Sources and Dependencies

The distributable file `ara-viewer.js` is a concatenation of: 

* [Three.JS](https://threejs.org)
    * The main Three.JS distributable
    * WebGL statistics utility
    * WebGL detector utility
    * Several file loaders for Three.JS from the `examples/loaders` folder
    * Three.JS Orbit controls from the `examples/controls` folder    
* [Dat.GUI](https://github.com/dataarts/dat.gui) 
* The `ara-viewer-main.js` source file which encapsulates common Three JS boiler plate 

## Options

The Ara viewer can be fully customized by passing a JSON object, describing the 3D scene.

```
    {
    dom: document.getElement().body,
    models: [
        { 
            url: 'myfiles.stl',
            transform: {
            },
        },        
        {
            primitive: plane, 
            width: 40,
            height: 40,
            material: {
                color: 0x999999, 
                specular: 0x101010,
            },
            transform: {
                rotation: {
                    x: -Math.PI/2,
                },
                position: {
                    y: -0.5
                }
            },
        },
    ],
    lights: [
        {             
            type: hemisphere,
            skyColor: 0x443333, 
            groundColor: 0x111122,
            intensity: 1,
        },
        {
            type: shadowedLight,
            position: { x: },
            color: 
            intensity: 
        }
        
    ]
    camera: {
        target: { y: -0.1 },
        position: { x: 3, y: 0.15, z: 3 },
        fov: 35,
        near: 1,
        far: 15, 
    },
    background: {
        color: 0x72645b,
    },
    fog: {
        color: 0x72645b
        near: 2,
        far: 15, 
    },
    stats: true,
    controls: true, 
}
```