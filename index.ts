/*

Ara 3D Web Viewer 
Copyright Ara 3D, 2018
Licensed under the terms of the MIT License

A simple and easy to use 3D Model Web-Viewer built with Three.JS that eliminates a lot of boilerplate. 
This is based on a combination of examples from the Three.JS web-site. 

Example usage: 

<html>
<head>
<title>Simple Ara Viewer Example</title>
</head>
<script src="../dist/ara-viewer.js"></script>
<body>
</body>
<script>
    ara.view({ url: './dragon.ply' });
</script>
</html>
*/

/*
import * as dat from './node_modules/dat.gui/build/dat.gui.js';
import * as three from './node_modules/three/build/three.js';
import * as stats from  './node_modules/three/examples/js/libs/stats.min.js';
import * as Detector from './node_modules/three/examples/js/Detector.js';
import * as orbit from './node_modules/three/examples/js/controls/OrbitControls.js';
import * as FBXLoader from './node_modules/three/examples/js/loaders/FBXLoader.js';
import * as ColladaLoader from './node_modules/three/examples/js/loaders/ColladaLoader.js';
import * as GCodeLoader from './node_modules/three/examples/js/loaders/GCodeLoader.js';
import * as GLTFLoader from './node_modules/three/examples/js/loaders/GLTFLoader.js';
import * as OBJLoader from './node_modules/three/examples/js/loaders/OBJLoader.js';
import * as PCDLoader from './node_modules/three/examples/js/loaders/PCDLoader.js';
import * as PDBLoader from './node_modules/three/examples/js/loaders/PDBLoader.js';
import * as PLYLoader from './node_modules/three/examples/js/loaders/PLYLoader.js';
import * as STLLoader from './node_modules/three/examples/js/loaders/STLLoader.js';
import * as TDSLoader from './node_modules/three/examples/js/loaders/TDSLoader.js';
*/

declare const THREE: any;
declare const Stats: any;
declare const Detector: any;
declare const dat: any;

/**
 * js-prop-list.ts
 *  
 * A small library for serializing and describing nested property lists.
 *  
 * Copyright (c) 2018 Ara 3D
 * Subject to MIT License
 */

/** 
 * An object that maps names to property descriptors or other maps. Allows property descriptors to be easily
 * written as hierarchical data structures that map the folder structurue we want in the GUI.
 */ 
interface IPropDescMap {
    [name:string]: PropDesc|IPropDescMap;
}
 
// Used to provide new IDs for each new property descriptor that is created.
let gid = 0;

/**
 * Describes a property so that it can be found 
 */
class PropDesc
{        
    id = gid++;
    name = "";
    vis = true;
    min?: number;
    max?: number;
    step?: number;
    choices: string[];
    options: any;

    constructor(
        public type: string, 
        public def: any) 
    {
    }

    setStep(step: number): PropDesc {
        this.step = step;
        return this;
    }

    setRange(min: number, max?: number): PropDesc {
        this.min = min;
        this.max = max;
        return this;
    }

    setName(name: string): PropDesc {
        this.name = name;
        return this;
    }

    setChoices(xs: string[]): PropDesc {
        this.choices = xs;
        return this;
    }

    setOptions(xs: any): PropDesc {
        this.options = xs;
        return this;
    }
}

/**
 * Holds a value, and a reference to the descriptor.  
 */
class PropValue {
    _value: any;
    constructor(public _desc: PropDesc) { this._value = _desc.def; }
    get name(): string { return this._desc.name };
    get value(): any { return this._value; }
    set value(value: any) { this._value = value; }
}     

/**
 * Represent name value pairs 
 */
interface PropListJson {
    [name: string]: any;
}

/**
 * A list of properties. The values can be get and set directly on this object.
 */
