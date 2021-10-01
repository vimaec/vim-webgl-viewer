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
        raycaster.firstHitOnly = true;
        return raycaster.intersectObjects(this.viewer.meshes);
    };
    return ViewerInput;
}());
export { ViewerInput };
//# sourceMappingURL=viewer_input.js.map