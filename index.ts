
/*
Vim Viewer 
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
declare const THREE: any;
declare const Stats: any;

const defaultOptions = {
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

const direction = {
    forward: new THREE.Vector3(0, 0, -1),
    back: new THREE.Vector3(0, 0, 1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
}


class Viewer
{
    canvas: HTMLElement;
    logo: HTMLElement;
    favicon: HTMLElement;

    stats: any;
    settings: any;
    camera: any; //PerspectiveCamera;
    renderer: any; // THREE.WebGLRenderer
    scene: any; // THREE.Scene
    objects = [];

    plane: any; // THREE.Mesh
    sunlight: any; // THREE.HemisphereLight
    light1: any; // THREE.DirectionalLight
    light2: any; // THREE.DirectionalLight
    material: any; // THREE.MeshPhongMaterial
    removeListeners: Function;

    cameraController: CameraController;

    constructor()
    {
        this.objects = [];

    }

    view(options)
    {
        this.settings = (new DeepMerge()).deepMerge(defaultOptions, options, undefined);

        //Init Canvas
        {
            // If a canvas is given, we will draw in it.
            let canvas = document.getElementById(this.settings.canvasId);

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
        this.cameraController = new CameraController(
            this.camera,
            this.settings
        );
        this.resizeCanvas(true);

        // Create scene object
        this.scene = new THREE.Scene();

        if (this.settings.showGui) {
            // Create a new DAT.gui controller 
            GuiBinder.bind(
                this.settings,
                settings => {
                    this.settings = settings;
                    this.updateScene();
                }
            );
        }

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

        // Add all of the appropriate mouse, touch-pad, and keyboard listeners
        this.removeListeners = this.addListeners();

        // Add Stats display 
        if (this.settings.showStats) {
            this.stats = new Stats();
            this.stats.dom.style.top = "84px";
            this.stats.dom.style.left = "16px";
            document.body.appendChild(this.stats.dom);
        }

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

        //Load Vim
        this.loadFile(this.settings.url);

        // Start Loop
        this.animate();
    }

    disconnect() {
        this.removeListeners();
        this.removeListeners = null;
    }

    loadFile(fileName) {

        function getExt(fileName) {
            const indexOfQueryParams = fileName.lastIndexOf("?");
            if (indexOfQueryParams >= 0)
                fileName = fileName.substring(0, indexOfQueryParams);
            const extPos = fileName.lastIndexOf(".");
            return fileName.slice(extPos + 1).toLowerCase();
        }

        console.log("Loading file: " + fileName);
        const ext = getExt(fileName);
        if (ext == "vim")
            this.loadVim(fileName);
        else
            console.error("unhandled file format");
    }

    loadVim(fileName) {
        console.log("Loading VIM");
        console.time("loadingVim");
        var loader = new THREE.VIMLoader();
        loader.load(
            fileName,
            (vim) =>
            {
                console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
                for (var i = 0; i < vim.meshes.length; ++i)
                {
                    this.objects.push(vim.meshes[i]);
                    this.scene.add(vim.meshes[i]);
                }
                this.addViews(vim.rooms);
                this.cameraController.lookAt(vim.box.getCenter(new THREE.Vector3()));
                console.log("Finished loading VIM geometries into scene");
                console.timeEnd("loadingVim");
            }
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
        this.scene.traverse(
            (child) =>
            {
                if (child.isMesh && child !== this.plane) {
                    //child.castShadow = true;
                    //child.receiveShadow = true;
                    const scale = scalarToVec(this.settings.object.scale);
                    child.scale.copy(scale);
                    child.position.copy(this.settings.object.position);
                    child.rotation.copy(toEuler(this.settings.object.rotation));
                }
            }
        );
    }

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
        const folder = GuiBinder.gui.addFolder('views');
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


    
    resizeCanvas(force: boolean = false) {
        if (!this.settings.autoResize && !force)
            return;

        const canvas = this.renderer.domElement;
        const parent = canvas.parentElement as Element;
        const w = parent.clientWidth / window.devicePixelRatio
        const h = parent.clientHeight / window.devicePixelRatio;
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
        this.sunlight.skyColor = toColor(this.settings.sunlight.skyColor);
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

    addListeners() {

        const keys = {
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

        const onKeyDown = (event) => {
            let speed = this.settings.camera.controls.speed;
            if (event.shiftKey)
                speed *= this.settings.camera.controls.shiftMultiplier;
            if (event.altKey)
                speed *= this.settings.camera.controls.altMultiplier;
            switch (event.keyCode) {
                case keys.A:
                    this.cameraController.moveCameraBy(direction.left, speed);
                    break;
                case keys.LEFTARROW:
                    this.cameraController.moveCameraBy(direction.left, speed, true);
                    break;
                case keys.D:
                    this.cameraController.moveCameraBy(direction.right, speed);
                    break;
                case keys.RIGHTARROW:
                    this.cameraController.moveCameraBy(direction.right, speed, true);
                    break;
                case keys.W:
                    this.cameraController.moveCameraBy(direction.forward, speed);
                    break;
                case keys.UPARROW:
                    this.cameraController.moveCameraBy(direction.forward, speed, true);
                    break;
                case keys.S:
                    this.cameraController.moveCameraBy(direction.back, speed);
                    break;
                case keys.DOWNARROW:
                    this.cameraController.moveCameraBy(direction.back, speed, true);
                    break;
                case keys.E:
                case keys.PAGEUP:
                    this.cameraController.moveCameraBy(direction.up, speed);
                    break;
                case keys.Q:
                case keys.PAGEDOWN:
                    this.cameraController.moveCameraBy(direction.down, speed);
                    break;
                case keys.HOME:
                    this.cameraController.resetCamera();
                    break;
                default:
                    return;
            }
            event.preventDefault();
        }

        const onMouseMove = (event) => {
            event.preventDefault();

            // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
            const deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const deltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            const delta = new THREE.Vector2(deltaX, deltaY);

            if (event.buttons & 2)
                this.cameraController.panCameraBy(delta);
            else
                this.cameraController.rotateCameraBy(delta);
        }

        const onMouseWheel = (event) =>
        {
            event.preventDefault();
            event.stopPropagation();
            const speed = this.settings.camera.controls.zoomSpeed;
            const dir = event.deltaY > 0 ? direction.back : direction.forward;
            this.cameraController.moveCameraBy(dir, speed);
        }

        const onMouseDown = (event) =>
        {
            event.preventDefault();
            this.canvas.addEventListener('mousemove', onMouseMove, false);
            this.canvas.addEventListener('mouseup', onMouseUp, false);
            // Manually set the focus since calling preventDefault above
            // prevents the browser from setting it automatically.    
            this.canvas.focus ? this.canvas.focus() : window.focus();
        }

        const onMouseUp = (event) => {
            this.canvas.removeEventListener('mousemove', onMouseMove, false);
            this.canvas.removeEventListener('mouseup', onMouseUp, false);
        }

        /*
        let touchStart = undefined; // When one touch occurs this is the value, when two or more touches occur it is the average of the first two. 
        let touchStart1 = undefined; // The first touch when multiple touches occur, otherwise left undefined
        let touchStart2 = undefined; // The second touch when multiple touches occur, otherwise left undefined

        function onTouchStart(event) {
            event.preventDefault(); // prevent scrolling
            if (!event || !event.touches || !event.touches.length) {
                return;
            }
            if (event.touches.length === 1) {
                touchStart = touchToVector(event.touches[0]);
                touchStart1 = touchStart2 = undefined;
            }
            else if (event.touches.length == 2) {
                touchStart1 = touchToVector(event.touches[0]);
                touchStart2 = touchToVector(event.touches[1]);
                touchStart = average(touchStart1, touchStart2);
            }
        }

        function onTouchMove(event) {
            if (!event || !event.touches || !event.touches.length) {
                return;
            }
            if (event.touches.length === 1) {
                const p = touchToVector(event.touches[0]);
                if (touchStart)
                    rotateCameraBy(p.clone().sub(touchStart));
                touchStart = p;
            }
            else
                if (event.touches.length > 1) {
                    const p1 = touchToVector(event.touches[0]);
                    const p2 = touchToVector(event.touches[1]);
                    const p = average(p1, p2)
                    //rotateBy(p.clone().sub(touchStart));                
                    touchDolly(p1, p2);
                    touchPan(p);
                    touchStart = p;
                    touchStart1 = p1;
                    touchStart2 = p2;
                }
        }

        function onTouchEnd(event) {
            touchStart = touchStart1 = touchStart2 = undefined;
        }

        function touchDolly(p1, p2) {
            if (!p1 || !p2 || !touchStart1 || !touchStart2)
                return;
            const prevDist = touchStart2.distanceTo(touchStart1);
            const dist = p1.distanceTo(p2);
            const amount = Math.pow(prevDist / dist, this.settings.camera.controls.zoomSpeed);
            if (Math.abs(amount - 1) > 0.0001) // only dolly if the movement exceeds an epsilon value.
            {
                const speed = this.settings.camera.controls.zoomSpeed;
                const dir = amount > 1 ? direction.back : direction.forward;
                moveCameraBy(dir, speed);
            }
        }

        function touchPan(p) {
            if (!p || !touchStart)
                return;
            panCameraBy(p.clone().sub(touchStart));
        }

        function touchToVector(touch) {
            return new THREE.Vector2(touch.pageX, touch.pageY);
        }

        function average(p1, p2) {
            return p1.clone().lerp(p2, 0.5);
        }
        */

        this.canvas.addEventListener('mousedown', onMouseDown);
        this.canvas.addEventListener('wheel', onMouseWheel);
        document.addEventListener('keydown', onKeyDown);

        //this.canvas.addEventListener('touchstart', onTouchStart, false);
        //this.canvas.addEventListener('touchend', onTouchEnd, false);
        //this.canvas.addEventListener('touchmove', onTouchMove, false);



        return () =>
        {
            this.canvas.removeEventListener('mousedown', onMouseDown);
            this.canvas.removeEventListener('wheel', onMouseWheel);
            document.removeEventListener('keydown', onKeyDown);
            this.canvas.removeEventListener('mousemove', onMouseMove, false);
            this.canvas.removeEventListener('mouseup', onMouseUp, false);

            //this.canvas.addEventListener('touchstart', onTouchStart, false);
            //this.canvas.addEventListener('touchend', onTouchEnd, false);
            //this.canvas.addEventListener('touchmove', onTouchMove, false);

        }
            
    }
}

class Controls {

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
