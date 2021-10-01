import * as THREE from "./node_modules/three/src/Three";
export var direction = {
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
        this.camera.position.copy(toVec3(newSettings.camera.position));
        this.cameraTarget = toVec3(newSettings.camera.target);
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
export { ViewerCamera };
//Helpers
//TODO Remove this
function toVec3(obj) {
    return new THREE.Vector3(obj.x, obj.y, obj.z);
}
//# sourceMappingURL=viewer_camera.js.map