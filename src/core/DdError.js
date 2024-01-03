class QueueEmptyError extends Error {
    constructor(message) {
        super(message);
    }
}
class MaxProcessSizeError extends Error {
    constructor(message) {
        super(message);
    }
}

class CannotWriteToLocalFileError extends Error {
    constructor(message) {
        super(message);
    }
}

module.exports = {
    "QueueEmptyError": QueueEmptyError,
    "MaxProcessSizeError": MaxProcessSizeError,
    "CannotWriteToLocalFileError": CannotWriteToLocalFileError
};