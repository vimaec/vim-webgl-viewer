// The MIT License (MIT)
// Copyright (c) 2012 Nicholas Fisher
// https://github.com/KyleAMathews/deepmerge/blob/master/license.txt
export class DeepMerge {
    isMergeableObject(val) {
        return val && typeof val === 'object';
    }

    emptyTarget(val) {
        return Array.isArray(val) ? [] : {};
    }

    cloneIfNecessary(value, optionsArgument) {
        let clone = optionsArgument && optionsArgument.clone === true;
        return (clone && this.isMergeableObject(value)) ? this.deepMerge(this.emptyTarget(value), value, optionsArgument) : value;
    }

    defaultArrayMerge(target, source, optionsArgument) {
        let destination = target.slice();
        for (let i = 0; i < destination.length; ++i) {
            const e = destination[i];
            if (typeof destination[i] === 'undefined')
                destination[i] = this.cloneIfNecessary(e, optionsArgument);
            else if (this.isMergeableObject(e))
                destination[i] = this.deepMerge(target[i], e, optionsArgument);
            else if (target.indexOf(e) === -1)
                destination.push(this.cloneIfNecessary(e, optionsArgument));
        }
        return destination;
    }

    mergeObject(target, source, optionsArgument) {
        var destination = {};
        if (this.isMergeableObject(target))
            for (const key in target)
                destination[key] = this.cloneIfNecessary(target[key], optionsArgument);
        for (const key in source)
            if (!this.isMergeableObject(source[key]) || !target[key])
                destination[key] = this.cloneIfNecessary(source[key], optionsArgument);
            else
                destination[key] = this.deepMerge(target[key], source[key], optionsArgument);
        return destination;
    }

    deepMerge(target, source, optionsArgument) {
        var array = Array.isArray(source);
        var options = optionsArgument || { arrayMerge: this.defaultArrayMerge }
        var arrayMerge = options.arrayMerge || this.defaultArrayMerge
        if (array)
            return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : this.cloneIfNecessary(source, optionsArgument);
        else
            return this.mergeObject(target, source, optionsArgument);
    }
}
