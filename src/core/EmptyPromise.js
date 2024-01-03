/**
 * @author wphyo
 * Created on 11/24/20.
 */
const bbPromise = require('bluebird');
class EmptyPromise {
    constructor() {
        this._callbacks = null;
        this._done = false;
        let instance = this;
        this._p = new bbPromise((resolve, reject) => {instance._callbacks = { resolve, reject }});
    }

    done() {
        return this._done;
    }

    resolve(obj) {
        this._callbacks.resolve(obj);
        this._done = true;
        return this._p;
    }

    reject(obj) {
        this._callbacks.reject(obj);
        this._done = true;
        return this._p;
    }

    get() {
        return this._p;
    }

    static builder() {
        return new EmptyPromise();
    }
}
exports.EmptyPromise = EmptyPromise;
/**
 * @author wphyo
 * Created on 6/1/22.
 */
