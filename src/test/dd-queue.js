const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const queue = require('../core/DdQueue');
const Queue = queue.Queue;
const QueueNode = queue.QueueNode;

let createQueue = (count) => {
    let queue = new Queue();
    for (let i = 0; i < count; i++) {
        queue.enqueue(i, i);
    }
    return queue;
}

describe("DdQueue", () => {
    before(() => {

    });

    after(() => {

    });

    describe("test 1", () => {
        let queue = new Queue()
        it("should have length of 4 after enqueuing 4 items", () => {
            for (let i = 0; i < 4; i++) {
                queue.enqueue(i, i);
            }
            expect(queue.itemsToList().length).to.equal(4);
        });
        it("should have no items after dequeing all items plus some", () => {
            for (let i = 0; i < 6; i++) {
                queue.dequeue();
            }
            expect(queue.itemsToList().length).to.equal(0);
        });
        it("should be able to pop node correctly given a key in the middle", () => {
            let queue = createQueue(5);
            // pop the middle key (2)
            let result = queue.pop(2);
            expect(result instanceof QueueNode).to.be.true;
            expect(result.key).to.be.equal(2);
            expect(queue.itemsToList().length).to.equal(4);
        });
        it("should be able to pop node correctly given a key in the head", () => {
            let queue = createQueue(5);
            // pop the head key (0)
            let result = queue.pop(0);
            expect(result instanceof QueueNode).to.be.true;
            expect(result.key).to.be.equal(0);
            expect(queue.itemsToList().length).to.equal(4);
            let item = queue.dequeue();
            expect(item.key).to.be.equal(1);
            item = queue.dequeue();
            expect(item.key).to.be.equal(2);
            expect(queue.itemsToList().length).to.equal(2);
        });
        it("should be able to pop node correctly given a key in the tail", () => {
            let queue = createQueue(5);
            // pop the head key (4)
            let result = queue.pop(4);
            expect(result instanceof QueueNode).to.be.true;
            expect(result.key).to.be.equal(4);
            expect(queue.itemsToList().length).to.equal(4);
        });
    });
})