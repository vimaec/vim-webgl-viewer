/*
Vim Viewer 
Copyright VIMaec LLC, 2020
Licensed under the terms of the MIT License
*/
declare const THREE: any;
declare const Stats: any;

// Main Vim Viewer code
const viewer = 
{
    view: function(options)
    {
        // Variables 
        let stats, gui;
        let camera, cameraTarget, scene, renderer, canvas, material, plane, sunlight, light1, light2, settings;
        let homePos, homeRot;
        let materialsLoaded = false;
        let objects = [];

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
        loadFile(settings.url);
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

            if (settings.showGui) {
                // Create a new DAT.gui controller 
                GuiBinder.bind(
                    settings,
                    props => {
                        settings = props.toJson;
                        updateScene();
                    }
                );         
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

        function loadFile(fileName) {     
            console.log("Loading file: " + fileName);
            const ext = getExt(fileName);
            if (ext == "vim")
                loadVim(fileName);
            else
                console.error("unhandled file format");
        }

        function addLight(scene) {
            const dirLight = new THREE.DirectionalLight();
            scene.add( dirLight );
            return dirLight;
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
