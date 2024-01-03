const DdLogger                                 = require('./DdLogger.js').logger;
const { QueueEmptyError, MaxProcessSizeError } = require('./DdError.js');

class Processor {
    /**
     * 
     * @param {Queue} queue
     * @param {number} maxSize - the maximum number of items that can be dequeued at a time; currently we only support 1
     */
    constructor(queue, maxSize=1) {
        /**
         * counter that works with maxSize to ensure that only "maxSize" number of items can be dequeued
         * @type {number}
         */
        this.size = 0;
        this.queue = queue;
        this.maxSize = maxSize;
    }
    
    /**
     * Get an items from the queue and then return that item via a promise
     */
    process() {
        return new Promise((resolve, reject) => {
            if (this.queue.isEmpty()) {
                reject(new QueueEmptyError("Queue is empty."));
            }
            else if (this.size < this.maxSize) {
                let node = this.queue.dequeue();
                this.size += 1;
                resolve(node);
            }
            else {
                reject(new MaxProcessSizeError("Max process size reached."));
            }
        });
    }
}

class QueueNode {
    constructor(key, value) {
        /** @type {string | number} */
        this.key = key;
        /** @type {object} */
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

class Queue {
    constructor() {
        /** @type {QueueNode} */
        this.head = null;
        /** @type {QueueNode} */
        this.tail = null;
        /** @type {Object.<string, QueueNode>} */
        this.mapping = {};
    }

    isEmpty() {
        return this.head === null && this.tail === null;
    }

    /**
     * 
     * @param {string | number} key
     * @param {Object} value
     */
    enqueue(key, value) {
        DdLogger.debug("Called enqueue");
        let node;
        if (key in this.mapping) {  // case where the key already exist in the queue
            node = this.pop(key);
        }
        else {
            node = new QueueNode(key, value);
        }
        this.mapping[key] = node;
        if (this.isEmpty()) {
            this.head = node;
            this.tail = node;
        }
        else {
            this.tail.next = node;
            node.prev = this.tail;
            this.tail = node;
        }
    }

    dequeue() {
        DdLogger.debug("Called dequeue");
        let result = null;
        if (!this.isEmpty()) {
            result = this.head;
            let key = result.key;
            delete this.mapping[key];
            this.head = this.head.next;
            if (this.head) {
                this.head.prev = null;
            }
            else {
                this.tail = null;
            }
        }
        return result;
    }

    /**
     * @param {string | number} key
     */
    pop(key) {
        DdLogger.debug("Called pop");
        let result = null;
        result = this.mapping[key];
        delete this.mapping[key];
        // this is to link up prev node with next node
        if (result.prev) {
            result.prev.next = result.next;
        }
        if (result.next) {
            result.next.prev = result.prev;
        }
        if (result === this.head) {
            this.head = this.head.next;
        }
        if (result === this.tail) {
            this.tail = this.tail.prev;
        }
        return result
    }

    itemsToList() {
        let items = [];
        let node = this.head;
        while (node) {
            items.push(node.value);
            node = node.next;
        }
        return items;
    }
}

module.exports = {
    "Queue": Queue,
    "QueueNode": QueueNode,
    "Processor": Processor
};