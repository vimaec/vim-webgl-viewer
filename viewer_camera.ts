const direction = {
    forward: new THREE.Vector3(0, 0, -1),
    back: new THREE.Vector3(0, 0, 1),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
}

class ViewerCamera {
    camera: any; //THREE.PerspectiveCamera()
    settings: any;
    initialPosition: any; //THREE.Vector3;
    initialRotation: any; //THREE.Quaternion;
    cameraTarget: any; //THREE.Vector3;

    constructor(camera, settings) {
        this.camera = camera;
        this.applySettings(settings);

        // Save initial position
        this.initialPosition = new THREE.Vector3();
        this.initialRotation = new THREE.Quaternion();
        this.initialPosition.copy(this.camera.position);
        this.initialRotation.copy(this.camera.quaternion);
    }

    lookAt(position) { this.camera.lookAt(position); }

    applySettings(newSettings) {
        // TODO: camera updates aren't working
        this.camera.fov = newSettings.camera.fov;
        this.camera.zoom = newSettings.camera.zoom;
        this.camera.near = newSettings.camera.near;
        this.camera.far = newSettings.camera.far;
        this.camera.position.copy(toVec(newSettings.camera.position));
        this.cameraTarget = toVec(newSettings.camera.target);
        this.camera.lookAt(this.cameraTarget);
        this.settings = newSettings;
    }

    moveCameraBy(dir = direction.forward, speed = 1, onlyHoriz = false) {
        let vector = new THREE.Vector3();
        vector.copy(dir);
        if (speed)
            vector.multiplyScalar(speed);
        vector.applyQuaternion(this.camera.quaternion);
        const y = this.camera.position.y;
        this.camera.position.add(vector);
        if (onlyHoriz)
            this.camera.position.y = y;
    }

    panCameraBy(pt) {
        const speed = this.settings.camera.controls.panSpeed;
        this.moveCameraBy(new THREE.Vector3(-pt.x, pt.y, 0), speed);
    }

    rotateCameraBy(pt) {
        let euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        euler.y += -pt.x * this.settings.camera.controls.rotateSpeed;
        euler.x += -pt.y * this.settings.camera.controls.rotateSpeed;
        euler.z = 0;
        const PI_2 = Math.PI / 2;
        const minPolarAngle = -2 * Math.PI;
        const maxPolarAngle = 2 * Math.PI;
        euler.x = Math.max(PI_2 - maxPolarAngle, Math.min(PI_2 - minPolarAngle, euler.x));
        this.camera.quaternion.setFromEuler(euler);
    }

    resetCamera() {
        this.camera.position.copy(this.initialPosition);
        this.camera.quaternion.copy(this.initialRotation);
    }
}
