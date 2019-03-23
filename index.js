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
// Used to provide new IDs for each new property descriptor that is created.
var gid = 0;
/**
 * Describes a property so that it can be found
 */
var PropDesc = /** @class */ (function () {
    function PropDesc(type, def) {
        this.type = type;
        this.def = def;
        this.id = gid++;
        this.name = "";
        this.vis = true;
    }
    PropDesc.prototype.setStep = function (step) {
        this.step = step;
        return this;
    };
    PropDesc.prototype.setRange = function (min, max) {
        this.min = min;
        this.max = max;
        return this;
    };
    PropDesc.prototype.setName = function (name) {
        this.name = name;
        return this;
    };
    PropDesc.prototype.setChoices = function (xs) {
        this.choices = xs;
        return this;
    };
    PropDesc.prototype.setOptions = function (xs) {
        this.options = xs;
        return this;
    };
    return PropDesc;
}());
/**
 * Holds a value, and a reference to the descriptor.
 */
var PropValue = /** @class */ (function () {
    function PropValue(_desc) {
        this._desc = _desc;
        this._value = _desc.def;
    }
    Object.defineProperty(PropValue.prototype, "name", {
        get: function () { return this._desc.name; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PropValue.prototype, "value", {
        get: function () { return this._value; },
        set: function (value) { this._value = value; },
        enumerable: true,
        configurable: true
    });
    return PropValue;
}());
/**
 * A list of properties. The values can be get and set directly on this object.
 */
var PropList = /** @class */ (function () {
    function PropList(desc, name) {
        if (name === void 0) { name = ''; }
        this.desc = desc;
        this.name = name;
        this.items = [];
        for (var k in desc) {
            var v = desc[k];
            if (v instanceof PropDesc)
                this.items.push(new PropValue(v));
            else
                this.items.push(new PropList(v, k));
        }
    }
    PropList.prototype.fromJson = function (json) {
        for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
            var pv = _a[_i];
            if (pv.name in json) {
                var v = json[pv.name];
                if (pv instanceof PropValue)
                    pv.value = v;
                else
                    pv.fromJson(v);
            }
        }
        return this;
    };
    Object.defineProperty(PropList.prototype, "toJson", {
        get: function () {
            var r = {};
            for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
                var pv = _a[_i];
                if (pv instanceof PropValue) {
                    r[pv.name] = pv.value;
                }
                else {
                    r[pv.name] = pv.toJson;
                }
            }
            return r;
        },
        enumerable: true,
        configurable: true
    });
    PropList.prototype.find = function (name) {
        return this.items.find(function (v) { return v.name === name; });
    };
    return PropList;
}());
/**
 * Fills out a dat.gui instance to a property list.
 */
function bindControls(list, gui, onChange) {
    for (var k in list.desc) {
        bindControl(list, k, gui, onChange);
    }
    return gui;
}
/**
 * Fills out a dat.gui control to a property in a property list.
 */
