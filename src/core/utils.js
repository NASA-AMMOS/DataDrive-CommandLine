/**
 * @author wphyo
 * Created on 6/1/22.
 */
const Validator = require('jsonschema').Validator;
const v = new Validator();

const isValidJson = (obj, schema) => {
    if (obj === null || obj === undefined) {
        return false;
    }
    return v.validate(obj, schema).valid;
};


/**
 *
 * @param input
 * @return {{result: undefined, error: string}|{result: any, error: undefined}}
 */
const jsonTryParse = (input) => {
    try {
        return {
            result: JSON.parse(input),
            error: undefined
        };
    } catch (error) {
        return {
            result: undefined,
            error: error.toString()
        }
    }
}


module.exports = {
    isValidJson,
    jsonTryParse,
}
