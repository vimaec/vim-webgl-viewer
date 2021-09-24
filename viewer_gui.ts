
/** 
 * An object that maps names to property descriptors or other maps. Allows property descriptors to be easily
 * written as hierarchical data structures that map the folder structurue we want in the GUI.
 */
interface IPropDescMap {
    [name: string]: PropDesc | IPropDescMap;
}

// Used to provide new IDs for each new property descriptor that is created.
let gid = 0;

/**
 * Describes a property so that it can be found 
 */
class PropDesc {
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
        public def: any) {
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
class PropList {
    readonly items: (PropValue | PropList)[] = [];
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
    find(name: string): PropValue | PropList | undefined {
        return this.items.find(v => v.name === name);
    }
}

//Used for callbacks when a property value is changed.
type PropValueChanged = (pv: PropValue) => void;
type PropsValueChanged = (pv: PropListJson) => void;

const ViewerGui =
{
    gui: new dat.GUI(),
    bind: function (settings, callback: PropsValueChanged) {
        // Create a property descriptor 
        const propDesc = objectToPropDesc(settings, {});

        // Create a property list from the descriptor 
        const props = new PropList(propDesc);
        // Iniitlaize the property list values             
        props.fromJson(settings);

        // Bind the properties to the DAT.gui controller, returning the scene when it updates
        bindControls(props, this.gui, () => callback(props.toJson));

        function objectToPropDesc(obj, pdm: IPropDescMap): IPropDescMap {
            // TODO: look for common patterns (colors, positions, angles) and process these specially.
            for (const k in obj) {
                const v = obj[k];
                switch (typeof (v)) {
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

        // Fills out a dat.gui instance to a property list.
        function bindControls(list: PropList, gui: any, onChange: PropValueChanged) {
            for (const k in list.desc) {
                bindControl(list, k, gui, onChange);
            }
            return gui;
        }


        // Fills out a dat.gui control to a property in a property list.
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
        function axisProp() { return choiceProp(['x', 'y', 'z']).setName("axis"); }
        function conditionalProp(val: string, options: any) { return prop('conditional', val).setOptions(options); }
        function colorProp(r = 0, g = 0, b = 0) { return prop('color', [r, g, b]); }
    }
}
