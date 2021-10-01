// Used to provide new IDs for each new property descriptor that is created.
var gid = 0;
/**
 * Describes a property so that it can be found
 */
var PropDesc = /** @class */ (function () {
    function PropDesc(type, def) {
        this.type = type;
        this.def = def;
        this.id = gid++;
        this.name = "";
        this.vis = true;
    }
    PropDesc.prototype.setStep = function (step) {
        this.step = step;
        return this;
    };
    PropDesc.prototype.setRange = function (min, max) {
        this.min = min;
        this.max = max;
        return this;
    };
    PropDesc.prototype.setName = function (name) {
        this.name = name;
        return this;
    };
    PropDesc.prototype.setChoices = function (xs) {
        this.choices = xs;
        return this;
    };
    PropDesc.prototype.setOptions = function (xs) {
        this.options = xs;
        return this;
    };
    return PropDesc;
}());
/**
 * Holds a value, and a reference to the descriptor.
 */
var PropValue = /** @class */ (function () {
    function PropValue(_desc) {
        this._desc = _desc;
        this._value = _desc.def;
    }
    Object.defineProperty(PropValue.prototype, "name", {
        get: function () { return this._desc.name; },
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(PropValue.prototype, "value", {
        get: function () { return this._value; },
        set: function (value) { this._value = value; },
        enumerable: false,
        configurable: true
    });
    return PropValue;
}());
/**
 * A list of properties. The values can be get and set directly on this object.
 */
var PropList = /** @class */ (function () {
    function PropList(desc, name) {
        if (name === void 0) { name = ''; }
        this.desc = desc;
        this.name = name;
        this.items = [];
        for (var k in desc) {
            var v = desc[k];
            if (v instanceof PropDesc)
                this.items.push(new PropValue(v));
            else
                this.items.push(new PropList(v, k));
        }
    }
    PropList.prototype.fromJson = function (json) {
        for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
            var pv = _a[_i];
            if (pv.name in json) {
                var v = json[pv.name];
                if (pv instanceof PropValue)
                    pv.value = v;
                else
                    pv.fromJson(v);
            }
        }
        return this;
    };
    Object.defineProperty(PropList.prototype, "toJson", {
        get: function () {
            var r = {};
            for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
                var pv = _a[_i];
                if (pv instanceof PropValue) {
                    r[pv.name] = pv.value;
                }
                else {
                    r[pv.name] = pv.toJson;
                }
            }
            return r;
        },
        enumerable: false,
        configurable: true
    });
    PropList.prototype.find = function (name) {
        return this.items.find(function (v) { return v.name === name; });
    };
    return PropList;
}());
export var ViewerGui = {
    gui: new dat.GUI(),
    bind: function (settings, callback) {
        // Create a property descriptor 
        var propDesc = objectToPropDesc(settings, {});
        // Create a property list from the descriptor 
        var props = new PropList(propDesc);
        // Iniitlaize the property list values             
        props.fromJson(settings);
        // Bind the properties to the DAT.gui controller, returning the scene when it updates
        bindControls(props, this.gui, function () { return callback(props.toJson); });
        function objectToPropDesc(obj, pdm) {
            // TODO: look for common patterns (colors, positions, angles) and process these specially.
            for (var k in obj) {
                var v = obj[k];
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
        function bindControls(list, gui, onChange) {
            for (var k in list.desc) {
                bindControl(list, k, gui, onChange);
            }
            return gui;
        }
        // Fills out a dat.gui control to a property in a property list.
        function bindControl(list, name, gui, onChange) {
            var pv = list.find(name);
            if (!pv)
                throw new Error("Could not find parameter " + name);
            // Do I really need to pass a PropDesc?? 
            if (pv instanceof PropValue) {
                var desc = pv._desc;
                if (desc.choices) {
                    return gui.add(pv, "value", desc.choices).name(pv.name).setValue(pv.value).onChange(function () { return onChange(pv); });
                }
                else if (desc.type === 'vec3') {
                    var folder = gui.addFolder(desc.name);
                    folder.open();
                    folder.add(pv.value, "x").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "y").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "z").step(0.1).onChange(function () { return onChange(pv); });
                    return folder;
                }
                else if (desc.type === 'hsv') {
                    var folder = gui.addFolder(desc.name);
                    folder.open();
                    folder.add(pv.value, "x").name("hue").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "y").name("saturation").step(0.1).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "z").name("value").step(0.1).onChange(function () { return onChange(pv); });
                    return folder;
                }
                else if (desc.type === 'rot') {
                    var folder = gui.addFolder(desc.name);
                    folder.open();
                    folder.add(pv.value, "yaw", -1, 1, 0.01).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "pitch", -1, 1, 0.01).onChange(function () { return onChange(pv); });
                    folder.add(pv.value, "roll", -1, 1, 0.01).onChange(function () { return onChange(pv); });
                    return folder;
                }
                else if (desc.type === 'color') {
                    var controller = gui.addColor(pv, "value").name(pv.name);
                    controller.onChange(function () { return onChange(pv); });
                    return controller;
                }
                else {
                    var controller = gui.add(pv, "value", desc.min, desc.max, desc.step).name(pv.name);
                    controller.onChange(function () { return onChange(pv); });
                    return controller;
                }
            }
            else {
                // It is a property list. We create a new folder, and add controls to the folder.
                var folder = gui.addFolder(name);
                //folder.open();
                bindControls(pv, folder, onChange);
                return folder;
            }
        }
        // Helper functions for defining properties 
        function prop(type, def) { return new PropDesc(type, def); }
        function boolProp(x) { return prop("boolean", x); }
        function stringProp(x) { return prop("string", x); }
        function floatProp(x) {
            if (x === void 0) { x = 0; }
            return prop("float", x);
        }
        function smallFloatProp(x) {
            if (x === void 0) { x = 0; }
            return prop("float", x).setStep(0.01);
        }
        function colorCompProp(x) {
            if (x === void 0) { x = 0; }
            return rangedIntProp(x, 0, 255);
        }
        function intProp(x) { return prop("int", x); }
        function rangedIntProp(x, min, max) { return intProp(x).setRange(min, max); }
        function rangedFloatProp(x, min, max) { return floatProp(x).setRange(min, max); }
        function zeroToOneProp(x) { return floatProp(x).setRange(0, 1).setStep(0.01); }
        function oneOrMoreIntProp(x) { return intProp(x).setRange(1); }
        function timeProp(x) { return prop("time", x); }
        function choiceProp(xs) { return prop("choices", xs[0]).setChoices(xs); }
        function vec3Prop(x, y, z) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            if (z === void 0) { z = 0; }
            return prop('vec3', { x: x, y: y, z: z });
        }
        function scaleProp() { return prop('vec3', { x: 1, y: 1, z: 1 }); }
        function rotProp(yaw, pitch, roll) {
            if (yaw === void 0) { yaw = 0; }
            if (pitch === void 0) { pitch = 0; }
            if (roll === void 0) { roll = 0; }
            return prop('rot', { yaw: yaw, pitch: pitch, roll: roll });
        }
        function axisProp() { return choiceProp(['x', 'y', 'z']).setName("axis"); }
        function conditionalProp(val, options) { return prop('conditional', val).setOptions(options); }
        function colorProp(r, g, b) {
            if (r === void 0) { r = 0; }
            if (g === void 0) { g = 0; }
            if (b === void 0) { b = 0; }
            return prop('color', [r, g, b]);
        }
    }
};
//# sourceMappingURL=viewer_gui.js.map