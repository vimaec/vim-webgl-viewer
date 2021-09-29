
/*
Vim Viewer 
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
declare const THREE: any;
declare const Stats: any;

class Viewer
{
    canvas: HTMLCanvasElement;
    logo: HTMLElement;
    favicon: HTMLElement;

    stats: any;
    settings: any;
    camera: any; //PerspectiveCamera;
    renderer: any; // THREE.WebGLRenderer
    scene: any; // THREE.Scene
    meshes = [];

    plane: any; // THREE.Mesh
    sunlight: any; // THREE.HemisphereLight
    light1: any; // THREE.DirectionalLight
    light2: any; // THREE.DirectionalLight
    material: any; // THREE.MeshPhongMaterial
    removeListeners: Function;

    cameraController: ViewerCamera;
    controls: ViewerInput;
    vim: any;

    constructor()
    {
        this.meshes = [];

    }

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
        var loader = new THREE.VIMLoader();
        loader.load(
            fileName,
            (vim) => {
                console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
                console.timeEnd("loadingVim");
                onSuccess(vim);
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
        for (let i = 0; i < this.meshes.length; i++) {
            const mesh = this.meshes[i];
            const scale = scalarToVec(this.settings.object.scale);
            mesh.scale.copy(scale);
            mesh.position.copy(this.settings.object.position);
            mesh.rotation.copy(toEuler(this.settings.object.rotation));
        }
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

    //TODO: Add more granular ways to access the bim data.
    getElementNameFromNodeIndex(nodeIndex: number) {

        let elementIndex = this.vim.entities["Vim.Node"]["Rvt.Element"][nodeIndex];
        let stringIndex = this.vim.entities["Rvt.Element"]["Name"][elementIndex];
        let name = this.vim.strings[stringIndex];
        return name;
    }
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