function bindControl(list, name, gui, onChange) {
    var pv = list.find(name);
    if (!pv)
        throw new Error("Could not find parameter " + name);
    // Do I really need to pass a PropDesc?? 
    if (pv instanceof PropValue) {
        var desc = pv._desc;
        if (desc.choices) {
            return gui.add(pv, "value", desc.choices).name(pv.name).setValue(pv.value).onChange(function () { return onChange(pv); });
        }
        else if (desc.type === 'vec3') {
            var folder = gui.addFolder(desc.name);
            folder.open();
            folder.add(pv.value, "x").step(0.1).onChange(function () { return onChange(pv); });
            folder.add(pv.value, "y").step(0.1).onChange(function () { return onChange(pv); });
            folder.add(pv.value, "z").step(0.1).onChange(function () { return onChange(pv); });
            return folder;
        }
        else if (desc.type === 'hsv') {
            var folder = gui.addFolder(desc.name);
            folder.open();
            folder.add(pv.value, "x").name("hue").step(0.1).onChange(function () { return onChange(pv); });
            folder.add(pv.value, "y").name("saturation").step(0.1).onChange(function () { return onChange(pv); });
            folder.add(pv.value, "z").name("value").step(0.1).onChange(function () { return onChange(pv); });
            return folder;
        }
        else if (desc.type === 'rot') {
            var folder = gui.addFolder(desc.name);
            folder.open();
            folder.add(pv.value, "yaw", -1, 1, 0.01).onChange(function () { return onChange(pv); });
            folder.add(pv.value, "pitch", -1, 1, 0.01).onChange(function () { return onChange(pv); });
            folder.add(pv.value, "roll", -1, 1, 0.01).onChange(function () { return onChange(pv); });
            return folder;
        }
        else if (desc.type === 'color') {
            var controller = gui.addColor(pv, "value").name(pv.name);
            controller.onChange(function () { return onChange(pv); });
            return controller;
        }
        else {
            var controller = gui.add(pv, "value", desc.min, desc.max, desc.step).name(pv.name);
            controller.onChange(function () { return onChange(pv); });
            return controller;
        }
    }
    else {
        // It is a property list. We create a new folder, and add controls to the folder.
        var folder = gui.addFolder(name);
        //folder.open();
        bindControls(pv, folder, onChange);
        return folder;
    }
}
// Helper functions for defining properties 
function prop(type, def) { return new PropDesc(type, def); }
function boolProp(x) { return prop("boolean", x); }
function stringProp(x) { return prop("string", x); }
function floatProp(x) {
    if (x === void 0) { x = 0; }
    return prop("float", x);
}
function smallFloatProp(x) {
    if (x === void 0) { x = 0; }
    return prop("float", x).setStep(0.01);
}
function colorCompProp(x) {
    if (x === void 0) { x = 0; }
    return rangedIntProp(x, 0, 255);
}
function intProp(x) { return prop("int", x); }
function rangedIntProp(x, min, max) { return intProp(x).setRange(min, max); }
function rangedFloatProp(x, min, max) { return floatProp(x).setRange(min, max); }
function zeroToOneProp(x) { return floatProp(x).setRange(0, 1).setStep(0.01); }
function oneOrMoreIntProp(x) { return intProp(x).setRange(1); }
function timeProp(x) { return prop("time", x); }
function choiceProp(xs) { return prop("choices", xs[0]).setChoices(xs); }
function vec3Prop(x, y, z) {
    if (x === void 0) { x = 0; }
    if (y === void 0) { y = 0; }
    if (z === void 0) { z = 0; }
    return prop('vec3', { x: x, y: y, z: z });
}
function scaleProp() { return prop('vec3', { x: 1, y: 1, z: 1 }); }
function rotProp(yaw, pitch, roll) {
    if (yaw === void 0) { yaw = 0; }
    if (pitch === void 0) { pitch = 0; }
    if (roll === void 0) { roll = 0; }
    return prop('rot', { yaw: yaw, pitch: pitch, roll: roll });
}
function axisProp() { return choiceProp(['x', 'y', 'z']).setName("axis"); }
function conditionalProp(val, options) { return prop('conditional', val).setOptions(options); }
function colorProp(r, g, b) {
    if (r === void 0) { r = 0; }
    if (g === void 0) { g = 0; }
    if (b === void 0) { b = 0; }
    return prop('color', [r, g, b]);
}
// BEGIN: Deep merge copy and paste (With mods)
// The MIT License (MIT)
// Copyright (c) 2012 Nicholas Fisher
// https://github.com/KyleAMathews/deepmerge/blob/master/license.txt
var DeepMerge = /** @class */ (function () {
    function DeepMerge() {
    }
    DeepMerge.prototype.isMergeableObject = function (val) {
        return val && typeof val === 'object';
    };
    DeepMerge.prototype.emptyTarget = function (val) {
        return Array.isArray(val) ? [] : {};
    };
    DeepMerge.prototype.cloneIfNecessary = function (value, optionsArgument) {
        var clone = optionsArgument && optionsArgument.clone === true;
        return (clone && this.isMergeableObject(value)) ? this.deepMerge(this.emptyTarget(value), value, optionsArgument) : value;
    };
    DeepMerge.prototype.defaultArrayMerge = function (target, source, optionsArgument) {
        var destination = target.slice();
        for (var i = 0; i < destination.length; ++i) {
            var e = destination[i];
            if (typeof destination[i] === 'undefined')
                destination[i] = this.cloneIfNecessary(e, optionsArgument);
            else if (this.isMergeableObject(e))
                destination[i] = this.deepMerge(target[i], e, optionsArgument);
            else if (target.indexOf(e) === -1)
                destination.push(this.cloneIfNecessary(e, optionsArgument));
        }
        return destination;
    };
    DeepMerge.prototype.mergeObject = function (target, source, optionsArgument) {
        var destination = {};
        if (this.isMergeableObject(target))
            for (var key in target)
                destination[key] = this.cloneIfNecessary(target[key], optionsArgument);
        for (var key in source)
            if (!this.isMergeableObject(source[key]) || !target[key])
                destination[key] = this.cloneIfNecessary(source[key], optionsArgument);
            else
                destination[key] = this.deepMerge(target[key], source[key], optionsArgument);
        return destination;
    };
    DeepMerge.prototype.deepMerge = function (target, source, optionsArgument) {
        var array = Array.isArray(source);
        var options = optionsArgument || { arrayMerge: this.defaultArrayMerge };
        var arrayMerge = options.arrayMerge || this.defaultArrayMerge;
        if (array)
            return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : this.cloneIfNecessary(source, optionsArgument);
        else
            return this.mergeObject(target, source, optionsArgument);
    };
    return DeepMerge;
}());
// END: Deepmerge
// Main ARA code
var ara = {
    view: function (options) {
        // Check WebGL presence
        if (!Detector.webgl) {
            Detector.addGetWebGLMessage();
            return;
        }
        // Variables 
        var stats, gui, controls;
        var camera, cameraTarget, scene, renderer, material, plane, sunlight, light1, light2, settings;
        var materialsLoaded = false;
        var objects = [];
        // Used with STL example 
        //const material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
        // Default options object (merged with passed options)
        var defaultOptions = {
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
                    x: 0, y: 0, z: 0
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
        };
        // Initialization of scene, loading of objects, and launch animation loop
        init();
        loadIntoScene(settings.url, settings.mtlurl);
        animate();
        function isColor(obj) {
            return typeof (obj) === 'object' && 'r' in obj && 'g' in obj && 'b' in obj;
        }
        function toColor(c) {
            if (!isColor(c))
                throw new Error("Not a color");
            return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
        }
        function toEuler(rot) {
            return new THREE.Euler(rot.x * Math.PI / 180, rot.y * Math.PI / 180, rot.z * Math.PI / 180);
        }
        function updateMaterial(targetMaterial, settings) {
            if ('color' in settings)
                targetMaterial.color = toColor(settings.color);
            if ('flatShading' in settings)
                targetMaterial.flatShading = settings.flatShading;
            if ('emissive' in settings)
                targetMaterial.emissive = toColor(settings.emissive);
            if ('specular' in settings)
                targetMaterial.specular = toColor(settings.specular);
            if ('wireframe' in settings)
                targetMaterial.wireframe = settings.wireframe;
            if ('shininess' in settings)
                targetMaterial.shininess = settings.shininess;
        }
        function updateCamera() {
            camera.fov = settings.camera.fov;
            camera.zoom = settings.camera.zoom;
            camera.near = settings.camera.near;
            camera.far = settings.camera.far;
            camera.position.copy(toVec(settings.camera.position));
            cameraTarget = toVec(settings.camera.target);
            camera.lookAt(cameraTarget);
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
            scene.traverse(function (child) {
                if (child.isMesh && child !== plane) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    var scale = scalarToVec(settings.object.scale);
                    child.scale.copy(scale);
                    if (!materialsLoaded) {
                        updateMaterial(material, settings.object.material);
                        child.material = material;
                    }
                    child.position.copy(settings.object.position);
                    child.rotation.copy(toEuler(settings.object.rotation));
                }
            });
        }
        function objectToPropDesc(obj, pdm) {
            // TODO: look for common patterns (colors, positions, angles) and process these specially.
            for (var k in obj) {
                var v = obj[k];
                switch (typeof (v)) {
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
        function getOptionsDescriptor() {
            return objectToPropDesc(defaultOptions, {});
        }
        // Scene initialization
        function init() {
            // Initialize the settings 
            settings = (new DeepMerge()).deepMerge(defaultOptions, options, undefined);
            // If a canvas is given, we will draw in it.
            var canvas = document.getElementById(settings.canvasId);
            if (!canvas) {
                // Add to a div in the web page.
                canvas = document.createElement('canvas');
                document.body.appendChild(canvas);
            }
            renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
            // Create the camera and size everything appropriately  
            camera = new THREE.PerspectiveCamera();
            updateCamera();
            resizeCanvas(true);
            // Create scene object
            scene = new THREE.Scene();
            // Create a property descriptor 
            var propDesc = getOptionsDescriptor();
            // Create a property list from the descriptor 
            var props = new PropList(propDesc);
            // Iniitlaize the property list values             
            props.fromJson(options);
            if (settings.showGui) {
                // Create a new DAT.gui controller 
                gui = new dat.GUI();
                // Bind the properties to the DAT.gui controller, returning the scene when it updates
                bindControls(props, gui, function () {
                    settings = props.toJson;
                    updateScene();
                });
            }
            // Ground            
            plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000), new THREE.MeshPhongMaterial());
            plane.rotation.x = -Math.PI / 2;
            plane.receiveShadow = true;
            scene.add(plane);
            // Lights
            sunlight = new THREE.HemisphereLight();
            scene.add(sunlight);
            light1 = addShadowedLight(scene);
            light2 = addShadowedLight(scene);
            // Material 
            material = new THREE.MeshPhongMaterial();
            // THREE JS renderer
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.gammaInput = true;
            renderer.gammaOutput = true;
            renderer.shadowMap.enabled = true;
            // Initial scene update: happens if controls change 
            updateScene();
            // Create orbit controls
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
            controls.dampingFactor = 0.25;
            controls.autoRotate = settings.camera.rotate > 0.0001 || settings.camera.rotate < -0.0001;
            controls.autoRotateSpeed = settings.camera.rotate;
            // Initial update of the camera
            updateCamera();
            // Stats display 
            if (settings.showStats) {
                stats = new Stats();
                renderer.domElement.appendChild(stats.dom);
            }
        }
        function resizeCanvas(force) {
            if (force === void 0) { force = false; }
            if (!settings.autoResize && !force)
                return;
            var canvas = renderer.domElement;
            var parent = canvas.parentElement;
            //canvas.width  = parent.clientWidth;
            //canvas.height = parent.clientHeight;
            // https://stackoverflow.com/questions/41814539/html-div-height-keeps-growing-on-window-resize-event
            // you must pass false here or three.js sadly fights the browser
            //<canvas id="canvas3d" style="position: absolute"></canvas>
            var rect = parent.getBoundingClientRect();
            var w = rect.width / window.devicePixelRatio;
            var h = rect.height / window.devicePixelRatio;
            renderer.setSize(w, h, false);
            // Set aspect ratio
            camera.aspect = canvas.width / canvas.height;
            camera.updateProjectionMatrix();
        }
        function outputStats(obj) {
            console.log("Object id = " + obj.uuid + " name = " + obj.name);
            if (obj.isBufferGeometry) {
                console.log("Is a BufferGeometry");
                var position = obj.getAttribute('position');
                if (!position)
                    throw new Error("Could not find a position attribute");
                var nVerts = position.count;
                var nFaces = obj.index ? obj.index.count / 3 : nVerts / 3;
                console.log("# vertices = " + nVerts);
                console.log("# faces = " + nFaces);
                for (var attrName in obj.attributes) {
                    var attr = obj.getAttribute(attrName);
                    console.log("has attribute " + attrName + " with a count of " + attr.count);
                }
            }
            else if (obj.isGeometry) {
                console.log("Is a Geometry");
                console.log("# vertices = " + obj.vertices.length);
                console.log("# faces = " + obj.faces.length);
            }
            else {
                console.log("Is neither a Geometry nor a BufferGeometry");
            }
        }
        function loadObject(obj) {
            objects.push(obj);
            scene.add(obj);
            console.timeEnd("Loading object");
            // Output some stats 
            outputStats(obj.geometry);
        }
        function loadIntoScene(fileName, mtlurl) {
            console.log("Loading object from " + fileName);
            console.time("Loading object");
            var extPos = fileName.lastIndexOf(".");
            var ext = fileName.slice(extPos + 1).toLowerCase();
            switch (ext) {
                case "3ds": {
                    var loader = new THREE.TDSLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "fbx": {
                    var loader = new THREE.FBXLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "dae": {
                    var loader = new THREE.ColladaLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "gltf": {
                    var loader = new THREE.GLTFLoader();
                    loader.load(fileName, function (obj) {
                        objects.push(obj.scene);
                        scene.add(obj);
                    });
                    return;
                }
                case "gcode": {
                    var loader = new THREE.GCodeLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "obj": {
                    var objLoader_1 = new THREE.OBJLoader();
                    var mtlLoader = new THREE.MTLLoader();
                    if (mtlurl) {
                        mtlLoader.load(mtlurl, function (mats) {
                            mats.preload();
                            materialsLoaded = true;
                            objLoader_1.setMaterials(mats).load(fileName, loadObject);
                        }, null, function () {
                            console.warn("Failed to load material " + mtlurl + " trying to load obj alone");
                            objLoader_1.load(fileName, loadObject);
                        });
                    }
                    else {
                        objLoader_1.load(fileName, loadObject);
                    }
                    return;
                }
                case "pcd": {
                    var loader = new THREE.PCDLoader();
                    loader.load(fileName, loadObject);
                    return;
                }
                case "ply": {
                    var loader = new THREE.PLYLoader();
                    loader.load(fileName, function (geometry) {
                        geometry.computeVertexNormals();
                        loadObject(new THREE.Mesh(geometry));
                    });
                    return;
                }
                case "stl": {
                    var loader = new THREE.STLLoader();
                    loader.load(fileName, function (geometry) {
                        geometry.computeVertexNormals();
                        loadObject(new THREE.Mesh(geometry));
                    });
                    return;
                }
                case "g3d": {
                    var loader = new THREE.G3DLoader();
                    loader.load(fileName, function (geometry) {
                        // TODO: decide whether this is really necessary
                        geometry.computeVertexNormals();
                        loadObject(new THREE.Mesh(geometry));
                    });
                    return;
                }
                default:
                    throw new Error("Unrecognized file type extension '" + ext + "' for file " + fileName);
            }
        }
        // Helper functions 
        function toVec(obj) {
            return new THREE.Vector3(obj.x, obj.y, obj.z);
        }
        function scalarToVec(x) {
            return new THREE.Vector3(x, x, x);
        }
        function addShadowedLight(scene) {
            var directionalLight = new THREE.DirectionalLight();
            scene.add(directionalLight);
            directionalLight.castShadow = true;
            var d = 1;
            directionalLight.shadow.camera.left = -d;
            directionalLight.shadow.camera.right = d;
            directionalLight.shadow.camera.top = d;
            directionalLight.shadow.camera.bottom = -d;
            directionalLight.shadow.camera.near = 0.01;
            directionalLight.shadow.camera.far = 1000;
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
            var fileName = file.name;
            loadIntoScene("../data/" + fileName, null);
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
            }
            else {
                // Use DataTransfer interface to access the file(s)
                for (var i = 0; i < ev.dataTransfer.files.length; i++) {
                    droppedFile(ev.dataTransfer.files[i]);
                }
            }
            // Pass event to removeDragData for cleanup
            removeDragData(ev);
        }
        function removeDragData(ev) {
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to remove the drag data
                ev.dataTransfer.items.clear();
            }
            else {
                // Use DataTransfer interface to remove the drag data
                ev.dataTransfer.clearData();
            }
        }
        // Calls render, and asks the framework to prepare the next frame 
        function animate() {
            requestAnimationFrame(animate);
            render();
            if (stats)
                stats.update();
        }
        // Updates scene objects, and draws the scene 
        function render() {
            resizeCanvas();
            updateObjects();
            controls.update();
            renderer.render(scene, camera);
        }
    }
};
//# sourceMappingURL=index.js.map