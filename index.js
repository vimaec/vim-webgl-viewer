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
    function PropList(propDesc) {
        this.propDesc = propDesc;
        this.items = [];
        this.createPropVals('', propDesc);
        var _loop_1 = function (pv) {
            Object.defineProperty(this_1, pv.name, {
                get: function () { return pv.value; },
                set: function (v) { return pv.value = v; },
            });
        };
        var this_1 = this;
        for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
            var pv = _a[_i];
            _loop_1(pv);
        }
    }
    PropList.prototype.fromJson = function (json) {
        for (var k in json)
            this[k] = json[k];
        return this;
    };
    Object.defineProperty(PropList.prototype, "toJson", {
        get: function () {
            var r = {};
            for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
                var pv = _a[_i];
                r[pv.name] = pv.value;
            }
            return r;
        },
        enumerable: true,
        configurable: true
    });
    PropList.prototype.createPropVals = function (name, propDesc) {
        if (propDesc instanceof PropDesc) {
            propDesc = propDesc.setName(name);
            if (propDesc.type === 'conditional') {
                var options = propDesc.options;
                this.items.push(new PropValue(propDesc));
                for (var k in options) {
                    var map = options[k];
                    for (var k2 in map) {
                        this.createPropVals(k + "." + k2, map[k2]);
                    }
                }
            }
            else {
                this.items.push(new PropValue(propDesc));
            }
        }
        else {
            for (var k in propDesc) {
                this.createPropVals(k, propDesc[k]);
            }
        }
    };
    PropList.prototype.find = function (name) {
        return this.items.find(function (v) { return v._desc.name === name; });
    };
    PropList.prototype.desc = function (name) {
        return this.find(name)._desc;
    };
    Object.defineProperty(PropList.prototype, "descs", {
        get: function () {
            return this.items.map(function (v) { return v._desc; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PropList.prototype, "values", {
        get: function () {
            return this.items.map(function (v) { return v._value; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PropList.prototype, "keys", {
        get: function () {
            return this.items.map(function (v) { return v.name; });
        },
        enumerable: true,
        configurable: true
    });
    return PropList;
}());
/**
 * Fills out a dat.gui instance according to the properties and the property descriptor map.
 */
function bind(list, name, desc, gui, onChange) {
    if (desc instanceof PropDesc) {
        var pv_1 = list.find(name);
        if (!pv_1)
            throw new Error("Could not find parameter " + name);
        if (desc.type === 'conditional') {
            var vals_1 = desc.options;
            var keys = Object.keys(vals_1);
            var controller_1 = gui.add(pv_1, 'value', keys).name(pv_1.name).setValue(pv_1.value);
            var folder_1 = null;
            var buildParameters_1 = function () {
                var local_gui = gui;
                if (folder_1)
                    local_gui.removeFolder(folder_1);
                folder_1 = local_gui.addFolder(name + " parameters");
                var baseName = pv_1.value;
                var sub = vals_1[baseName];
                // We bind the sub-properties ("MyOption.") 
                for (var k in sub) {
                    bind(list, baseName + "." + k, sub[k], folder_1, onChange);
                }
                controller_1.onChange(function () { buildParameters_1(); onChange(pv_1); });
                folder_1.open();
                return folder_1;
            };
            return buildParameters_1();
        }
        else if (desc.choices) {
            return gui.add(pv_1, "value", desc.choices).name(pv_1.name).setValue(pv_1.value).onChange(function () { return onChange(pv_1); });
        }
        else if (desc.type === 'vec3') {
            var folder = gui.addFolder(desc.name);
            folder.open();
            folder.add(pv_1._value, "x").step(0.1).onChange(function () { return onChange(pv_1); });
            folder.add(pv_1._value, "y").step(0.1).onChange(function () { return onChange(pv_1); });
            folder.add(pv_1._value, "z").step(0.1).onChange(function () { return onChange(pv_1); });
            return folder;
        }
        else if (desc.type === 'hsv') {
            var folder = gui.addFolder(desc.name);
            folder.open();
            folder.add(pv_1._value, "x").name("hue").step(0.1).onChange(function () { return onChange(pv_1); });
            folder.add(pv_1._value, "y").name("saturation").step(0.1).onChange(function () { return onChange(pv_1); });
            folder.add(pv_1._value, "z").name("value").step(0.1).onChange(function () { return onChange(pv_1); });
            return folder;
        }
        else if (desc.type === 'rot') {
            var folder = gui.addFolder(desc.name);
            folder.open();
            folder.add(pv_1._value, "yaw", -1, 1, 0.01).onChange(function () { return onChange(pv_1); });
            folder.add(pv_1._value, "pitch", -1, 1, 0.01).onChange(function () { return onChange(pv_1); });
            folder.add(pv_1._value, "roll", -1, 1, 0.01).onChange(function () { return onChange(pv_1); });
            return folder;
        }
        else if (desc.type === 'color') {
            var controller = gui.addColor(pv_1, "value").name(pv_1.name);
            controller.onChange(function () { return onChange(pv_1); });
            return controller;
        }
        else {
            var controller = gui.add(pv_1, "value", desc.min, desc.max, desc.step).name(pv_1.name);
            controller.onChange(function () { return onChange(pv_1); });
            return controller;
        }
    }
    else {
        // I assume it is a property descriptor map. 
        // We want the properties to be added hierarchically to gui.dat.
        var folder = gui.addFolder(name);
        folder.open();
        for (var k in desc)
            bind(list, k, desc[k], folder, onChange);
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
var ara = {
    view: function (options) {
        // Check WebGL presence
        if (!Detector.webgl) {
            Detector.addGetWebGLMessage();
            return;
        }
        // Variables 
        var container, stats, gui;
        var camera, cameraTarget, scene, renderer, material, plane, sunlight, light1, light2, settings;
        var objects = [];
        // Default options object (merged with passed options)
        var defaultOptions = {
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
                    x: 0, y: -0.5, z: 0
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
        };
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
            scene.background = new THREE.Color(settings.background.color);
            scene.fog = new THREE.Fog(settings.fog.color, settings.fog.near, settings.fog.far);
            plane.material.setValues(settings.plane.material);
            plane.geometry.set;
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
            if (settings.camera.aspectRatio === undefined)
                settings.camera.aspectRatio = settings.width / settings.height;
            // DOM Element Container 
            container = document.createElement('div');
            container.ondrop = dropHandler;
            container.ondragover = dragOverHandler;
            document.body.appendChild(container);
            // Create scene, camera, and orbit controls 
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera();
            new THREE.OrbitControls(camera, container);
            // Create a new DAT.gui controller 
            gui = new dat.GUI();
            var propDesc = getOptionsDescriptor();
            var props = new PropList(propDesc);
            props.fromJson(options);
            bind(props, "Controls", propDesc, gui, function () { return updateScene; });
            // Ground            
            plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(), new THREE.MeshPhongMaterial());
            plane.rotation.x = -Math.PI / 2;
            plane.receiveShadow = true;
            scene.add(plane);
            // Lights
            sunlight = new THREE.HemisphereLight();
            scene.add(sunlight);
            light1 = addShadowedLight(scene);
            light2 = addShadowedLight(scene);
            // Material 
            material = new THREE.MeshPhongMaterial(settings.material);
            // THREE JS renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.gammaInput = true;
            renderer.gammaOutput = true;
            renderer.shadowMap.enabled = true;
            container.appendChild(renderer.domElement);
            // Stats display 
            stats = new Stats();
            container.appendChild(stats.dom);
            // Resize listener 
            window.addEventListener('resize', onWindowResize, false);
        }
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        function loadIntoScene(fileName) {
            var extPos = fileName.lastIndexOf(".");
            var ext = fileName.slice(extPos + 1).toLowerCase();
            // Used with PLY example
            // Used with STL example 
            //const material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
            switch (ext) {
                case "3ds": {
                    var loader = new THREE.TDSLoader();
                    loader.load(fileName, function (obj) {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "fbx": {
                    var loader = new THREE.FBXLoader();
                    loader.load(fileName, function (obj) {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "dae": {
                    var loader = new THREE.ColladaLoader();
                    loader.load(fileName, function (obj) {
                        objects.push(obj);
                        scene.add(obj);
                    });
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
                    loader.load(fileName, function (obj) {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "obj": {
                    var loader = new THREE.OBJLoader();
                    loader.load(fileName, function (obj) {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "pcd": {
                    var loader = new THREE.PCDLoader();
                    loader.load(fileName, function (obj) {
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "ply": {
                    var loader = new THREE.PLYLoader();
                    loader.load(fileName, function (geometry) {
                        geometry.computeVertexNormals();
                        var obj = new THREE.Mesh(geometry);
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                case "stl": {
                    var loader = new THREE.STLLoader();
                    loader.load(fileName, function (geometry) {
                        geometry.computeVertexNormals();
                        var obj = new THREE.Mesh(geometry);
                        objects.push(obj);
                        scene.add(obj);
                    });
                    return;
                }
                default:
                    throw new Error("Unrecognized file type extension '" + ext + "' for file " + fileName);
            }
        }
        function updateObjects() {
            scene.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    var scale = scalarToVec(settings.object.scale);
                    child.scale.copy(scale);
                    child.material = material;
                    child.position.copy(settings.object.position);
                }
            });
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
            var fileName = file.name;
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
            stats.update();
        }
        // Updates scene objects, moves the camera, and draws the scene 
        function render() {
            updateObjects();
            updateScene();
            var timer = Date.now() * 0.0005;
            camera.position.x = Math.sin(timer) * 2.5;
            camera.position.z = Math.cos(timer) * 2.5;
            camera.lookAt(cameraTarget);
            renderer.render(scene, camera);
        }
    }
};
//# sourceMappingURL=index.js.map