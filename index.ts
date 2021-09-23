/*
Vim Viewer 
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/

declare const THREE: any;
declare const Stats: any;
declare const dat: any;
declare const CameraControls: any;
declare const DeepMerge: any;

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

// Main Vim Viewer code
const viewer = 
{
    view: function(options)
    {
        // Variables 
        let stats, gui, cameraControls;
        let camera, cameraTarget, scene, renderer, canvas, material, plane, sunlight, light1, light2, settings;
        let homePos, homeRot;
        let materialsLoaded = false;
        let objects = [];

        const defaultOptions = {
            showGui: false,
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
                    //child.castShadow = true;
                    //child.receiveShadow = true;
                    const scale = scalarToVec(settings.object.scale);
                    child.scale.copy( scale ); 
                    child.position.copy(settings.object.position);
                    child.rotation.copy(toEuler(settings.object.rotation));
                    if (!materialsLoaded) {
                        updateMaterial(material, settings.object.material);
                        child.material = material;
                    }
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

        // Scene initialization
        function init() 
        {
            // Initialize the settings 
            settings = (new DeepMerge()).deepMerge(defaultOptions, options, undefined);

            // If a canvas is given, we will draw in it.
            canvas = document.getElementById(settings.canvasId);

            // If no canvas is given, we create a new one
            if (!canvas) {
                canvas = document.createElement('canvas');
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
            } 

            // Ground            
            plane = new THREE.Mesh(
                new THREE.PlaneBufferGeometry(1000, 1000),
                new THREE.MeshPhongMaterial( )
            );
            plane.rotation.x = -Math.PI/2;
            //plane.receiveShadow = true;
            scene.add( plane );
    
            // Lights
            sunlight = new THREE.HemisphereLight();
            scene.add(sunlight);
            light1 = addLight(scene);
            light2 = addLight(scene);

            // Material 
            material = new THREE.MeshPhongMaterial( );

            // THREE JS renderer
            renderer.setPixelRatio( window.devicePixelRatio );            

            // Initial scene update: happens if controls change 
            updateScene();

            // Initial update of the camera
            updateCamera(); 

            // Get the initial position 
            homePos = new THREE.Vector3();
            homePos.copy(camera.position);
            homeRot = new THREE.Quaternion();
            homeRot.copy(camera.quaternion);

            // Add all of the appropriate mouse, touch-pad, and keyboard listeners
            addListeners();

            // Add Stats display 
            if (settings.showStats) {
                stats = new Stats();
                stats.dom.style.top = "84px";
                stats.dom.style.left = "16px";
                document.body.appendChild(stats.dom);
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
        }

        function resizeCanvas(force: boolean = false) {            
            if (!settings.autoResize && !force)
                return;

            const canvas = renderer.domElement;
            const parent = canvas.parentElement as Element;            
            const w = parent.clientWidth / window.devicePixelRatio 
            const h  = parent.clientHeight / window.devicePixelRatio;
            renderer.setSize(w, h, false);

            // Set aspect ratio
            camera.aspect = canvas.width / canvas.height;
            camera.updateProjectionMatrix();
        }

        function loadObject(obj) {
            objects.push(obj);
            scene.add(obj);
        }

        function getSettingsMatrix() {
            return toMatrix(settings.object.position, settings.object.rotation, settings.object.scale);
        }
        
        function addViews(views) {
            if (!views || !views.length)
                return;
            const folder = gui.addFolder('views');                
            const obj = {};
            const matrix = getSettingsMatrix();
            for (let i=0; i < views.length; ++i) {
                const view = views[i];
                const name = view.name;
                if (view.x == 0 && view.y == 0 && view.z == 0)
                    continue;
                obj[name] = function() { 
                    console.log("Navigating to " + name); 
                    let pos = new THREE.Vector3(view.x, view.y, view.z + 5.5);
                    pos.applyMatrix4(matrix);
                    camera.position.copy(pos);
                };
                folder.add(obj, name);
            }
        }

        function loadVim(fileName) {
            console.log("Loading VIM");
            console.time("loadingVim");

            const loader = new THREE.VIMLoader();
            loader.load(fileName, (vim) => {                       
                console.log("Finished loading VIM: found " + vim.meshes.length + " objects");
                materialsLoaded = true;
                for (let i=0; i < vim.meshes.length; ++i)                        
                    loadObject(vim.meshes[i]);
                addViews(vim.rooms);
                camera.lookAt(vim.box.getCenter(new THREE.Vector3()));
                console.log("Finished loading VIM geometries into scene");
                console.timeEnd("loadingVim");
            });
        }
        
        function getExt(fileName) {
            const indexOfQueryParams = fileName.lastIndexOf("?");
            if (indexOfQueryParams >= 0)
                fileName = fileName.substring(0, indexOfQueryParams);
            const extPos = fileName.lastIndexOf(".");
            return fileName.slice(extPos + 1).toLowerCase();
        }

        function loadIntoScene(fileName, mtlUrl) {     
            console.log("Loading object from " + fileName);
            console.time("Loading object");
            const ext = getExt(fileName);
            loadIntoSceneWithLoader(fileName, mtlUrl, ext);
        }

        function loadIntoSceneWithLoader(fileName, mtlUrl, ext) {     
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
                    if (mtlUrl) {                        
                        mtlLoader.load(mtlUrl, (mats) => {
                            mats.preload();
                            materialsLoaded = true;
                            objLoader.setMaterials(mats).load(fileName, loadObject);
                        }, null, () => {
                            console.warn("Failed to load material " + mtlUrl + " trying to load obj alone");
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
                case "vim": {
                    loadVim(fileName);
                    return;
                }
                default:
                    throw new Error("Unrecognized file type extension '" + ext + "' for file " + fileName);
            }
        }

        function addLight(scene) {
            const dirLight = new THREE.DirectionalLight();
            scene.add( dirLight );
            return dirLight;
        }        

        // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

        function dragOverHandler(ev) {
            console.log('File(s) in drop zone'); 

            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
        }

        function droppedFile(file) {
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
            resizeCanvas(); 
            updateObjects();
            //cameraControls.update();
            renderer.render( scene, camera );
            if (stats)
                stats.update();
        }

        // Listeners 

        function addListeners() {
            canvas.addEventListener('contextmenu', onContextMenu, false);
            canvas.addEventListener('mousedown', onMouseDown, false);
            canvas.addEventListener('wheel', onMouseWheel, false);
            canvas.addEventListener('touchstart', onTouchStart, false);
            canvas.addEventListener('touchend', onTouchEnd, false);
            canvas.addEventListener('touchmove', onTouchMove, false);
            document.addEventListener('keydown', onKeyDown, false);        
        }

        function onContextMenu(event) {
            console.log("Context menu");
        }

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

        const direction = {
            forward: new THREE.Vector3(0, 0, -1),
            back: new THREE.Vector3(0, 0, 1),
            left: new THREE.Vector3(-1, 0, 0),
            right: new THREE.Vector3(1, 0, 0),
            up: new THREE.Vector3(0, 1, 0),
            down: new THREE.Vector3(0, -1, 0),
        }

        function onKeyDown(event) {
            let speed = settings.camera.controls.speed;
            if (event.shiftKey)
                speed *= settings.camera.controls.shiftMultiplier;
            if (event.altKey)
                speed *= settings.camera.controls.altMultiplier;
            switch (event.keyCode) {
                case keys.A: 
                    moveCameraBy(direction.left, speed); 
                    break;
                case keys.LEFTARROW: 
                    moveCameraBy(direction.left, speed, true); 
                    break;
                case keys.D: 
                    moveCameraBy(direction.right, speed); 
                    break;
                case keys.RIGHTARROW: 
                    moveCameraBy(direction.right, speed, true); 
                    break;
                case keys.W: 
                    moveCameraBy(direction.forward, speed);
                    break;
                case keys.UPARROW: 
                    moveCameraBy(direction.forward, speed, true);
                    break;
                case keys.S: 
                    moveCameraBy(direction.back, speed); 
                    break;
                case keys.DOWNARROW: 
                    moveCameraBy(direction.back, speed, true); 
                    break;
                case keys.E: 
                case keys.PAGEUP: 
                    moveCameraBy(direction.up, speed); 
                    break;
                case keys.Q: 
                case keys.PAGEDOWN: 
                    moveCameraBy(direction.down, speed); 
                    break;
                case keys.HOME:
                    resetCamera();
                    break;
                default: 
                    return;
            }
            event.preventDefault();
        }                

        //==
        // Mouse controls
        //==

        function onMouseDown(event) {
            event.preventDefault();
            document.addEventListener('mousemove', onMouseMove, false);
            document.addEventListener('mouseup', onMouseUp, false);
            // Manually set the focus since calling preventDefault above
            // prevents the browser from setting it automatically.    
            canvas.focus ? canvas.focus() : window.focus();    
        }

        function onMouseUp(event) {
            document.removeEventListener('mousemove', onMouseMove, false);
            document.removeEventListener('mouseup', onMouseUp, false);
        }

        function onMouseMove(event) {
            event.preventDefault();

            // https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
            const deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const deltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;                
            const delta = new THREE.Vector2(deltaX, deltaY);

            if (event.buttons & 2)
                panCameraBy(delta);
            else
                rotateCameraBy(delta);
        }
    
        function onMouseWheel(event) {
            event.preventDefault();
            event.stopPropagation();
            const speed = settings.camera.controls.zoomSpeed;
            const dir = event.deltaY > 0 ? direction.back : direction.forward;
            moveCameraBy(dir, speed); 
        }
    
        //==
        // Touch controls
        //==

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
            const amount = Math.pow(prevDist / dist, settings.camera.controls.zoomSpeed);
            if (Math.abs(amount - 1) > 0.0001) // only dolly if the movement exceeds an epsilon value.
            {
                const speed = settings.camera.controls.zoomSpeed;
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

        //==
        // Camera control functions
        //==

        function moveCameraBy(dir = direction.forward, speed = 1, onlyHoriz = false) {
            let vector = new THREE.Vector3();
            vector.copy(dir);
            if (speed)
                vector.multiplyScalar(speed);  
            vector.applyQuaternion(camera.quaternion);
            const y = camera.position.y;
            camera.position.add(vector);
            if (onlyHoriz)
                camera.position.y = y;
        }

        function panCameraBy(pt) {
            const speed = settings.camera.controls.panSpeed;
            moveCameraBy(new THREE.Vector3(-pt.x, pt.y, 0), speed);
        }

        function rotateCameraBy(pt) {
            let euler = new THREE.Euler(0,0,0,'YXZ');
            euler.setFromQuaternion( camera.quaternion );
            euler.y += -pt.x * settings.camera.controls.rotateSpeed;
            euler.x += -pt.y * settings.camera.controls.rotateSpeed;
            euler.z = 0;
            const PI_2 = Math.PI/2;
            const minPolarAngle = -2*Math.PI;
            const maxPolarAngle = 2*Math.PI;
            euler.x = Math.max( PI_2 - maxPolarAngle, Math.min( PI_2 - minPolarAngle, euler.x ) );
            camera.quaternion.setFromEuler( euler );    
        }

        function resetCamera() {
            camera.position.copy(homePos);
            camera.quaternion.copy(homeRot);
        }
    }
}