class PropList {
    readonly items: PropValue[] = [];
    constructor(public readonly propDesc: IPropDescMap) {
        this.createPropVals('', propDesc);
        for (const pv of this.items) {
            Object.defineProperty(this, pv.name, {
                get: () => pv.value,
                set: (v: any) => pv.value = v,
            });
        }
    }
    fromJson(json: PropListJson) {
        for (const k in json) 
            this[k] = json[k];
        return this;
    }
    get toJson(): PropListJson {
        const r = {};
        for (const pv of this.items) 
            r[pv.name] = pv.value;
        return r;
    }
    createPropVals(name: string, propDesc: IPropDescMap|PropDesc) {
        if (propDesc instanceof PropDesc) {
            propDesc = propDesc.setName(name);
            if (propDesc.type === 'conditional') {
                const options = propDesc.options;
                this.items.push(new PropValue(propDesc));
                for (const k in options) {
                    const map = options[k];
                    for (const k2 in map) {
                        this.createPropVals(k + "." + k2, map[k2]);
                    }
                }
            }
            else {
                this.items.push(new PropValue(propDesc));
            }
        }
        else {
            for (const k in propDesc) {
                this.createPropVals(k, propDesc[k])                
            }
        }
    }      
    find(name: string): PropValue|undefined {
        return this.items.find(v => v._desc.name === name);
    }
    desc(name: string) {
        return this.find(name)._desc;
    }
    get descs() { 
        return this.items.map(v => v._desc);
    }
    get values() {
        return this.items.map(v => v._value);
    }
    get keys() {
        return this.items.map(v => v.name);
    }
}

/** Used for callbacks when a property value is changed. */
type PropValueChanged = (pv: PropValue) => void;

/** 
 * Fills out a dat.gui instance according to the properties and the property descriptor map.
 */
function bind(list: PropList, name: string, desc: PropDesc|IPropDescMap, gui: any, onChange: PropValueChanged) {
    if (desc instanceof PropDesc) {
        const pv = list.find(name);
        if (!pv)
            throw new Error("Could not find parameter " + name);
        if (desc.type === 'conditional') {
            let vals = desc.options;
            let keys = Object.keys(vals);
            const controller = gui.add(pv, 'value', keys).name(pv.name).setValue(pv.value);
            let folder = null;
            const buildParameters = () => {
                let local_gui = gui;
                if (folder)
                    local_gui.removeFolder(folder);
                folder = local_gui.addFolder(name + " parameters");
                const baseName = pv.value;
                const sub = vals[baseName];
                // We bind the sub-properties ("MyOption.") 
                for (const k in sub) {
                    bind(list, baseName + "." + k, sub[k], folder, onChange);
                }
                controller.onChange(() => { buildParameters(); onChange(pv); });
                folder.open();
                return folder;
            }
            return buildParameters();
        }
        else if (desc.choices) {
            return gui.add(pv, "value", desc.choices).name(pv.name).setValue(pv.value).onChange(() => onChange(pv));
        }
        else if (desc.type === 'vec3') {
            const folder = gui.addFolder(desc.name);                
            folder.open();
            folder.add(pv._value, "x").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv._value, "y").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv._value, "z").step(0.1).onChange(() => onChange(pv));                
            return folder;
        }
        else if (desc.type === 'hsv') {
            const folder = gui.addFolder(desc.name);                
            folder.open();
            folder.add(pv._value, "x").name("hue").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv._value, "y").name("saturation").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv._value, "z").name("value").step(0.1).onChange(() => onChange(pv));                
            return folder;
        }
        else if (desc.type === 'rot') {
            const folder = gui.addFolder(desc.name);                
            folder.open();
            folder.add(pv._value, "yaw", -1, 1, 0.01).onChange(() => onChange(pv));                
            folder.add(pv._value, "pitch", -1, 1, 0.01).onChange(() => onChange(pv));                
            folder.add(pv._value, "roll", -1, 1, 0.01).onChange(() => onChange(pv));                
            return folder;
        }
        else if (desc.type === 'color') {
            const controller = gui.addColor(pv, "value").name(pv.name);
            controller.onChange(() => onChange(pv));
            return controller;
        }
        else {
            const controller = gui.add(pv, "value", desc.min, desc.max, desc.step).name(pv.name);                
            controller.onChange(() => onChange(pv));
            return controller;
        }
    }
    else {
        // I assume it is a property descriptor map. 
        // We want the properties to be added hierarchically to gui.dat.
        const folder = gui.addFolder(name);
        folder.open();
        for (const k in desc) 
            bind(list, k, desc[k], folder, onChange);
        return folder;
    }
}               

