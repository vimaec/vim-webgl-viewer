import * as THREE from "./node_modules/three/src/Three";
import { DeepMerge } from "./deep_merge.js";
import { VIMLoader } from "./VIMLoader.js";
import { ViewerSettings } from "./viewer_settings.js";
import { ViewerCamera, direction } from "./viewer_camera.js";
//import { ViewerGui } from "./viewer_gui.js";
//import { Mesh } from "./node_modules/three/src/Three";
/*
Vim Viewer
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
//declare const Stats: any;
export var _1_45 = 145;
var Viewer = /** @class */ (function () {
    function Viewer() {
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
        /*
        if (this.settings.showGui) {
            // Create a new DAT.gui controller
            ViewerGui.bind(
                this.settings,
                settings => {
                    this.settings = settings;
                    this.updateScene();
                }
            );
        }
        */
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
        /*
        // Add Stats display
        if (this.settings.showStats) {
            this.stats = new Stats();
            this.stats.dom.style.top = "84px";
            this.stats.dom.style.left = "16px";
            document.body.appendChild(this.stats.dom);
        }
        */
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
        var loader = new VIMLoader();
        loader.load(fileName, function (vim) {
            console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
            console.timeEnd("loadingVim");
            onSuccess(vim);
        }, undefined, undefined);
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
        var material = new THREE.LineBasicMaterial({
            depthTest: false,
            opacity: 0.5,
            color: new THREE.Color(0x0000ff),
            transparent: true,
        });
        var line = new THREE.LineSegments(wireframe, material);
        this.scene.add(line);
        //returns disposer
        return function () {
            _this.scene.remove(line);
            wireframe.dispose();
            material.dispose();
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
    /*

    addViews(views) {
        const getSettingsMatrix = () => {
            return toMatrix(
                this.settings.object.position,
                this.settings.object.rotation,
                this.settings.object.scale
            );
        }

        if (!views || !views.length)
            return;
        const folder = ViewerGui.gui.addFolder('views');
        const obj = {};
        const matrix = getSettingsMatrix();
        for (let i = 0; i < views.length; ++i) {
            const view = views[i];
            const name = view.name;
            if (view.x == 0 && view.y == 0 && view.z == 0)
                continue;
            obj[name] = function () {
                console.log("Navigating to " + name);
                let pos = new THREE.Vector3(view.x, view.y, view.z + 5.5);
                pos.applyMatrix4(matrix);
                this.camera.position.copy(pos);
            };
            folder.add(obj, name);
        }
    }
    */
    Viewer.prototype.resizeCanvas = function (force) {
        if (force === void 0) { force = false; }
        if (!this.settings.autoResize && !force)
            return;
        var canvas = this.renderer.domElement;
        var parent = canvas.parentElement;
        var w = window.innerWidth / window.devicePixelRatio;
        var h = window.innerHeight / window.devicePixelRatio;
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
        //this.sunlight.skyColor = toColor(this.settings.sunlight.skyColor);
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
export { Viewer };
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
        //raycaster.firstHitOnly = true;
        return raycaster.intersectObjects(this.viewer.meshes);
    };
    return ViewerInput;
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
//# sourceMappingURL=viewer.js.map