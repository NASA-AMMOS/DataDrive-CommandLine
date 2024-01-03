/**
 * @author wphyo
 * Created on 10/1/20.
 */
const axios = require('axios')

class AxiosWrapper {
    async request(options) {
        try {
            let result = await axios.request(options)
            return result.data
        } catch (e) {
            let err = new Error()
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
