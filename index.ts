/*
Ara Viewer 
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License

A simple and easy to use 3D Model Web-Viewer built with Three.JS that eliminates a lot of boilerplate. 
This is based on a combination of examples from the Three.JS web-site. 

Example usage: 

    <html>
    <head>
    <title>Three Viewer Example</title>
    </head>
    <script src="../dist/ara-viewer.js"></script>
    <body>
    </body>
    <script>
        ara.view({ url: './dragon.ply' });
    </script>
    </html>
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
class PropList 
{
    readonly items: (PropValue|PropList)[] = [];
    constructor(public readonly desc: IPropDescMap, public readonly name: string = '') {
        for (const k in desc) {
            const v = desc[k];
            if (v instanceof PropDesc) 
                this.items.push(new PropValue(v));            
            else 
                this.items.push(new PropList(v, k));            
        }
    }
    fromJson(json: PropListJson) {
        for (const pv of this.items) {
            if (pv.name in json) {
                const v = json[pv.name];
                if (pv instanceof PropValue) 
                    pv.value = v;
                else 
                    pv.fromJson(v);
            }
        }
        return this;
    }
    get toJson(): PropListJson {
        const r = {};
        for (const pv of this.items) {
            if (pv instanceof PropValue) {
                r[pv.name] = pv.value;
            }
            else {
                r[pv.name] = pv.toJson;
            }
        }
        return r;
    }    
    find(name: string): PropValue|PropList|undefined {
        return this.items.find(v => v.name === name);
    }
}

/** Used for callbacks when a property value is changed. */
type PropValueChanged = (pv: PropValue) => void;

/** 
 * Fills out a dat.gui instance to a property list.
 */
function bindControls(list: PropList, gui: any, onChange: PropValueChanged) {
    for (const k in list.desc) {
        bindControl(list, k, gui, onChange);
    }
    return gui;
}

/** 
 * Fills out a dat.gui control to a property in a property list.
 */