// Helper functions for defining properties 
function prop(type: string, def: any): PropDesc { return new PropDesc(type, def); }
function boolProp(x: boolean) { return prop("boolean", x); }
function stringProp(x: string) { return prop("string", x); }
function floatProp(x: number = 0) { return prop("float", x) }
function smallFloatProp(x: number = 0) { return prop("float", x).setStep(0.01); }
function colorCompProp(x: number = 0) { return rangedIntProp(x, 0, 255); }
function intProp(x: number) { return prop("int", x); }
function rangedIntProp(x: number, min: number, max: number) { return intProp(x).setRange(min, max); }
function rangedFloatProp(x: number, min: number, max: number) { return floatProp(x).setRange(min, max); }
function zeroToOneProp(x: number) { return floatProp(x).setRange(0, 1).setStep(0.01); }
function oneOrMoreIntProp(x: number) { return intProp(x).setRange(1); }
function timeProp(x: number) { return prop("time", x) }
function choiceProp(xs: string[]) { return prop("choices", xs[0]).setChoices(xs); }
function vec3Prop(x = 0, y = 0, z = 0) { return prop('vec3', { x, y, z }); }
function scaleProp() { return prop('vec3', { x: 1, y: 1, z: 1 }); }
function rotProp(yaw = 0, pitch = 0, roll = 0) { return prop('rot', { yaw, pitch, roll }); }
function axisProp() { return choiceProp(['x','y','z']).setName("axis"); }
function conditionalProp(val: string, options: any) { return prop('conditional', val).setOptions(options); }
function colorProp(r = 0, g = 0, b = 0) { return prop('color', [r, g, b]); }

// BEGIN: Deep merge copy and paste (With mods)
// The MIT License (MIT)
// Copyright (c) 2012 Nicholas Fisher
// https://github.com/KyleAMathews/deepmerge/blob/master/license.txt
class DeepMerge 
{
    isMergeableObject(val) {
        return val && typeof val === 'object';
    }

    emptyTarget(val) {
        return Array.isArray(val) ? [] : {};
    }

    cloneIfNecessary(value, optionsArgument) {
        let clone = optionsArgument && optionsArgument.clone === true;
        return (clone && this.isMergeableObject(value)) ? this.deepMerge(this.emptyTarget(value), value, optionsArgument) : value;
    }

    defaultArrayMerge(target, source, optionsArgument) {
        let destination = target.slice();
        for (let i=0; i < destination.length; ++i) {
            const e = destination[i];
            if (typeof destination[i] === 'undefined') 
                destination[i] = this.cloneIfNecessary(e, optionsArgument);
            else if (this.isMergeableObject(e)) 
                destination[i] = this.deepMerge(target[i], e, optionsArgument);
            else if (target.indexOf(e) === -1) 
                destination.push(this.cloneIfNecessary(e, optionsArgument));            
        }
        return destination;
    }

    mergeObject(target, source, optionsArgument) {
        var destination = {};
        if (this.isMergeableObject(target)) 
            for (const key in target) 
                destination[key] = this.cloneIfNecessary(target[key], optionsArgument);
        for (const key in source)
            if (!this.isMergeableObject(source[key]) || !target[key]) 
                destination[key] = this.cloneIfNecessary(source[key], optionsArgument);
            else
                destination[key] = this.deepMerge(target[key], source[key], optionsArgument);
        return destination;
    }

    deepMerge(target, source, optionsArgument) {
        var array = Array.isArray(source);
        var options = optionsArgument || { arrayMerge: this.defaultArrayMerge }
        var arrayMerge = options.arrayMerge || this.defaultArrayMerge
        if (array) 
            return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : this.cloneIfNecessary(source, optionsArgument);
        else 
            return this.mergeObject(target, source, optionsArgument);        
    }
}
// END: Deepmerge

