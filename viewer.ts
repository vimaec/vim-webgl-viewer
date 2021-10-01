import * as THREE from "./node_modules/three/src/Three";
import { DeepMerge } from "./deep_merge";
import { VIMLoader } from "./VIMLoader";
import { ViewerSettings } from "./viewer_settings";
import { ViewerCamera, direction } from "./viewer_camera";
//import { ViewerGui } from "./viewer_gui.js";

//import { Mesh } from "./node_modules/three/src/Three";

/*
Vim Viewer 
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/

//declare const Stats: any;
export class Viewer
{
    canvas: HTMLCanvasElement;
    logo: HTMLElement;
    favicon: HTMLElement;

    stats: any;
    settings: any;
    camera: THREE.PerspectiveCamera; //PerspectiveCamera;
    renderer: THREE.WebGLRenderer; // THREE.WebGLRenderer
    scene: THREE.Scene; // THREE.Scene
    meshes = [];

    plane: THREE.Mesh; // THREE.Mesh
    sunlight: THREE.HemisphereLight ; // THREE.HemisphereLight
    light1: THREE.DirectionalLight; // THREE.DirectionalLight
    light2: THREE.DirectionalLight; // THREE.DirectionalLight
    material: THREE.MeshPhongMaterial; // THREE.MeshPhongMaterial
    removeListeners: Function;

    cameraController: ViewerCamera;
    controls: ViewerInput;
    vim: any;

    view(options)
    {
        this.settings = (new DeepMerge()).deepMerge(ViewerSettings.default, options, undefined);

        //Init Canvas
        {
            // If a canvas is given, we will draw in it.
            let canvas = document.getElementById(this.settings.canvasId);

            // If no canvas is given, we create a new one
            if (!canvas) {
                canvas = document.createElement('canvas');
                document.body.appendChild(canvas);
            }
            this.canvas = canvas as HTMLCanvasElement;
        }

        //Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Create the camera and size everything appropriately 
        this.camera = new THREE.PerspectiveCamera();
        this.cameraController = new ViewerCamera(
            this.camera,
            this.settings
        );
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
        this.plane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(1000, 1000),
            new THREE.MeshPhongMaterial()
        );
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
        const logo = document.createElement("img");
        logo.src = "logo.png";
        logo.style.position = "fixed";
        logo.style.top = "16px";
        logo.style.left = "16px";
        logo.height = 48;
        logo.width = 128;
        document.body.prepend(logo);

        // Set Favicon
        const favicon = document.createElement('img');
        favicon.setAttribute('href', "favicon.ico");
        document.head.appendChild(favicon);

        // Add all of the appropriate mouse, touch-pad, and keyboard listeners
        //Load Vim
        this.loadFile(
            this.settings.url,
            vim => this.onVimLoaded(vim)
        );

        // Start Loop
        this.animate();
    }

    onVimLoaded(vim) {

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
    }

    loadFile(fileName, onSuccess : Function) {

        function getExt(fileName) {
            const indexOfQueryParams = fileName.lastIndexOf("?");
            if (indexOfQueryParams >= 0)
                fileName = fileName.substring(0, indexOfQueryParams);
            const extPos = fileName.lastIndexOf(".");
            return fileName.slice(extPos + 1).toLowerCase();
        }

        console.log("Loading file: " + fileName);
        const ext = getExt(fileName);
        if (ext != "vim") {
            console.error("unhandled file format");
            return;
        }

        console.time("loadingVim");
        var loader = new VIMLoader();
        loader.load(
            fileName,
            (vim) => {
                console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
                console.timeEnd("loadingVim");
                onSuccess(vim);
            },
            undefined,
            undefined
        );
    }

    // Calls render, and asks the framework to prepare the next frame 
    animate() {
        requestAnimationFrame(() => this.animate());
        this.resizeCanvas();
        this.updateObjects();
        //cameraControls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.stats)
            this.stats.update();
    }

    updateObjects() {
        for (let i = 0; i < this.meshes.length; i++) {
            this.applyViewMatrix(this.meshes[i])
        }
    }

    applyViewMatrix(mesh) {
        /*
        const scale = scalarToVec(this.settings.object.scale);
        mesh.scale.copy(scale);
        mesh.position.copy(this.settings.object.position);
        mesh.rotation.copy();
        */
        const matrix = this.getViewMatrix();
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
    }

    getViewMatrix() {
        const pos = this.settings.object.position;
        const rot = toQuaternion(this.settings.object.rotation);
        const scl = scalarToVec(0.1);
        const matrix = new THREE.Matrix4().compose(pos, rot, scl);
        return matrix;
    }

    
    highlight(geometry) : Function {
        const wireframe = new THREE.WireframeGeometry(geometry);
        const material = new THREE.LineBasicMaterial({
            depthTest : false,
            opacity : 0.5,
            color : new THREE.Color(0x0000ff),
            transparent : true,
        });
        const line = new THREE.LineSegments(wireframe, material);

        this.scene.add(line);

        //returns disposer
        return () => {
            this.scene.remove(line);
            wireframe.dispose();
            material.dispose();
        }
    }

    createWorldGeometry(mesh, index) {
        let geometry = mesh.geometry.clone();

        let matrix = new THREE.Matrix4();
        mesh.getMatrixAt(index, matrix);
        matrix = this.getViewMatrix().multiply(matrix);
        geometry.applyMatrix4(matrix);

        return geometry;
    }

    lookAtSphere(sphere, setY: boolean = false) {
        if(setY)
            this.camera.position.setY(sphere.center.y); 

        const axis = this.camera.position.clone().sub(sphere.center).normalize();
        const fovRadian = this.camera.fov * Math.PI / 180;
        const dist = 1.33 * sphere.radius * (1 + 2 / Math.tan(fovRadian));
        const pos = axis.clone().multiplyScalar(dist).add(sphere.center);

        this.camera.lookAt(sphere.center);
        this.camera.position.copy(pos);
    }

    lookAtBox(box, setY : boolean = false) {
        this.lookAtSphere(box.getBoundingSphere(new THREE.Sphere()), setY);
    }

    getNodeIndex(mesh, instance) {
        return mesh.userData.instanceIndices[instance];
    }

    focus(mesh, index) {
        const geometry = this.createWorldGeometry(mesh, index);
        const disposer = this.highlight(geometry);

        geometry.computeBoundingSphere();
        const sphere = geometry.boundingSphere.clone();
        this.lookAtSphere(sphere);

        return () => {
            disposer();
            geometry.dispose();
        }
    }

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

    resizeCanvas(force: boolean = false) {
        if (!this.settings.autoResize && !force)
            return;

        const canvas = this.renderer.domElement;
        const parent = canvas.parentElement as Element;
        const w = window.innerWidth/ window.devicePixelRatio
        const h = window.innerHeight / window.devicePixelRatio;
        this.renderer.setSize(w, h, false);

        // Set aspect ratio
        this.camera.aspect = canvas.width / canvas.height;
        this.camera.updateProjectionMatrix();
    }

        // Called every frame in case settings are updated 
    updateScene() {

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
    }

    updateMaterial(targetMaterial, settings) {
        if ('color' in settings) targetMaterial.color = toColor(settings.color);
        if ('flatShading' in settings) targetMaterial.flatShading = settings.flatShading;
        if ('emissive' in settings) targetMaterial.emissive = toColor(settings.emissive);
        if ('specular' in settings) targetMaterial.specular = toColor(settings.specular);
        if ('wireframe' in settings) targetMaterial.wireframe = settings.wireframe;
        if ('shininess' in settings) targetMaterial.shininess = settings.shininess;
    }

    //TODO: Add more granular ways to access the bim data.
    getElementNameFromNodeIndex(nodeIndex: number) {

        let elementIndex = this.vim.entities["Vim.Node"]["Rvt.Element"][nodeIndex];
        let stringIndex = this.vim.entities["Rvt.Element"]["Name"][elementIndex];
        let name = this.vim.strings[stringIndex];
        return name;
    }
}