function bindControl(list: PropList, name: string, gui: any, onChange: PropValueChanged) {
    const pv = list.find(name);        
    if (!pv)
        throw new Error("Could not find parameter " + name);
    // Do I really need to pass a PropDesc?? 
    if (pv instanceof PropValue) {
        const desc = pv._desc;
        if (desc.choices) {
            return gui.add(pv, "value", desc.choices).name(pv.name).setValue(pv.value).onChange(() => onChange(pv));
        }
        else if (desc.type === 'vec3') {
            const folder = gui.addFolder(desc.name);                
            folder.open();
            folder.add(pv.value, "x").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv.value, "y").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv.value, "z").step(0.1).onChange(() => onChange(pv));                
            return folder;
        }
        else if (desc.type === 'hsv') {
            const folder = gui.addFolder(desc.name);                
            folder.open();
            folder.add(pv.value, "x").name("hue").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv.value, "y").name("saturation").step(0.1).onChange(() => onChange(pv));                
            folder.add(pv.value, "z").name("value").step(0.1).onChange(() => onChange(pv));                
            return folder;
        }
        else if (desc.type === 'rot') {
            const folder = gui.addFolder(desc.name);                
            folder.open();
            folder.add(pv.value, "yaw", -1, 1, 0.01).onChange(() => onChange(pv));                
            folder.add(pv.value, "pitch", -1, 1, 0.01).onChange(() => onChange(pv));                
            folder.add(pv.value, "roll", -1, 1, 0.01).onChange(() => onChange(pv));                
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
        // It is a property list. We create a new folder, and add controls to the folder.
        const folder = gui.addFolder(name);
        //folder.open();
        bindControls(pv, folder, onChange);
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

// Main ARA code
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
        let stats, gui, controls;
        let camera, cameraTarget, scene, renderer, material, plane, sunlight, light1, light2, settings;
        let materialsLoaded = false;
        let objects = [];

        // Used with STL example 
        //const material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );

        // TODO animation
        // Default options object (merged with passed options)
        const defaultOptions = {
            showGui: false,
            camera: {
                near: 0.1,
                far: 15000,
                fov: 50,
                zoom: 1,
                rotate: 1.0,
                position: { x: 0, y: 5, z: -5 },
                target: { x: 0, y: -1, z: 0, },
            },
            background: {
                color: { r: 0x72, g: 0x64, b: 0x5b, }
            },
            plane: {
                show: true, 
                material: {
                    color: { r: 0x99, g: 0x99, b: 0x99, },
                    specular: { r: 0x10, g: 0x10, b: 0x10, }
                },
                position: {
                    x:0, y :0, z:0
                }
            },
            sunlight: { 
                skyColor: { r: 0x44, g: 0x33, b: 0x33 },
                groundColor: { r: 0x11, g: 0x11, b: 0x22 },
                intensity: 1,
            },
            light1: {
                // TODO: the positions of the lights are all wrong. 
                position: { x: 1, y: 1, z: 1 }, 
                color: { r: 0xFF, g: 0xFF, b: 0xFF },
                intensity: 1.35,
            },
            light2: {
                position: { x: 0.5, y: 1, z: -1 }, 
                color: { r: 0xFF, g: 0xAA, b: 0x00 },
                intensity: 1,
            },
            object: {
                scale: 0.01,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                material: {
                    color: { r: 0x00, g: 0x55, b: 0xFF },
                    emissive: { r: 0x00, g: 0x00, b: 0x00 },
                    specular: { r: 0x11, g: 0x11, b: 0x11 },
                    flatShading: true,
                    shininess: 30,
                    wireframe: false,
                }
            }            
        }

        // Initialization of scene, loading of objects, and launch animation loop
        init();       
        loadIntoScene(settings.url, settings.mtlurl);
        animate();

        function isColor(obj) {
            return typeof(obj) === 'object' && 'r' in obj && 'g' in obj && 'b' in obj;
        }

        function toColor(c) {
            if (!isColor(c))
                throw new Error("Not a color");
            return new THREE.Color(c.r / 255, c.g / 255, c.b  / 255);
        }

        function toEuler(rot) {
            return new THREE.Euler(rot.x * Math.PI / 180, rot.y * Math.PI / 180, rot.z * Math.PI / 180)
        }

        function updateMaterial(targetMaterial, settings) {
            if ('color' in settings) targetMaterial.color = toColor(settings.color);
            if ('flatShading' in settings) targetMaterial.flatShading = settings.flatShading;
            if ('emissive' in settings) targetMaterial.emissive = toColor(settings.emissive);
            if ('specular' in settings) targetMaterial.specular = toColor(settings.specular);
            if ('wireframe' in settings) targetMaterial.wireframe = settings.wireframe;
            if ('shininess' in settings) targetMaterial.shininess = settings.shininess;
        }

        function updateCamera() {
            // TODO: camera updates aren't working
            camera.fov = settings.camera.fov;
            camera.zoom = settings.camera.zoom;
            camera.near = settings.camera.near;
            camera.far = settings.camera.far;
            camera.position.copy(toVec(settings.camera.position));
            cameraTarget = toVec(settings.camera.target);
            camera.lookAt( cameraTarget );
        }

        // Called every frame in case settings are updated 
        function updateScene() {
            
            scene.background = toColor(settings.background.color);
            // TODO: do we really need fog? I think it is useless. 
            //scene.fog = new THREE.Fog( settings.fog.color, settings.fog.near, settings.fog.far );
            plane.visible = settings.plane.show;
            updateMaterial(plane.material, settings.plane.material);
            plane.position.copy(toVec(settings.plane.position));
            light1.position.copy(toVec(settings.light1.position));
            light1.color = toColor(settings.light1.color);
            light1.intensity = settings.light1.intensity;
            light2.position.copy(toVec(settings.light2.position));
            light2.color = toColor(settings.light2.color);
            light2.intensity = settings.light2.intensity;
            sunlight.skyColor = toColor(settings.sunlight.skyColor);
            sunlight.groundColor = toColor(settings.sunlight.groundColor);
            sunlight.intensity = settings.sunlight.intensity;
        } 

        function updateObjects() {
            scene.traverse( function ( child ) {
                if ( child.isMesh && child !== plane) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    const scale = scalarToVec(settings.object.scale);
                    child.scale.copy( scale ); 
                    if (!materialsLoaded) {
                        updateMaterial(material, settings.object.material);
                        child.material = material;
                    }
                    child.position.copy(settings.object.position);
                    child.rotation.copy(toEuler(settings.object.rotation));
                }
            } );
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

        function getOrCreateDownloadLink() {
            const downloadLinkId = "ara_download_link_id";
            let downloadLink = document.getElementById(downloadLinkId);
            if (!downloadLink) {
                downloadLink = document.createElement("a");
                downloadLink.id = downloadLinkId;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            return downloadLink;
        }

        //https://stackoverflow.com/questions/17836273/export-javascript-data-to-csv-file-without-server-interaction
        function exportFile() {
            const downloadLink = getOrCreateDownloadLink() as HTMLAnchorElement;
            downloadLink.download = 'model.g3d';
            // TODO: fill out the G3D information in the blob.
            const data = new Blob();
            downloadLink.href = window.URL.createObjectURL(data);
            downloadLink.click();
        }

        // Scene initialization
        function init() 
        {
            // Initialize the settings 
            settings = (new DeepMerge()).deepMerge(defaultOptions, options, undefined);

            // If a canvas is given, we will draw in it.
            let canvas = document.getElementById(settings.canvasId);
            if (!canvas) {
                // Add to a div in the web page.
                canvas = document.createElement( 'canvas' );
                document.body.appendChild(canvas)
            } 
            renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );

            // Create the camera and size everything appropriately  
            camera = new THREE.PerspectiveCamera();
            updateCamera();
            resizeCanvas(true);

            // Create scene object
            scene = new THREE.Scene();            
            
            // Create a property descriptor 
            const propDesc = getOptionsDescriptor();

            // Create a property list from the descriptor 
            const props = new PropList(propDesc);

            // Iniitlaize the property list values             
            props.fromJson(options);            

            if (settings.showGui) {
                // Create a new DAT.gui controller 
                gui = new dat.GUI();    
                
                // Bind the properties to the DAT.gui controller, returning the scene when it updates
                bindControls(props, gui, () => {
                    settings = props.toJson;
                    updateScene();
                });

                // TODO: enable this.
                var obj = { export:exportFile };
                gui.add(obj, 'export' ).name("Export to G3D ... ");
            } 

            // Ground            
            plane = new THREE.Mesh(
                new THREE.PlaneBufferGeometry(1000, 1000),
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
            material = new THREE.MeshPhongMaterial( );

            // THREE JS renderer
            renderer.setPixelRatio( window.devicePixelRatio );            
            renderer.gammaInput = true;
            renderer.gammaOutput = true;
            renderer.shadowMap.enabled = true;

            // Initial scene update: happens if controls change 
            updateScene();

            // Create orbit controls
            controls = new THREE.OrbitControls( camera, renderer.domElement );
            controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
            controls.dampingFactor = 0.25;
            controls.autoRotate = settings.camera.autoRotate;
            controls.autoRotateSpeed = settings.camera.rotateSpeed;            

            // Initial update of the camera
            updateCamera(); 

            // Stats display 
            if (settings.showStats) {
                stats = new Stats();
                renderer.domElement.appendChild( stats.dom );
            }            
        }

        function resizeCanvas(force: boolean = false) {            
            if (!settings.autoResize && !force)
                return;

            const canvas = renderer.domElement;
            const parent = canvas.parentElement as Element;

            //canvas.width  = parent.clientWidth;
            //canvas.height = parent.clientHeight;

            // https://stackoverflow.com/questions/41814539/html-div-height-keeps-growing-on-window-resize-event
            // you must pass false here or three.js sadly fights the browser
            //<canvas id="canvas3d" style="position: absolute"></canvas>
            
            const rect = parent.getBoundingClientRect();
            const w = rect.width / window.devicePixelRatio 
            const h  = rect.height / window.devicePixelRatio;
            renderer.setSize(w, h, false);

            // Set aspect ratio
            camera.aspect = canvas.width / canvas.height;
            camera.updateProjectionMatrix();
        }

        function outputStats(obj) {
            console.log("Object id = " + obj.uuid + " name = " + obj.name)
            if (obj.isBufferGeometry) {
                console.log("Is a BufferGeometry");
                const position = obj.getAttribute('position');
                if (!position)
                    throw new Error("Could not find a position attribute");
                const nVerts = position.count;
                const nFaces = obj.index ? obj.index.count / 3 : nVerts / 3;
                console.log("# vertices = " + nVerts);
                console.log("# faces = " + nFaces);
                for (let attrName in obj.attributes) {
                    const attr = obj.getAttribute(attrName);
                    console.log("has attribute " + attrName + " with a count of " + attr.count);
                }
            }
            else if (obj.isGeometry)
            {
                console.log("Is a Geometry");
                console.log("# vertices = " + obj.vertices.length);
                console.log("# faces = " + obj.faces.length);
            }
            else 
            {
                console.log("Is neither a Geometry nor a BufferGeometry");
            }
        }

        function loadObject(obj) {
            objects.push(obj);
            scene.add(obj);
            console.timeEnd("Loading object")

            // Output some stats 
            if (obj.geometry)
                outputStats(obj.geometry);
            else
                console.log("No geometry found");
        }
        
        function loadIntoScene(fileName, mtlurl) {        
            console.log("Loading object from " + fileName);
            console.time("Loading object")
            const extPos = fileName.lastIndexOf(".");
            const ext = fileName.slice(extPos + 1).toLowerCase();

            switch (ext) {
                case "3ds": {
                    const loader = new THREE.TDSLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "fbx": {
                    const loader = new THREE.FBXLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "dae":  {
                    const loader = new THREE.ColladaLoader();
                    loader.load(fileName, loadObject);
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
                    loader.load(fileName, loadObject);
                    return;
                }
                case "obj": {
                    const objLoader = new THREE.OBJLoader();                    
                    const mtlLoader = new THREE.MTLLoader();
                    if (mtlurl) {                        
                        mtlLoader.load(mtlurl, (mats) => {
                            mats.preload();
                            materialsLoaded = true;
                            objLoader.setMaterials(mats).load(fileName, loadObject);
                        }, null, () => {
                            console.warn("Failed to load material " + mtlurl + " trying to load obj alone");
                            objLoader.load(fileName, loadObject);
                        });
                    }
                    else {
                        objLoader.load(fileName, loadObject);
                    }
                    return;
                }
                case "pcd": {
                    const loader = new THREE.PCDLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "ply": {
                    const loader = new THREE.PLYLoader();
                    loader.load(fileName, ( geometry ) => {
                        geometry.computeVertexNormals();
                        loadObject(new THREE.Mesh( geometry ));
                    });
                    return;
                }
                case "stl": {
                    const loader =  new THREE.STLLoader();
                    loader.load(fileName, ( geometry ) => {
                        geometry.computeVertexNormals();
                        loadObject(new THREE.Mesh( geometry ));
                    });
                    return;
                }
                case "g3d": {
                    const loader = new THREE.G3DLoader();
                    loader.load(fileName, ( geometry ) => {
                        // TODO: decide whether this is really necessary
                        geometry.computeVertexNormals();
                        loadObject(new THREE.Mesh( geometry ));
                    });
                    return;
                }
                case "vim": {
                    const loader = new THREE.VIMLoader();
                    loader.load(fileName, (objs) => {
                        for (var i=0; i < objs.length; ++i)                        
                            loadObject(new THREE.Mesh( objs[i] ));

                        // TODO: add an entire scene 
                        //objects.push(obj.scene);
                        //scene.add(obj);
                    });
                    return;
                }
                default:
                    throw new Error("Unrecognized file type extension '" + ext + "' for file " + fileName);
            }
        }

        // Helper functions 
        function toVec(obj) {
            return new THREE.Vector3(obj.x, obj.y, obj.z)
        }        
        function scalarToVec(x) {
            return new THREE.Vector3(x, x, x);
        }
        function addShadowedLight(scene) {
            const dirLight = new THREE.DirectionalLight();
            scene.add( dirLight );
            dirLight.castShadow = true;
            const d = 1;
            dirLight.shadow.camera.left = -d;
            dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d;
            dirLight.shadow.camera.bottom = -d;
            dirLight.shadow.camera.near = 0.01;
            dirLight.shadow.camera.far = 1000;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            dirLight.shadow.bias = -0.001;
            return dirLight;
        }        

        // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

        function dragOverHandler(ev) {
            console.log('File(s) in drop zone'); 

            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
        }

        function droppedFile(file) {
            // TODO: this is going to be 
            const fileName = file.name;
            loadIntoScene(fileName, null);    
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
            if (stats)
                stats.update();
        }

        // Updates scene objects, and draws the scene 
        // TODO: update the camera 
        function render() { 
            resizeCanvas(); 
            updateCamera();
            updateObjects();
            controls.update();
            renderer.render( scene, camera );
        }
    }
}