const ara = 
{
    view: function(options) 
    {
        // Check WebGL presence
        if ( ! Detector.webgl ) {
            Detector.addGetWebGLMessage();
            return;
        }

        // Variables 
        let container, stats, gui;
        let camera, cameraTarget, scene, renderer, material, plane, sunlight, light1, light2, settings;
        let objects = [];

        // Default options object (merged with passed options)
        const defaultOptions = {
            width: window.innerWidth,
            height: window.innerHeight, 
            near: 1,
            far: 15,
            camera: {
                fov: 35,
                position: {
                    x: 3,
                    y: 0.15,
                    z: 3
                },
                target: {
                    x: 0,
                    y: -0.1,
                    z: 0,
                }
            },
            background: {
                color: 0x72645b,
            },
            fog: {
                color: 0x72645b,
                near: 0.01,
                far: 1500,
            },
            plane: {
                size: 400,
                material: {
                    color: 0x999999, 
                    specular: 0x101010 
                },
                position: {
                    x:0, y:-0.5, z:0
                }
            },
            sunlight: { 
                skyColor: 0x443333, 
                groundColor: 0x111122,
                intensity: 1,
            },
            light1: {
                position: { x: 1, y: 1, z: 1 }, 
                color: 0xffffff, 
                intensity: 1.35,
            },
            light2: {
                position: { x: 1, y: 1, z: 1 }, 
                color: 0xffffff, 
                intensity: 1.35,
            },
            material: {
                color: 0x0055ff,
                flatShading: true,
                emissive: 0,
                emissiveIntensity: 0,
                wireframe: false,
                wireframeLinewidth: 0.1,
            },
            object: {
                scale: 0.01,
                position: { x: 0, y: 0, z: -5 },
            }            
        }

        // Initialization of scene, loading of objects, and launch animation loop
        init();       
        loadIntoScene(settings.url);        
        animate();

        // Called every frame in case settings are updated 
        function updateScene() {
            camera.fov = settings.camera.fov;
            camera.aspect = settings.camera.aspectRatio;
            camera.near = settings.camera.near;
            camera.far = settings.camera.far;
            camera.position = toVec(settings.camera.position);
            cameraTarget = toVec(settings.camera.target);
            scene.background = new THREE.Color( settings.background.color );
            scene.fog = new THREE.Fog( settings.fog.color, settings.fog.near, settings.fog.far );
            plane.material.setValues(settings.plane.material);
            plane.geometry.set
            light1.position = toVec(settings.light1.position);
            light1.color = settings.light1.color;
            light1.intensity = settings.light1.intensity;
            light2.position = toVec(settings.light2.position);
            light2.color = settings.light2.color;
            light2.intensity = settings.light2.intensity;
            sunlight.skyColor = settings.sunlight.skyColor;
            sunlight.groundColor = settings.sunlight.groundColor;
            sunlight.intensity = settings.sunlight.intensity;
            plane.position.y = toVec(settings.plane.position);
        } 

        function objectToPropDesc(obj, pdm: IPropDescMap): IPropDescMap {
            // TODO: look for common patterns (colors, positions, angles) and process these specially.
            for (const k in obj) {
                const v = obj[k];
                switch (typeof(v))
                {
                    case 'number':
                        pdm[k] = floatProp(v).setName(k);
                        break;
                    case 'string':
                        pdm[k] = stringProp(v).setName(k);
                        break;
                    case 'boolean':
                        pdm[k] = boolProp(v).setName(k);
                        break;
                    case 'object':                        
                        pdm[k] = objectToPropDesc(v, {});
                        break;
                }
            }
            return pdm;
        }

        function getOptionsDescriptor(): IPropDescMap {
            return objectToPropDesc(defaultOptions, {});
        }

        // Scene initialization
        function init() {
            // Initialize the settings 
            settings = (new DeepMerge()).deepMerge(defaultOptions, options, undefined);
            if (settings.camera.aspectRatio === undefined) 
                settings.camera.aspectRatio = settings.width / settings.height;

            // DOM Element Container 
            container = document.createElement( 'div' );
            container.ondrop=dropHandler;
            container.ondragover=dragOverHandler;
            document.body.appendChild( container );

            // Create scene, camera, and orbit controls 
            scene = new THREE.Scene();            
            camera = new THREE.PerspectiveCamera();
            new THREE.OrbitControls( camera, container );

            // Create a new DAT.gui controller 
            gui = new dat.GUI();     
            const propDesc = getOptionsDescriptor();
            const props = new PropList(propDesc);
            props.fromJson(options);
            bind(props, "Controls", propDesc, gui, () => updateScene);

            // Ground            
            plane = new THREE.Mesh(
                new THREE.PlaneBufferGeometry( ),
                new THREE.MeshPhongMaterial( )
            );
            plane.rotation.x = -Math.PI/2;
            plane.receiveShadow = true;
            scene.add( plane );
    
            // Lights
            sunlight = new THREE.HemisphereLight();
            scene.add(sunlight);
            light1 = addShadowedLight(scene);
            light2 = addShadowedLight(scene);

            // Material 
            material = new THREE.MeshPhongMaterial( settings.material );

            // THREE JS renderer
            renderer = new THREE.WebGLRenderer( { antialias: true } );
            renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( window.innerWidth, window.innerHeight );
            renderer.gammaInput = true;
            renderer.gammaOutput = true;
            renderer.shadowMap.enabled = true;
            container.appendChild( renderer.domElement );

            // Stats display 
            stats = new Stats();
            container.appendChild( stats.dom );
            
            // Resize listener 
            window.addEventListener( 'resize', onWindowResize, false );
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize( window.innerWidth, window.innerHeight );
        }
        
        function loadIntoScene(fileName) {        
            const extPos = fileName.lastIndexOf(".");
            const ext = fileName.slice(extPos + 1).toLowerCase();
            
            // Used with PLY example
            // Used with STL example 
            //const material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );

            switch (ext) {
                case "3ds": {
                    const loader = new THREE.TDSLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "fbx": {
                    const loader = new THREE.FBXLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "dae":  {
                    const loader = new THREE.ColladaLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "gltf": {
                    const loader = new THREE.GLTFLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj.scene);
                        scene.add(obj);
                    });
                    return;
                }
                case "gcode": {
                    const loader = new THREE.GCodeLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "obj": {
                    const loader = new THREE.OBJLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "pcd": {
                    const loader = new THREE.PCDLoader();
                    loader.load(fileName, (obj) => {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "ply": {
                    const loader = new THREE.PLYLoader();
                    loader.load(fileName, ( geometry ) => {
                        geometry.computeVertexNormals();
                        let obj = new THREE.Mesh( geometry );
                        objects.push(obj)
                        scene.add(obj);
                    });
                    return;
                }
                case "stl": {
                    const loader =  new THREE.STLLoader();
                    loader.load(fileName, ( geometry ) => {
                        geometry.computeVertexNormals();
                        let obj = new THREE.Mesh( geometry );
                        objects.push(obj)
                        scene.add(obj);
                    });
                    return;
                }
                default:
                    throw new Error("Unrecognized file type extension '" + ext + "' for file " + fileName);
            }
        }

        function updateObjects() {
            scene.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    const scale = scalarToVec(settings.object.scale);
                    child.scale.copy( scale );   
                    child.material = material;
                    child.position.copy (settings.object.position);
                }
            } );
        }


        // Helper functions 
        function toVec(obj) {
            return new THREE.Vector3(obj.x, obj.y, obj.z)
        }        
        function scalarToVec(x) {
            return new THREE.Vector3(x, x, x);
        }
        function addShadowedLight(scene) {
            var directionalLight = new THREE.DirectionalLight();
            scene.add( directionalLight );
            directionalLight.castShadow = true;
            var d = 1;
            directionalLight.shadow.camera.left = -d;
            directionalLight.shadow.camera.right = d;
            directionalLight.shadow.camera.top = d;
            directionalLight.shadow.camera.bottom = -d;
            directionalLight.shadow.camera.near = 1;
            directionalLight.shadow.camera.far = 4;
            directionalLight.shadow.mapSize.width = 1024;
            directionalLight.shadow.mapSize.height = 1024;
            directionalLight.shadow.bias = -0.001;
            return directionalLight;
        }        

        // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

        function dragOverHandler(ev) {
            console.log('File(s) in drop zone'); 

            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
        }

        function droppedFile(file) {
            // TODO: deal with other data ... 
            const fileName = file.name;
            loadIntoScene("../data/" + fileName);    
        }

        function dropHandler(ev) {
            console.log('File(s) dropped');
            
            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
            
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                for (var i = 0; i < ev.dataTransfer.items.length; i++) {
                    // If dropped items aren't files, reject them
                    if (ev.dataTransfer.items[i].kind === 'file') {
                        var file = ev.dataTransfer.items[i].getAsFile();
                        droppedFile(file);
                    }
                }
            } else {
                // Use DataTransfer interface to access the file(s)
                for (var i = 0; i < ev.dataTransfer.files.length; i++) {
                    droppedFile(ev.dataTransfer.files[i]);
                }
            } 
            
            // Pass event to removeDragData for cleanup
            removeDragData(ev)
        }   

        function removeDragData(ev) {            
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to remove the drag data
                ev.dataTransfer.items.clear();
            } else {
                // Use DataTransfer interface to remove the drag data
                ev.dataTransfer.clearData();
            }
        }

        // Calls render, and asks the framework to prepare the next frame 
        function animate() {
            requestAnimationFrame( animate );
            render();
            stats.update();
        }

        // Updates scene objects, moves the camera, and draws the scene 
        function render() {            
            updateObjects();
            updateScene();
            var timer = Date.now() * 0.0005;
            camera.position.x = Math.sin( timer ) * 2.5;
            camera.position.z = Math.cos( timer ) * 2.5;
            camera.lookAt( cameraTarget );
            renderer.render( scene, camera );
        }
    }
}