const KEYS = {
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

class ViewerInput {

    canvas: HTMLCanvasElement;
    settings: any;
    cameraController: ViewerCamera;
    unregister: Function;
    isMouseDown: Boolean;

    // TODO figure out the right pattern for inputs
    viewer: Viewer;
    focusDisposer: Function;

    constructor(canvas: HTMLCanvasElement, settings: any, cameraController: ViewerCamera) {
        this.canvas = canvas;
        this.settings = settings;
        this.cameraController = cameraController;
        this.unregister = function () { };
        this.isMouseDown = false;
    }

    register() {
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
    }

    onKeyDown = (event) => {
        let speed = this.settings.camera.controls.speed;
        if (event.shiftKey)
            speed *= this.settings.camera.controls.shiftMultiplier;
        if (event.altKey)
            speed *= this.settings.camera.controls.altMultiplier;
        switch (event.keyCode) {
            case KEYS.A:
                this.cameraController.moveCameraBy(direction.left, speed);
                break;
            case KEYS.LEFTARROW:
                this.cameraController.moveCameraBy(direction.left, speed, true);
                break;
            case KEYS.D:
                this.cameraController.moveCameraBy(direction.right, speed);
                break;
            case KEYS.RIGHTARROW:
                this.cameraController.moveCameraBy(direction.right, speed, true);
                break;
            case KEYS.W:
                this.cameraController.moveCameraBy(direction.forward, speed);
                break;
            case KEYS.UPARROW:
                this.cameraController.moveCameraBy(direction.forward, speed, true);
                break;
            case KEYS.S:
                this.cameraController.moveCameraBy(direction.back, speed);
                break;
            case KEYS.DOWNARROW:
                this.cameraController.moveCameraBy(direction.back, speed, true);
                break;
            case KEYS.E:
            case KEYS.PAGEUP:
                this.cameraController.moveCameraBy(direction.up, speed);
                break;
            case KEYS.Q:
            case KEYS.PAGEDOWN:
                this.cameraController.moveCameraBy(direction.down, speed);
                break;
            case KEYS.HOME:
                this.cameraController.resetCamera();
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    onMouseMove = (event) => {
        if (!this.isMouseDown)
            return;

        event.preventDefault();

        // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
        const deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const deltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
        const delta = new THREE.Vector2(deltaX, deltaY);

        if (event.buttons & 2)
            this.cameraController.panCameraBy(delta);

        else
            this.cameraController.rotateCameraBy(delta);
    };

    onMouseWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const speed = this.settings.camera.controls.zoomSpeed;
        const dir = event.deltaY > 0 ? direction.back : direction.forward;
        this.cameraController.moveCameraBy(dir, speed);
    };


    onMouseDown = (event) => {
        event.preventDefault();
        this.isMouseDown = true;

        const hits = this.mouseRaycast(event.x, event.y);
        if (hits.length > 0) {
            const mesh = hits[0].object;
            const index = hits[0].instanceId;

            const nodeIndex = this.viewer.getNodeIndex(mesh, index);
            const name = this.viewer.getElementNameFromNodeIndex(nodeIndex);

            this.focusDisposer?.call(this);
            this.focusDisposer = this.viewer.focus(mesh, index);

            console.log("Raycast hit.")
            console.log("Position:" + hits[0].point.x + "," + hits[0].point.y + "," + hits[0].point.z);
            console.log("Element: " + name);
        }

        // Manually set the focus since calling preventDefault above
        // prevents the browser from setting it automatically.    
        this.canvas.focus ? this.canvas.focus() : window.focus();
    };

    mouseRaycast(mouseX, mouseY) {
        let x = (mouseX / window.innerWidth) * 2 - 1;
        let y = - (mouseY / window.innerHeight) * 2 + 1;
        let mouse = new THREE.Vector2(x, y);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.cameraController.camera);
        //raycaster.firstHitOnly = true;
        return raycaster.intersectObjects(this.viewer.meshes);
    }

    onMouseUp = (_) => {
        this.isMouseDown = false;
    };
}

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
    return new THREE.Vector3(obj.x, obj.y, obj.z)
}

function scalarToVec(x) {
    return new THREE.Vector3(x, x, x);
}

function toEuler(rot) {
    return new THREE.Euler(rot.x * Math.PI / 180, rot.y * Math.PI / 180, rot.z * Math.PI / 180)
}

function toQuaternion(rot) {
    const q = new THREE.Quaternion();
    q.setFromEuler(toEuler(rot));
    return q;
}

function toMatrix(pos, rot, scl) {
    const m = new THREE.Matrix4();
    m.compose(toVec(pos), toQuaternion(rot), scalarToVec(scl));
    return m;
}
