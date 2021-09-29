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
var direction = {
    forward: new THREE.Vector3(0, 0, -1),
    back: new THREE.Vector3(0, 0, 1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
};
var ViewerCamera = /** @class */ (function () {
    function ViewerCamera(camera, settings) {
        this.camera = camera;
        this.applySettings(settings);
        // Save initial position
        this.initialPosition = new THREE.Vector3();
        this.initialRotation = new THREE.Quaternion();
        this.initialPosition.copy(this.camera.position);
        this.initialRotation.copy(this.camera.quaternion);
    }
    ViewerCamera.prototype.lookAt = function (position) { this.camera.lookAt(position); };
    ViewerCamera.prototype.applySettings = function (newSettings) {
        // TODO: camera updates aren't working
        this.camera.fov = newSettings.camera.fov;
        this.camera.zoom = newSettings.camera.zoom;
        this.camera.near = newSettings.camera.near;
        this.camera.far = newSettings.camera.far;
        this.camera.position.copy(toVec(newSettings.camera.position));
        this.cameraTarget = toVec(newSettings.camera.target);
        this.camera.lookAt(this.cameraTarget);
        this.settings = newSettings;
    };
    ViewerCamera.prototype.moveCameraBy = function (dir, speed, onlyHoriz) {
        if (dir === void 0) { dir = direction.forward; }
        if (speed === void 0) { speed = 1; }
        if (onlyHoriz === void 0) { onlyHoriz = false; }
        var vector = new THREE.Vector3();
        vector.copy(dir);
        if (speed)
            vector.multiplyScalar(speed);
        vector.applyQuaternion(this.camera.quaternion);
        var y = this.camera.position.y;
        this.camera.position.add(vector);
        if (onlyHoriz)
            this.camera.position.y = y;
    };
    ViewerCamera.prototype.panCameraBy = function (pt) {
        var speed = this.settings.camera.controls.panSpeed;
        this.moveCameraBy(new THREE.Vector3(-pt.x, pt.y, 0), speed);
    };
    ViewerCamera.prototype.rotateCameraBy = function (pt) {
        var euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        euler.y += -pt.x * this.settings.camera.controls.rotateSpeed;
        euler.x += -pt.y * this.settings.camera.controls.rotateSpeed;
        euler.z = 0;
        var PI_2 = Math.PI / 2;
        var minPolarAngle = -2 * Math.PI;
        var maxPolarAngle = 2 * Math.PI;
        euler.x = Math.max(PI_2 - maxPolarAngle, Math.min(PI_2 - minPolarAngle, euler.x));
        this.camera.quaternion.setFromEuler(euler);
    };
    ViewerCamera.prototype.resetCamera = function () {
        this.camera.position.copy(this.initialPosition);
        this.camera.quaternion.copy(this.initialRotation);
    };
    return ViewerCamera;
}());
var KEYS = {
    A: 65,
    D: 68,
    Q: 81,
    E: 69,
    S: 83,
    W: 87,
    LEFTARROW: 37,
    UPARROW: 38,
    RIGHTARROW: 39,
    DOWNARROW: 40,
    HOME: 36,
    END: 37,
    PAGEUP: 33,
    PAGEDOWN: 34,
};
var ViewerInput = /** @class */ (function () {
    function ViewerInput(canvas, settings, cameraController) {
        var _this = this;
        this.onKeyDown = function (event) {
            var speed = _this.settings.camera.controls.speed;
            if (event.shiftKey)
                speed *= _this.settings.camera.controls.shiftMultiplier;
            if (event.altKey)
                speed *= _this.settings.camera.controls.altMultiplier;
            switch (event.keyCode) {
                case KEYS.A:
                    _this.cameraController.moveCameraBy(direction.left, speed);
                    break;
                case KEYS.LEFTARROW:
                    _this.cameraController.moveCameraBy(direction.left, speed, true);
                    break;
                case KEYS.D:
                    _this.cameraController.moveCameraBy(direction.right, speed);
                    break;
                case KEYS.RIGHTARROW:
                    _this.cameraController.moveCameraBy(direction.right, speed, true);
                    break;
                case KEYS.W:
                    _this.cameraController.moveCameraBy(direction.forward, speed);
                    break;
                case KEYS.UPARROW:
                    _this.cameraController.moveCameraBy(direction.forward, speed, true);
                    break;
                case KEYS.S:
                    _this.cameraController.moveCameraBy(direction.back, speed);
                    break;
                case KEYS.DOWNARROW:
                    _this.cameraController.moveCameraBy(direction.back, speed, true);
                    break;
                case KEYS.E:
                case KEYS.PAGEUP:
                    _this.cameraController.moveCameraBy(direction.up, speed);
                    break;
                case KEYS.Q:
                case KEYS.PAGEDOWN:
                    _this.cameraController.moveCameraBy(direction.down, speed);
                    break;
                case KEYS.HOME:
                    _this.cameraController.resetCamera();
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };
        this.onMouseMove = function (event) {
            if (!_this.isMouseDown)
                return;
            event.preventDefault();
            // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
            var deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            var deltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            var delta = new THREE.Vector2(deltaX, deltaY);
            if (event.buttons & 2)
                _this.cameraController.panCameraBy(delta);
            else
                _this.cameraController.rotateCameraBy(delta);
        };
        this.onMouseWheel = function (event) {
            event.preventDefault();
            event.stopPropagation();
            var speed = _this.settings.camera.controls.zoomSpeed;
            var dir = event.deltaY > 0 ? direction.back : direction.forward;
            _this.cameraController.moveCameraBy(dir, speed);
        };
        this.onMouseDown = function (event) {
            var _a;
            event.preventDefault();
            _this.isMouseDown = true;
            var hits = _this.mouseRaycast(event.x, event.y);
            if (hits.length > 0) {
                var mesh = hits[0].object;
                var index = hits[0].instanceId;
                var nodeIndex = _this.viewer.getNodeIndex(mesh, index);
                var name_1 = _this.viewer.getElementNameFromNodeIndex(nodeIndex);
                (_a = _this.focusDisposer) === null || _a === void 0 ? void 0 : _a.call(_this);
                _this.focusDisposer = _this.viewer.focus(mesh, index);
                console.log("Raycast hit.");
                console.log("Position:" + hits[0].point.x + "," + hits[0].point.y + "," + hits[0].point.z);
                console.log("Element: " + name_1);
            }
            // Manually set the focus since calling preventDefault above
            // prevents the browser from setting it automatically.    
            _this.canvas.focus ? _this.canvas.focus() : window.focus();
        };
        this.onMouseUp = function (_) {
            _this.isMouseDown = false;
        };
        this.canvas = canvas;
        this.settings = settings;
        this.cameraController = cameraController;
        this.unregister = function () { };
        this.isMouseDown = false;
    }
    ViewerInput.prototype.register = function () {
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('wheel', this.onMouseWheel);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);
        this.unregister = function () {
            this.canvas.removeEventListener('mousedown', this.onMouseDown);
            this.canvas.removeEventListener('wheel', this.onMouseWheel);
            this.canvas.removeEventListener('mousemove', this.onMouseMove);
            this.canvas.removeEventListener('mouseup', this.onMouseUp);
            document.removeEventListener('keydown', this.onKeyDown);
            this.isMouseDown = false;
            this.unregister = function () { };
        };
    };
    ViewerInput.prototype.mouseRaycast = function (mouseX, mouseY) {
        var x = (mouseX / window.innerWidth) * 2 - 1;
        var y = -(mouseY / window.innerHeight) * 2 + 1;
        var mouse = new THREE.Vector2(x, y);
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.cameraController.camera);
        raycaster.firstHitOnly = true;
        return raycaster.intersectObjects(this.viewer.meshes);
    };
    return ViewerInput;
}());
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
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(PropValue.prototype, "value", {
        get: function () { return this._value; },
        set: function (value) { this._value = value; },
        enumerable: false,
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
        enumerable: false,
        configurable: true
    });
    PropList.prototype.find = function (name) {
        return this.items.find(function (v) { return v.name === name; });
    };
    return PropList;
}());
var ViewerGui = {
    gui: new dat.GUI(),
    bind: function (settings, callback) {
        // Create a property descriptor 
        var propDesc = objectToPropDesc(settings, {});
        // Create a property list from the descriptor 
        var props = new PropList(propDesc);
        // Iniitlaize the property list values             
        props.fromJson(settings);
        // Bind the properties to the DAT.gui controller, returning the scene when it updates
        bindControls(props, this.gui, function () { return callback(props.toJson); });
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
        // Fills out a dat.gui instance to a property list.
        function bindControls(list, gui, onChange) {
            for (var k in list.desc) {
                bindControl(list, k, gui, onChange);
            }
            return gui;
        }
        // Fills out a dat.gui control to a property in a property list.
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
    }
};
var ViewerSettings = {
    default: {
        showGui: true,
        showStats: true,
        camera: {
            near: 0.1,
            far: 15000,
            fov: 50,
            zoom: 1,
            rotate: 1.0,
            position: { x: 0, y: 5, z: -5 },
            target: { x: 0, y: -1, z: 0, },
            controls: {
                speed: 0.1,
                altMultiplier: 3.0,
                shiftMultiplier: 5.0,
                zoomSpeed: 0.2,
                rotateSpeed: 0.01,
                panSpeed: 0.1,
            }
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
    }
};
var Viewer = /** @class */ (function () {
    function Viewer() {
        this.meshes = [];
        this.meshes = [];
    }
    Viewer.prototype.view = function (options) {
        var _this = this;
        this.settings = (new DeepMerge()).deepMerge(ViewerSettings.default, options, undefined);
        //Init Canvas
        {
            // If a canvas is given, we will draw in it.
            var canvas = document.getElementById(this.settings.canvasId);
            // If no canvas is given, we create a new one
            if (!canvas) {
                canvas = document.createElement('canvas');
                document.body.appendChild(canvas);
            }
            this.canvas = canvas;
        }
        //Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Create the camera and size everything appropriately 
        this.camera = new THREE.PerspectiveCamera();
        this.cameraController = new ViewerCamera(this.camera, this.settings);
        this.resizeCanvas(true);
        // Create scene object
        this.scene = new THREE.Scene();
        if (this.settings.showGui) {
            // Create a new DAT.gui controller 
            ViewerGui.bind(this.settings, function (settings) {
                _this.settings = settings;
                _this.updateScene();
            });
        }
        // Ground
        this.plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000), new THREE.MeshPhongMaterial());
        this.plane.rotation.x = -Math.PI / 2;
        this.scene.add(this.plane);
        // Lights
        this.sunlight = new THREE.HemisphereLight();
        this.light1 = new THREE.DirectionalLight();
        this.light2 = new THREE.DirectionalLight();
        this.scene.add(this.sunlight);
        this.scene.add(this.light1);
        this.scene.add(this.light2);
        // Material 
        this.material = new THREE.MeshPhongMaterial();
        // Initial scene update: happens if controls change 
        this.updateScene();
        // Add Stats display 
        if (this.settings.showStats) {
            this.stats = new Stats();
            this.stats.dom.style.top = "84px";
            this.stats.dom.style.left = "16px";
            document.body.appendChild(this.stats.dom);
        }
        // Add Vim logo
        var logo = document.createElement("img");
        logo.src = "logo.png";
        logo.style.position = "fixed";
        logo.style.top = "16px";
        logo.style.left = "16px";
        logo.height = 48;
        logo.width = 128;
        document.body.prepend(logo);
        // Set Favicon
        var favicon = document.createElement('img');
        favicon.setAttribute('href', "favicon.ico");
        document.head.appendChild(favicon);
        // Add all of the appropriate mouse, touch-pad, and keyboard listeners
        //Load Vim
        this.loadFile(this.settings.url, function (vim) { return _this.onVimLoaded(vim); });
        // Start Loop
        this.animate();
    };
    Viewer.prototype.onVimLoaded = function (vim) {
        for (var i = 0; i < vim.meshes.length; ++i) {
            this.meshes.push(vim.meshes[i]);
            this.scene.add(vim.meshes[i]);
        }
        this.controls = new ViewerInput(this.canvas, this.settings, this.cameraController);
        this.controls.register();
        this.controls.viewer = this;
        this.vim = vim;
        vim.sphere.applyMatrix4(this.getViewMatrix());
        this.lookAtSphere(vim.sphere, true);
    };
    Viewer.prototype.loadFile = function (fileName, onSuccess) {
        function getExt(fileName) {
            var indexOfQueryParams = fileName.lastIndexOf("?");
            if (indexOfQueryParams >= 0)
                fileName = fileName.substring(0, indexOfQueryParams);
            var extPos = fileName.lastIndexOf(".");
            return fileName.slice(extPos + 1).toLowerCase();
        }
        console.log("Loading file: " + fileName);
        var ext = getExt(fileName);
        if (ext != "vim") {
            console.error("unhandled file format");
            return;
        }
        console.time("loadingVim");
        var loader = new THREE.VIMLoader();
        loader.load(fileName, function (vim) {
            console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
            console.timeEnd("loadingVim");
            onSuccess(vim);
        });
    };
    // Calls render, and asks the framework to prepare the next frame 
    Viewer.prototype.animate = function () {
        var _this = this;
        requestAnimationFrame(function () { return _this.animate(); });
        this.resizeCanvas();
        this.updateObjects();
        //cameraControls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.stats)
            this.stats.update();
    };
    Viewer.prototype.updateObjects = function () {
        for (var i = 0; i < this.meshes.length; i++) {
            this.applyViewMatrix(this.meshes[i]);
        }
    };
    Viewer.prototype.applyViewMatrix = function (mesh) {
        /*
        const scale = scalarToVec(this.settings.object.scale);
        mesh.scale.copy(scale);
        mesh.position.copy(this.settings.object.position);
        mesh.rotation.copy();
        */
        var matrix = this.getViewMatrix();
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
    };
    Viewer.prototype.getViewMatrix = function () {
        var pos = this.settings.object.position;
        var rot = toQuaternion(this.settings.object.rotation);
        var scl = scalarToVec(0.1);
        var matrix = new THREE.Matrix4().compose(pos, rot, scl);
        return matrix;
    };
    Viewer.prototype.highlight = function (geometry) {
        var _this = this;
        var wireframe = new THREE.WireframeGeometry(geometry);
        var line = new THREE.LineSegments(wireframe);
        line.material.depthTest = false;
        line.material.opacity = 0.5;
        line.material.color = new THREE.Color(0x0000ff);
        line.material.transparent = true;
        this.scene.add(line);
        return function () {
            _this.scene.remove(line);
            wireframe.dispose();
        };
    };
    Viewer.prototype.createWorldGeometry = function (mesh, index) {
        var geometry = mesh.geometry.clone();
        var matrix = new THREE.Matrix4();
        mesh.getMatrixAt(index, matrix);
        matrix = this.getViewMatrix().multiply(matrix);
        geometry.applyMatrix4(matrix);
        return geometry;
    };
    Viewer.prototype.lookAtSphere = function (sphere, setY) {
        if (setY === void 0) { setY = false; }
        if (setY)
            this.camera.position.setY(sphere.center.y);
        var axis = this.camera.position.clone().sub(sphere.center).normalize();
        var fovRadian = this.camera.fov * Math.PI / 180;
        var dist = 1.33 * sphere.radius * (1 + 2 / Math.tan(fovRadian));
        var pos = axis.clone().multiplyScalar(dist).add(sphere.center);
        this.camera.lookAt(sphere.center);
        this.camera.position.copy(pos);
    };
    Viewer.prototype.lookAtBox = function (box, setY) {
        if (setY === void 0) { setY = false; }
        this.lookAtSphere(box.getBoundingSphere(new THREE.Sphere()), setY);
    };
    Viewer.prototype.getNodeIndex = function (mesh, instance) {
        return mesh.userData.instanceIndices[instance];
    };
    Viewer.prototype.focus = function (mesh, index) {
        var geometry = this.createWorldGeometry(mesh, index);
        var disposer = this.highlight(geometry);
        geometry.computeBoundingSphere();
        var sphere = geometry.boundingSphere.clone();
        this.lookAtSphere(sphere);
        return function () {
            disposer();
            geometry.dispose();
        };
    };
    Viewer.prototype.addViews = function (views) {
        var _this = this;
        var getSettingsMatrix = function () {
            return toMatrix(_this.settings.object.position, _this.settings.object.rotation, _this.settings.object.scale);
        };
        if (!views || !views.length)
            return;
        var folder = ViewerGui.gui.addFolder('views');
        var obj = {};
        var matrix = getSettingsMatrix();
        var _loop_1 = function (i) {
            var view = views[i];
            var name_2 = view.name;
            if (view.x == 0 && view.y == 0 && view.z == 0)
                return "continue";
            obj[name_2] = function () {
                console.log("Navigating to " + name_2);
                var pos = new THREE.Vector3(view.x, view.y, view.z + 5.5);
                pos.applyMatrix4(matrix);
                this.camera.position.copy(pos);
            };
            folder.add(obj, name_2);
        };
        for (var i = 0; i < views.length; ++i) {
            _loop_1(i);
        }
    };
    Viewer.prototype.resizeCanvas = function (force) {
        if (force === void 0) { force = false; }
        if (!this.settings.autoResize && !force)
            return;
        var canvas = this.renderer.domElement;
        var parent = canvas.parentElement;
        var w = parent.clientWidth / window.devicePixelRatio;
        var h = parent.clientHeight / window.devicePixelRatio;
        this.renderer.setSize(w, h, false);
        // Set aspect ratio
        this.camera.aspect = canvas.width / canvas.height;
        this.camera.updateProjectionMatrix();
    };
    // Called every frame in case settings are updated 
    Viewer.prototype.updateScene = function () {
        this.scene.background = toColor(this.settings.background.color);
        this.plane.visible = this.settings.plane.show;
        this.updateMaterial(this.plane.material, this.settings.plane.material);
        this.plane.position.copy(toVec(this.settings.plane.position));
        this.light1.position.copy(toVec(this.settings.light1.position));
        this.light1.color = toColor(this.settings.light1.color);
        this.light1.intensity = this.settings.light1.intensity;
        this.light2.position.copy(toVec(this.settings.light2.position));
        this.light2.color = toColor(this.settings.light2.color);
        this.light2.intensity = this.settings.light2.intensity;
        this.sunlight.skyColor = toColor(this.settings.sunlight.skyColor);
        this.sunlight.groundColor = toColor(this.settings.sunlight.groundColor);
        this.sunlight.intensity = this.settings.sunlight.intensity;
        this.cameraController.applySettings(this.settings);
    };
    Viewer.prototype.updateMaterial = function (targetMaterial, settings) {
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
    };
    //TODO: Add more granular ways to access the bim data.
    Viewer.prototype.getElementNameFromNodeIndex = function (nodeIndex) {
        var elementIndex = this.vim.entities["Vim.Node"]["Rvt.Element"][nodeIndex];
        var stringIndex = this.vim.entities["Rvt.Element"]["Name"][elementIndex];
        var name = this.vim.strings[stringIndex];
        return name;
    };
    return Viewer;
}());
// Helpers
function isColor(obj) {
    return typeof (obj) === 'object' && 'r' in obj && 'g' in obj && 'b' in obj;
}
function toColor(c) {
    if (!isColor(c))
        throw new Error("Not a color");
    return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
}
function toVec(obj) {
    return new THREE.Vector3(obj.x, obj.y, obj.z);
}
function scalarToVec(x) {
    return new THREE.Vector3(x, x, x);
}
function toEuler(rot) {
    return new THREE.Euler(rot.x * Math.PI / 180, rot.y * Math.PI / 180, rot.z * Math.PI / 180);
}
function toQuaternion(rot) {
    var q = new THREE.Quaternion();
    q.setFromEuler(toEuler(rot));
    return q;
}
function toMatrix(pos, rot, scl) {
    var m = new THREE.Matrix4();
    m.compose(toVec(pos), toQuaternion(rot), scalarToVec(scl));
    return m;
}
//# sourceMappingURL=index.js.map