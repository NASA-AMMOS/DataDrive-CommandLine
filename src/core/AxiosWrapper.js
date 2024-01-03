/**
 * @author wphyo
 * Created on 1/7/22.
 */
const axios = require('axios')

class AxiosWrapper {
    async request(options) {
        try {
            let result = await axios.request(options)
            return result.data
        } catch (e) {
            // TODO better handling of axios exception
            let err = new Error()
            if (e['response'] === undefined) {
                err.message = `No response key. ${e.toString()}`
                err.statusCode = 503
                throw err
            }
            err.message = JSON.stringify(e.response.data)
            err.statusCode = e.response.status
            throw err
        }
    }
    static builder() {
        return new AxiosWrapper()
    }
}
exports.AxiosWrapper = AxiosWrapper
