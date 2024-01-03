/**
 * @author wphyo
 * Created on 7/19/21.
 */
class WebsocketException extends Error {
    constructor(message) {
        super(message)
        this.name = 'WebsocketException'
    }
}
module.exports = WebsocketException
