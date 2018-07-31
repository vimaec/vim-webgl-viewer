const ara = 
{
    view: function() 
    {
        if ( ! Detector.webgl ) {
            Detector.addGetWebGLMessage();
            return;
        }

        var container, stats;
        var camera, cameraTarget, scene, renderer;

        init();
        animate();

        function init() {
            container = document.createElement( 'div' );
            container.ondrop=dropHandler;
            container.ondragover=dragOverHandler;

            document.body.appendChild( container );
            camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 1, 15 );
            camera.position.set( 3, 0.15, 3 );
            cameraTarget = new THREE.Vector3( 0, -0.1, 0 );
            scene = new THREE.Scene();
            scene.background = new THREE.Color( 0x72645b );
            scene.fog = new THREE.Fog( 0x72645b, 2, 15 );

            // The orbit controls 
            const orbit = new THREE.OrbitControls( camera, container );

            // Ground
            var plane = new THREE.Mesh(
                new THREE.PlaneBufferGeometry( 40, 40 ),
                new THREE.MeshPhongMaterial( { color: 0x999999, specular: 0x101010 } )
            );
            plane.rotation.x = -Math.PI/2;
            plane.position.y = -0.5;
            scene.add( plane );
            plane.receiveShadow = true;
       
            // Lights
            scene.add( new THREE.HemisphereLight( 0x443333, 0x111122 ) );
            addShadowedLight( 1, 1, 1, 0xffffff, 1.35 );
            addShadowedLight( 0.5, 1, -1, 0xffaa00, 1 );

            // renderer
            renderer = new THREE.WebGLRenderer( { antialias: true } );
            renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( window.innerWidth, window.innerHeight );
            renderer.gammaInput = true;
            renderer.gammaOutput = true;
            renderer.shadowMap.enabled = true;
            container.appendChild( renderer.domElement );

            // stats
            stats = new Stats();
            container.appendChild( stats.dom );

            // resize
            window.addEventListener( 'resize', onWindowResize, false );
        }

        function addShadowedLight( x, y, z, color, intensity ) {
            var directionalLight = new THREE.DirectionalLight( color, intensity );
            directionalLight.position.set( x, y, z );
            scene.add( directionalLight );
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
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize( window.innerWidth, window.innerHeight );
        }

        function loadIntoScene(fileName, scene) {        
            const extPos = fileName.lastIndexOf(".");
            const ext = fileName.slice(extPos + 1).toLowerCase();
            
            // Used with PLY example
            const material = new THREE.MeshStandardMaterial( { color: 0x0055ff, flatShading: true } );

            // Used with STL example 
            //const material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
            // TODO: add materials to all objects.
            // TODO: pros-process all geometry types 

            switch (ext) {
                case "3ds": {
                    const loader = new THREE.TDSLoader();
                    loader.load(fileName, (obj) => scene.add(obj));
                    return;
                }
                case "fbx": {
                    const loader = new THREE.FBXLoader();
                    loader.load(fileName, (obj) => scene.add(obj));
                    return;
                }
                case "dae":  {
                    const loader = new THREE.ColladaLoader();
                    loader.load(fileName, (obj) => scene.add(obj));
                    return;
                }
                case "gltf": {
                    const loader = new THREE.GLTFLoader();
                    loader.load(fileName, (gltf) => scene.add( gltf.scene ));
                    return;
                }
                case "gcode": {
                    const loader = new THREE.GCodeLoader();
                    loader.load(fileName, (obj) => scene.add(obj));
                    return;
                }
                case "obj": {
                    const loader = new THREE.ObjLoader();
                    loader.load(fileName, (obj) => scene.add(obj));
                    return;
                }
                case "pcd": {
                    const loader = new THREE.PCDLoader();
                    loader.load(fileName, (obj) => scene.add(obj));
                    return;
                }
                case "ply": {
                    const loader = new THREE.PLYLoader();
                    loader.load(fileName, ( geometry ) => {
                        geometry.computeVertexNormals();
                        var mesh = new THREE.Mesh( geometry, material );
                        mesh.position.y = - 0.2;
                        mesh.position.z =   0.3;
                        mesh.rotation.x = - Math.PI / 2;
                        if (!fileName.endsWith('dragon.ply')) 
                            mesh.scale.multiplyScalar( 0.001 );
                        else
                        mesh.scale.multiplyScalar( 10.0 );
                        mesh.receiveShadow = true;
                        mesh.castShadow = true;
                        scene.add( mesh );
                    });
                    return;
                }
                case "stl": {
                    const loader =  new THREE.STLLoader();
                    loader.load(fileName, ( geometry ) => {
                        geometry.computeVertexNormals();
                        var mesh = new THREE.Mesh( geometry, material );
                        mesh.position.y = - 0.2;
                        mesh.position.z =   0.3;
                        mesh.rotation.x = - Math.PI / 2;
                        mesh.scale.multiplyScalar( 0.01 );
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        scene.add( mesh );
                    });
                    return;
                }
            }
        }

        function postProcess(scene) {
            scene.traverse( function ( child ) {
                if ( child.isMesh ) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            } );
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

        function dragOverHandler(ev) {
            console.log('File(s) in drop zone'); 

            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
        }

        function droppedFile(file) {
            // TODO: deal with other data ... 
            const fileName = file.name;
            loadIntoScene("../data/" + fileName, scene);    
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

        function animate() {
            requestAnimationFrame( animate );
            render();
            stats.update();
        }

        function render() {
            var timer = Date.now() * 0.0005;
            camera.position.x = Math.sin( timer ) * 2.5;
            camera.position.z = Math.cos( timer ) * 2.5;
            camera.lookAt( cameraTarget );
            renderer.render( scene, camera );
        }
    }
}