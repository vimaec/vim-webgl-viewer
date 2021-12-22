declare module "vim-webgl-viewer/viewerSettings" {
    /**
     @author VIM / https://vimaec.com
    */
    import * as THREE from 'three';
    export type Vector3 = {
        x: number;
        y: number;
        z: number;
    };
    export type ColorRGB = {
        r: number;
        g: number;
        b: number;
    };
    export type ColorHSL = {
        h: number;
        s: number;
        l: number;
    };
    /**
     * Plane under model related options
     */
    export type PlaneOptions = {
        /** Enables/Disables plane under model */
        show: boolean;
        /** Local or remote texture url for plane */
        texture: string;
        /** Opacity of the plane */
        opacity: number;
        /** Color of the plane */
        color: ColorRGB;
        /** Actual size is ModelRadius*size */
        size: number;
    };
    /** Dom canvas related options */
    export type CanvasOptions = {
        /** Canvas dom model id. If none provided a new canvas will be created */
        id: string;
        /** Limits how often canvas will be resized if window is resized. */
        resizeDelay: number;
    };
    /** Camera controls related options */
    export type CameraControlsOptions = {
        /**
         * <p>Set true to start in orbit mode.</p>
         * <p>Camera has two modes: First person and orbit</p>
         * <p>First person allows to moves the camera around freely</p>
         * <p>Orbit rotates the camera around a focus point</p>
         */
        orbit: boolean;
        /** Camera speed is scaled according to modelRadius/modelReferenceSize */
        modelReferenceSize: number;
        /** Camera rotation speed factor */
        rotateSpeed: number;
        /** Camera movement speed factor */
        moveSpeed: number;
    };
    /** Camera related options */
    export type CameraOptions = {
        /** Near clipping plane distance */
        near: number;
        /** Far clipping plane distance */
        far: number;
        /** Fov angle in degrees */
        fov: number;
        /** Zoom level */
        zoom: number;
        /** See ControlOptions */
        controls: Partial<CameraControlsOptions>;
    };
    export type SunLightOptions = {
        position: Vector3;
        color: ColorHSL;
        intensity: number;
    };
    export type SkyLightOptions = {
        skyColor: ColorHSL;
        groundColor: ColorHSL;
        intensity: number;
    };
    /** Viewer related options independant from models */
    export type ViewerOptions = {
        /**
         * Webgl canvas related options
         */
        canvas: Partial<CanvasOptions>;
        /**
         * Three.js camera related options
         */
        camera: Partial<CameraOptions>;
        /**
         * Plane under model related options
         */
        plane: Partial<PlaneOptions>;
        /**
         * Skylight (hemisphere light) options
         */
        skylight: Partial<SkyLightOptions>;
        /**
         * Sunlight (directional light) options
         */
        sunLight: Partial<SunLightOptions>;
    };
    /**
     * Config object for loading a model
     */
    export type ModelOptions = {
        /**
         * Local or remote url of model to load
         */
        url: string;
        /**
         * Position offset for the model
         */
        position: Vector3;
        /**
         * Rotation for the model
         */
        rotation: Vector3;
        /**
         * Scale factor for the model
         */
        scale: number;
    };
    /**
     * <p>Wrapper around Model Options.</p>
     * <p>Casts options values into related THREE.js type</p>
     * <p>Provides default values for options</p>
     */
    export class ModelSettings {
        private options;
        constructor(options: Partial<ModelOptions>);
        getURL: () => string;
        getObjectPosition: () => THREE.Vector3;
        getObjectRotation: () => THREE.Quaternion;
        getObjectScale: () => THREE.Vector3;
        getObjectMatrix: () => THREE.Matrix4;
    }
    /**
     * <p>Wrapper around Viewer Options</p>
     * <p>Casts options values into related THREE.js type</p>
     * <p>Provides default values for options</p>
     */
    export class ViewerSettings {
        private options;
        constructor(options: Partial<ViewerOptions>);
        getCanvasResizeDelay: () => number;
        getCanvasId: () => string;
        getPlaneShow: () => boolean;
        getPlaneColor: () => THREE.Color;
        getPlaneTextureUrl: () => string;
        getPlaneOpacity: () => number;
        getPlaneSize: () => number;
        getSkylightColor: () => THREE.Color;
        getSkylightGroundColor: () => THREE.Color;
        getSkylightIntensity: () => number;
        getSunlightColor: () => THREE.Color;
        getSunlightPosition: () => THREE.Vector3;
        getSunlightIntensity: () => number;
        getCameraNear: () => number;
        getCameraFar: () => number;
        getCameraFov: () => number;
        getCameraZoom: () => number;
        getCameraIsOrbit: () => boolean;
        getCameraMoveSpeed: () => number;
        getCameraRotateSpeed: () => number;
        getCameraReferenceModelSize: () => number;
    }
}
declare module "vim-webgl-viewer/viewerRenderer" {
    import * as THREE from 'three';
    import { ViewerSettings } from "vim-webgl-viewer/viewerSettings";
    export class ViewerRenderer {
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        scene: THREE.Scene;
        clock: THREE.Clock;
        canvas: HTMLCanvasElement;
        boundingBox: THREE.Box3;
        meshes: THREE.Object3D[];
        constructor(canvas: HTMLCanvasElement, settings: ViewerSettings);
        /**
         * Set a callback for canvas resize with debouncing
         * https://stackoverflow.com/questions/5825447/javascript-event-for-canvas-resize/30688151
         * @param callback code to be called
         * @param timeout time after the last resize before code will be called
         */
        setOnResize(callback: any, timeout: any): void;
        getBoundingSphere(): THREE.Sphere;
        render(): void;
        getContainerSize(): [width: number, height: number];
        fitToCanvas: () => void;
        addToScene(mesh: THREE.Object3D): void;
        remove(mesh: THREE.Object3D): void;
        addManyToScene(meshes: THREE.Object3D[]): void;
        addToModel(meshes: THREE.Object3D[]): void;
        updateModel(matrix: THREE.Matrix4): void;
        computeBoundingBox(matrix: THREE.Matrix4): void;
        _computeBoundingBox(scene: THREE.Scene): THREE.Box3;
    }
}
declare module "vim-webgl-viewer/CameraGizmo" {
    import * as THREE from 'three';
    import { ViewerRenderer } from "vim-webgl-viewer/viewerRenderer";
    import { ViewerCamera } from "vim-webgl-viewer/viewerCamera";
    import { ViewerSettings } from "vim-webgl-viewer/viewerSettings";
    export class CameraGizmo {
        camera: ViewerCamera;
        render: ViewerRenderer;
        scale: number;
        box: THREE.BufferGeometry;
        wireframe: THREE.BufferGeometry;
        material: THREE.Material;
        materialAlways: THREE.Material;
        gizmos: THREE.Group;
        timeout: number;
        constructor(camera: ViewerCamera, render: ViewerRenderer);
        show(): void;
        update(position: THREE.Vector3): void;
        applySettings(settings: ViewerSettings, factor: number): void;
        setScale(scale?: number): void;
        createGizmo(): void;
        dispose(): void;
    }
}
declare module "vim-webgl-viewer/viewerCamera" {
    /**
     @author VIM / https://vimaec.com
    */
    import * as THREE from 'three';
    import { CameraGizmo } from "vim-webgl-viewer/CameraGizmo";
    import { ViewerRenderer } from "vim-webgl-viewer/viewerRenderer";
    import { ViewerSettings } from "vim-webgl-viewer/viewerSettings";
    const direction: {
        forward: THREE.Vector3;
        back: THREE.Vector3;
        left: THREE.Vector3;
        right: THREE.Vector3;
        up: THREE.Vector3;
        down: THREE.Vector3;
    };
    class ViewerCamera {
        gizmo: CameraGizmo;
        private MinOrbitalDistance;
        camera: THREE.PerspectiveCamera;
        private InputVelocity;
        private Velocity;
        private Impulse;
        SpeedMultiplier: number;
        OrbitalTarget: THREE.Vector3;
        CurrentOrbitalDistance: number;
        TargetOrbitalDistance: number;
        MouseOrbit: Boolean;
        private VelocityBlendFactor;
        private ModelSizeMultiplier;
        private MoveSpeed;
        private RotateSpeed;
        constructor(render: ViewerRenderer, settings: ViewerSettings);
        lookAt(position: THREE.Vector3): void;
        lookAtSphere(sphere: THREE.Sphere, setY?: boolean): void;
        frameScene(sphere: THREE.Sphere): void;
        applySettings(newSettings: ViewerSettings, modelSphere?: THREE.Sphere): void;
        applyLocalImpulse(impulse: THREE.Vector3): void;
        moveCameraBy(dir: THREE.Vector3, speed: number): void;
        truckPedestalCameraBy(pt: THREE.Vector2): void;
        dollyCameraBy(amount: number): void;
        setCameraLocalVelocity(vector: THREE.Vector3): void;
        rotateCameraBy(pt: THREE.Vector2): void;
        getSpeedMultiplier(): number;
        updateOrbitalDistance(diff: number): void;
        frameUpdate(deltaTime: number): void;
        isSignificant(vector: THREE.Vector3): boolean;
    }
    export { direction, ViewerCamera };
}
declare module "vim-webgl-viewer/inputMouse" {
    import * as THREE from 'three';
    import { ViewerCamera } from "vim-webgl-viewer/viewerCamera";
    import { Viewer } from "vim-webgl-viewer/viewer";
    import { Mesh, Vector2 } from 'three';
    import { ViewerRenderer } from "vim-webgl-viewer/viewerRenderer";
    type RaycastResult = [mesh: Mesh, index: number] | number | null;
    export class InputMouse {
        private camera;
        private renderer;
        private viewer;
        private isMouseDown;
        private hasMouseMoved;
        private ctrlDown;
        constructor(camera: ViewerCamera, renderer: ViewerRenderer, viewer: Viewer);
        reset: () => void;
        setCtrl: (value: Boolean) => void;
        onMouseOut: (_: any) => void;
        onMouseMove: (event: any) => void;
        onMouseWheel: (event: any) => void;
        onMouseDown: (event: any) => void;
        onMouseUp: (event: any) => void;
        onDoubleClick: (event: any) => void;
        onMouseClick: (position: Vector2, double: boolean) => void;
        mouseRaycast(position: THREE.Vector2): THREE.Intersection<THREE.Object3D<THREE.Event>>[];
        findHitMeshIndex(hits: THREE.Intersection<THREE.Object3D<THREE.Event>>[]): RaycastResult;
        getElementIndex(raycast: RaycastResult): [elementIndex: number, error: string];
    }
}
declare module "vim-webgl-viewer/inputKeyboard" {
    import { ViewerCamera } from "vim-webgl-viewer/viewerCamera";
    import { CameraGizmo } from "vim-webgl-viewer/CameraGizmo";
    import { Viewer } from "vim-webgl-viewer/viewer";
    import { InputMouse } from "vim-webgl-viewer/inputMouse";
    export const KEYS: {
        KEY_0: number;
        KEY_1: number;
        KEY_2: number;
        KEY_3: number;
        KEY_4: number;
        KEY_5: number;
        KEY_6: number;
        KEY_7: number;
        KEY_8: number;
        KEY_9: number;
        KEY_LEFT: number;
        KEY_RIGHT: number;
        KEY_UP: number;
        KEY_DOWN: number;
        KEY_CTRL: number;
        KEY_SHIFT: number;
        KEY_ENTER: number;
        KEY_SPACE: number;
        KEY_TAB: number;
        KEY_ESCAPE: number;
        KEY_BACKSPACE: number;
        KEY_HOME: number;
        KEY_END: number;
        KEY_INSERT: number;
        KEY_DELETE: number;
        KEY_ALT: number;
        KEY_F1: number;
        KEY_F2: number;
        KEY_F3: number;
        KEY_F4: number;
        KEY_F5: number;
        KEY_F6: number;
        KEY_F7: number;
        KEY_F8: number;
        KEY_F9: number;
        KEY_F10: number;
        KEY_F11: number;
        KEY_F12: number;
        KEY_NUMPAD0: number;
        KEY_NUMPAD1: number;
        KEY_NUMPAD2: number;
        KEY_NUMPAD3: number;
        KEY_NUMPAD4: number;
        KEY_NUMPAD5: number;
        KEY_NUMPAD6: number;
        KEY_NUMPAD7: number;
        KEY_NUMPAD8: number;
        KEY_NUMPAD9: number;
        KEY_ADD: number;
        KEY_SUBTRACT: number;
        KEY_MULTIPLY: number;
        KEY_DIVIDE: number;
        KEY_SEPARATOR: number;
        KEY_DECIMAL: number;
        KEY_OEM_PLUS: number;
        KEY_OEM_MINUS: number;
        KEY_A: number;
        KEY_B: number;
        KEY_C: number;
        KEY_D: number;
        KEY_E: number;
        KEY_F: number;
        KEY_G: number;
        KEY_H: number;
        KEY_I: number;
        KEY_J: number;
        KEY_K: number;
        KEY_L: number;
        KEY_M: number;
        KEY_N: number;
        KEY_O: number;
        KEY_P: number;
        KEY_Q: number;
        KEY_R: number;
        KEY_S: number;
        KEY_T: number;
        KEY_U: number;
        KEY_V: number;
        KEY_W: number;
        KEY_X: number;
        KEY_Y: number;
        KEY_Z: number;
    };
    export class InputKeyboard {
        ShiftMultiplier: number;
        camera: ViewerCamera;
        viewer: Viewer;
        mouse: InputMouse;
        gizmo: CameraGizmo;
        isShftPressed: boolean;
        isUpPressed: boolean;
        isDownPressed: boolean;
        isLeftPressed: boolean;
        isRightPressed: boolean;
        isEPressed: boolean;
        isQPressed: boolean;
        constructor(camera: ViewerCamera, viewer: Viewer, mouse: InputMouse);
        reset: () => void;
        onKeyUp: (event: any) => void;
        onKeyDown: (event: any) => void;
        onKey: (event: any, keyDown: boolean) => void;
        applyMove: () => void;
    }
}
declare module "vim-webgl-viewer/inputTouch" {
    import * as THREE from 'three';
    import { ViewerCamera } from "vim-webgl-viewer/viewerCamera";
    import { InputMouse } from "vim-webgl-viewer/inputMouse";
    import { ViewerRenderer } from "vim-webgl-viewer/viewerRenderer";
    export class InputTouch {
        TapDurationMs: number;
        private camera;
        private renderer;
        private mouse;
        private touchStart;
        private touchStart1;
        private touchStart2;
        private touchStartTime;
        constructor(camera: ViewerCamera, renderer: ViewerRenderer, mouse: InputMouse);
        reset: () => void;
        onTap: (position: THREE.Vector2) => void;
        onTouchStart: (event: any) => void;
        onDrag: (delta: THREE.Vector2) => void;
        onDoubleDrag: (delta: THREE.Vector2) => void;
        onPinchOrSpread: (delta: number) => void;
        onTouchMove: (event: any) => void;
        onTouchEnd: (_: any) => void;
        private isSingleTouch;
        touchToVector(touch: any): THREE.Vector2;
        average(p1: THREE.Vector2, p2: THREE.Vector2): THREE.Vector2;
    }
}
declare module "vim-webgl-viewer/viewerInput" {
    import { Viewer } from "vim-webgl-viewer/viewer";
    import { ViewerCamera } from "vim-webgl-viewer/viewerCamera";
    import { ViewerRenderer } from "vim-webgl-viewer/viewerRenderer";
    export class ViewerInput {
        private canvas;
        private unregisters;
        private touch;
        private mouse;
        private keyboard;
        constructor(renderer: ViewerRenderer, camera: ViewerCamera, viewer: Viewer);
        private reg;
        register(): void;
        unregister: () => void;
        reset(): void;
    }
}
declare module "vim-loader/g3d" {
    class AttributeDescriptor {
        description: string;
        association: string;
        semantic: string;
        attributeTypeIndex: string;
        dataType: string;
        dataArity: number;
        constructor(description: string, association: string, semantic: string, attributeTypeIndex: string, dataType: string, dataArity: string);
        static fromString(descriptor: string): AttributeDescriptor;
        matches(other: AttributeDescriptor): boolean;
    }
    class Attribute {
        descriptor: AttributeDescriptor;
        bytes: Uint8Array;
        data: Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array;
        constructor(descriptor: AttributeDescriptor, bytes: Uint8Array);
        static fromString(descriptor: string, buffer: Uint8Array): Attribute;
        static castData(bytes: Uint8Array, dataType: string): Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array;
    }
    class G3d {
        meta: string;
        attributes: Attribute[];
        constructor(meta: string, attributes: Attribute[]);
        findAttribute(descriptor: string): Attribute | null;
    }
    class VimG3d {
        positions: Float32Array;
        indices: Int32Array;
        instanceMeshes: Int32Array;
        instanceTransforms: Float32Array;
        meshSubmeshes: Int32Array;
        submeshIndexOffset: Int32Array;
        submeshMaterial: Int32Array;
        materialColors: Float32Array;
        rawG3d: G3d;
        matrixArity: number;
        colorArity: number;
        positionArity: number;
        constructor(g3d: G3d);
        getInstanceCount: () => number;
        getMeshCount: () => number;
        getMeshSubmeshRange(mesh: number): [number, number];
        getSubmeshIndexRange(submesh: number): [number, number];
        getTransformMatrixAsArray(tranformIndex: number): Float32Array;
        getMeshReferenceCounts: () => Int32Array;
        getNodesByMeshes: () => number[][];
        validate(): void;
    }
    export { VimG3d, G3d, Attribute, AttributeDescriptor };
}
declare module "vim-loader/bfast" {
    class BFastHeader {
        magic: number;
        dataStart: number;
        dataEnd: number;
        numArrays: number;
        constructor(magic: number, dataStart: number, dataEnd: number, numArrays: number, byteLength: number);
        static fromArray(array: Int32Array, byteLength: number): BFastHeader;
    }
    class BFast {
        header: BFastHeader;
        names: string[];
        buffers: Uint8Array[];
        constructor(header: BFastHeader, names: string[], buffers: Uint8Array[]);
    }
    export { BFastHeader, BFast };
}
declare module "vim-loader/vim" {
    import { BFast } from "vim-loader/bfast";
    import { VimG3d } from "vim-loader/g3d";
    export class Vim {
        static tableElement: string;
        static tableElementLegacy: string;
        static tableNode: string;
        header: string;
        assets: BFast;
        g3d: VimG3d;
        bim: any;
        strings: string[];
        constructor(header: string, assets: BFast, g3d: VimG3d, entities: any, strings: string[]);
    }
}
declare module "vim-loader/vimSceneGeometry" {
    import * as THREE from 'three';
    export class VimSceneGeometry {
        meshes: THREE.Mesh[];
        boundingBox: THREE.Box3;
        nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>;
        meshIdToNodeIndex: Map<number, number[]>;
        constructor(meshes: THREE.Mesh[], boundingBox: THREE.Box3, nodeIndexToMeshInstance: Map<number, [THREE.Mesh, number]>, meshIdToNodeIndex: Map<number, number[]>);
        getMeshCount(): number;
        addMesh(mesh: THREE.Mesh, nodes: number[]): void;
    }
}
declare module "vim-loader/vimScene" {
    import * as THREE from 'three';
    import { BufferGeometryBuilder } from "vim-loader/VIMLoader";
    import { Vim } from "vim-loader/vim";
    import { VimSceneGeometry } from "vim-loader/vimSceneGeometry";
    export class VimScene {
        vim: Vim;
        geometry: VimSceneGeometry;
        geometryBuilder: BufferGeometryBuilder;
        elementIndexToNodeIndices: Map<number, number[]>;
        elementIdToIndex: Map<number, number>;
        constructor(vim: Vim, geometry: VimSceneGeometry, geometryBuilder: BufferGeometryBuilder);
        private mapElementIndexToNodeIndices;
        private mapElementIdToIndex;
        getElementIndexFromElementId: (elementId: number) => number;
        getStringColumn: (table: any, colNameNoPrefix: string) => any;
        getIndexColumn: (table: any, tableName: string, fieldName: string) => any;
        getDataColumn: (table: any, typePrefix: any, colNameNoPrefix: any) => any;
        getIntColumn: (table: any, colNameNoPrefix: string) => any;
        getByteColumn: (table: any, colNameNoPrefix: string) => any;
        getFloatColumn: (table: any, colNameNoPrefix: string) => any;
        getDoubleColumn: (table: any, colNameNoPrefix: string) => any;
        getElementIndices: (table: any) => any;
        getElementTable: () => any;
        getNodeTable: () => any;
        getNodeIndicesFromElementIndex(elementIndex: number): number[] | undefined;
        getMeshesFromElementIndex(elementIndex: number): [THREE.Mesh, number][] | null;
        getMeshFromNodeIndex(nodeIndex: number): [THREE.Mesh, number] | undefined;
        getNodeIndexFromMesh(mesh: THREE.Mesh, instance: number): number | undefined;
        getElementIdFromMesh(mesh: THREE.Mesh, instance: number): number | undefined;
        getElementIndexFromNodeIndex(nodeIndex: number): number | undefined;
        getElementIdFromNodeIndex(nodeIndex: number): number | undefined;
        getElementName(elementIndex: number): string | undefined;
        getStringFromIndex(stringIndex: number): string | undefined;
    }
}
declare module "vim-loader/threeHelpers" {
    import * as THREE from 'three';
    export function createBufferGeometryFromArrays(vertices: Float32Array, indices: Int32Array, vertexColors?: Float32Array | undefined): THREE.BufferGeometry;
}
declare module "vim-loader/VIMLoader" {
    /**
     @author VIM / https://vimaec.com
    */
    import * as THREE from 'three';
    import { G3d, VimG3d } from "vim-loader/g3d";
    import { BFast } from "vim-loader/bfast";
    import { Vim } from "vim-loader/vim";
    import { VimSceneGeometry } from "vim-loader/vimSceneGeometry";
    import { VimScene } from "vim-loader/vimScene";
    type Mesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;
    export class VIMLoader {
        material: THREE.Material;
        timerName: string;
        constructor(material?: THREE.Material);
        createDefaultMaterial: () => THREE.MeshPhongMaterial;
        logStart(): void;
        log(msg: string): void;
        logEnd(): void;
        timeAction<T>(task: string, call: () => T): T;
        load(url: string, onLoad?: (response: VimScene) => void, onProgress?: (progress: ProgressEvent | 'processing') => void, onError?: (event: ErrorEvent) => void): void;
        parseBFastFromArray(bytes: Uint8Array): BFast;
        parseBFast(arrayBuffer: ArrayBuffer, byteOffset?: number, byteLength?: number): BFast;
        constructEntityTable(bfast: BFast): Map<string, any>;
        constructEntityTables(bfast: BFast): any;
        constructVIM: (bfast: any) => Vim;
        constructG3D(bfast: BFast): G3d;
        parse(data: ArrayBuffer): VimScene;
        mergeUniqueGeometry(g3d: VimG3d, geometry: (THREE.BufferGeometry | null)[], nodesByMesh: number[][]): [THREE.Mesh, number[]] | null;
        getTransformedUniqueGeometry(g3d: VimG3d, geometry: (THREE.BufferGeometry | null)[], nodesByMesh: number[][]): [THREE.BufferGeometry[], number[]];
        createMergedMesh(bufferGeometry: THREE.BufferGeometry[]): THREE.InstancedMesh;
        addUVs(bufferGeometry: THREE.BufferGeometry, value: number): void;
        allocateMeshes(geometries: (THREE.BufferGeometry | null)[], nodesByMesh: number[][]): (Mesh | null)[];
        instantiateSharedGeometry(meshes: (Mesh | null)[], g3d: VimG3d): VimSceneGeometry;
    }
    export class BufferGeometryBuilder {
        defaultColor: THREE.Color;
        indexBuffer: Int32Array;
        vertexBuffer: Float32Array;
        colorBuffer: Float32Array;
        g3d: VimG3d;
        constructor(g3d: VimG3d);
        createAllGeometry: () => (THREE.BufferGeometry | null)[];
        createBufferGeometryFromMeshIndex(meshIndex: number): THREE.BufferGeometry | null;
        createBufferGeometryFromInstanceIndex(instanceIndex: number): THREE.BufferGeometry | null;
        getSubmeshColor(g3d: VimG3d, submesh: number): THREE.Color;
    }
}
declare module "vim-webgl-viewer/selection" {
    import * as THREE from 'three';
    import { Viewer } from "vim-webgl-viewer/viewer";
    export class Selection {
        viewer: Viewer;
        elementIndex: number | null;
        boundingSphere: THREE.Sphere | null;
        highlightDisposer: Function | null;
        constructor(viewer: Viewer);
        hasSelection(): boolean;
        reset(): void;
        disposeResources(): void;
        select(elementIndex: number): void;
    }
}
declare module "vim-webgl-viewer/EnvironmentPlane" {
    import * as THREE from 'three';
    import { ModelSettings, ViewerSettings } from "vim-webgl-viewer/viewerSettings";
    export class EnvironmentPlane {
        source: string;
        mesh: THREE.Mesh;
        geometry: THREE.PlaneBufferGeometry;
        material: THREE.MeshBasicMaterial;
        texture: THREE.Texture;
        constructor();
        applySettings(settings: ViewerSettings, modelSettings?: ModelSettings, box?: THREE.Box3): void;
        applyTexture(texUrl: string): void;
        dispose(): void;
    }
}
declare module "vim-webgl-viewer/viewerEnvironment" {
    import * as THREE from 'three';
    import { ModelSettings, ViewerSettings } from "vim-webgl-viewer/viewerSettings";
    import { EnvironmentPlane } from "vim-webgl-viewer/EnvironmentPlane";
    export class ViewerEnvironment {
        plane: EnvironmentPlane;
        skyLight: THREE.HemisphereLight;
        sunLight: THREE.DirectionalLight;
        constructor(plane: EnvironmentPlane, skyLight: THREE.HemisphereLight, sunLight: THREE.DirectionalLight);
        static createDefault(): ViewerEnvironment;
        getElements(): THREE.Object3D[];
        applySettings(settings: ViewerSettings, modelSettings?: ModelSettings, box?: THREE.Box3): void;
    }
}
declare module "vim-webgl-viewer/viewer" {
    /**
     @author VIM / https://vimaec.com
    */
    import * as THREE from 'three';
    import { ModelSettings, ViewerSettings, ModelOptions, ViewerOptions } from "vim-webgl-viewer/viewerSettings";
    import { ViewerCamera } from "vim-webgl-viewer/viewerCamera";
    import { ViewerInput } from "vim-webgl-viewer/viewerInput";
    import { Selection } from "vim-webgl-viewer/selection";
    import { ViewerEnvironment } from "vim-webgl-viewer/viewerEnvironment";
    import { ViewerRenderer } from "vim-webgl-viewer/viewerRenderer";
    import { VimScene } from "vim-loader/vimScene";
    export type ViewerState = 'Uninitialized' | [state: 'Downloading', progress: number] | 'Processing' | [state: 'Error', error: ErrorEvent] | 'Ready';
    export class Viewer {
        settings: ViewerSettings;
        environment: ViewerEnvironment;
        render: ViewerRenderer;
        selection: Selection;
        cameraController: ViewerCamera;
        controls: ViewerInput;
        modelSettings: ModelSettings;
        vimScene: VimScene | undefined;
        state: ViewerState;
        static stateChangeEvent: string;
        constructor(options?: Partial<ViewerOptions>);
        private animate;
        /**
         * Load a vim model into the viewer from local or remote location
         * @param options model options
         * @param onLoad callback on model loaded
         * @param onProgress callback on download progresss and on processing started
         * @param onError callback on error
         */
        loadModel(options?: Partial<ModelOptions>, onLoad?: (response: VimScene) => void, onProgress?: (request: ProgressEvent | 'processing') => void, onError?: (event: ErrorEvent) => void): void;
        private onVimLoaded;
        private setState;
        private static getOrCreateCanvas;
        getModelMatrix: () => THREE.Matrix4;
        /**
         * Get the element index from the element Id
         * @param elementId id of element
         * @returns index of element
         */
        getElementIndexFromElementId: (elementId: number) => number;
        /**
         * Get the parent element index from a node index
         * @param nodeIndex index of node
         * @returns index of element
         */
        getElementIndexFromNodeIndex: (nodeIndex: number) => number;
        /**
         * Get the element index related to given mesh
         * @param mesh instanced mesh
         * @param index index into the instanced mesh
         * @returns index of element
         */
        getElementIndexFromMeshInstance: (mesh: THREE.Mesh, index: number) => number;
        /**
         * highlight all geometry related to and element
         * @param elementIndex index of element
         * @returns a disposer function for the created geometry
         */
        highlightElementByIndex(elementIndex: number): Function;
        /**
         * Compute total bounding box of all geometries related to an element
         * @param elementIndex index of element
         * @returns THREE bounding
         */
        getBoudingBoxForElementIndex(elementIndex: number): THREE.Box3 | null;
        /**
         * Select all geometry related to a given element
         * @param elementIndex index of element
         */
        selectByElementIndex(elementIndex: number): void;
        /**
         * Clear current selection
         */
        clearSelection(): void;
        /**
         * Move the camera to frame all geometry related to an element
         * @param elementIndex index of element
         */
        lookAtElementIndex(elementIndex: number): void;
        /**
         * Move the camera to frame current selection
         */
        lookAtSelection(): void;
        /**
         * Move the camera to frame the whole model
         */
        lookAtModel(): void;
        /**
         * Apply modified viewer settings
         */
        ApplySettings(): void;
        private highlight;
        private createBufferGeometryFromNodeIndices;
    }
}
declare module "main" { }
declare module "vim-webgl-viewer/viewerLoader" {
    import * as THREE from 'three';
    import { VimScene } from "vim-loader/vimScene";
    export const loadAny: (fileName: string, onFileLoaded: (result: VimScene | THREE.Scene | THREE.Group | THREE.Object3D | THREE.BufferGeometry) => void, onProgress: (progress: ProgressEvent) => void, onError: (error: ErrorEvent) => void, overrideFileExtension?: string | null) => void;
}
