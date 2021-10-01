export var ViewerSettings = {
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
//# sourceMappingURL=viewer_settings.js.map