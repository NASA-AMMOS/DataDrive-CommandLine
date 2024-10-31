const EventEmitter = require("node:events");
const WebSocket = require("ws");
const DdLogger = require("./DdLogger.js").logger;
const config = require("./config.js").config;
const DdConsts = require("./DdConstants.js");

// Does some basic message validation
function handleMessage(msg, eventEmitter) {
	// Toss out empty or non-JSON  messages
	if (!msg) return;
	let parsedMsg;
	try {
		parsedMsg = JSON.parse(msg);
	} catch (e) {
		DdLogger.error(`Bad JSON from middleware...`);
	}
	eventEmitter.emit("message", parsedMsg);
}

function getWSClient(ocsClient, options) {
	let url = config.datadriveHost.startsWith("https://")
		? config.datadriveHost
		: "https://" + config.datadriveHost;
	url = url.replace("https", "wss");

	const wsOptions = {
		headers: {
			Cookie: `${DdConsts.SSO_SESSION_KEY_LOOKUP[config.authType]}=${
				ocsClient.token
			}`,
		},
	};

	const eventEmitter = new EventEmitter();
	const wsClient = new WebSocket(url, [], wsOptions);

	let heartbeatInterval;

	wsClient.on("open", (e) => {
		DdLogger.info("Connected to websocket...");
		// Send the middleware some settings for this connection

		// Disable upload messages
		wsClient.send(JSON.stringify({ send_upload_status_msg: false }));

		// Subscribe to updates for only the selected package or saved search name
		if (options.packageInfo) {
			wsClient.send(
				JSON.stringify({
					client_type: "dd_cli",
					all_pkg: false,
					pkg: [options.packageInfo.package_id],
				}),
			);
		} else if (options.savedSearchName) {
			// First disable package level events
			wsClient.send(
				JSON.stringify({
					client_type: "NA",
					all_pkg: false,
					pkg: ["invalidId"],
				}),
			);

			// Subscribe to the desired saved search
			console.log(
				JSON.stringify({
					interested_saved_searches: [
						{
							type: "personal",
							owner: ocsClient.username,
							name: options.savedSearchName,
						},
					],
				}),
			);
			wsClient.send(
				JSON.stringify({
					interested_saved_searches: [
						{
							type: "personal",
							owner: ocsClient.username,
							name: options.savedSearchName,
						},
					],
				}),
			);
		}
		heartbeatInterval = setInterval((_) => {
			wsClient.ping();
		}, 5000);

		eventEmitter.emit("open");
	});

	wsClient.on("close", (e) => {
		clearInterval(heartbeatInterval);
		eventEmitter.emit("close");
	});
	wsClient.on("message", (msg) => handleMessage(msg, eventEmitter));
	wsClient.on("error", (msg) => eventEmitter.emit("error", msg));

	return eventEmitter;
	// const wsConfig = {
	// 	wsHost: wsHost,
	// 	cssoToken: this.__subscriptionConfig.getCssoToken(),
	// 	packageName: this.__subscriptionConfig.packageName,
	// 	packageId: this.__subscriptionConfig.packageId,
	// 	savedSearchName: this.__subscriptionConfig.savedSearchName,
	// 	savedSearchOwner: this.__subscriptionConfig.getUserNameFromCssoToken(),
	// };
	// const instance = this;
	// let wsClient = DataDriveWsClient.builder(wsConfig);
	// wsClient.setMessageCallback((msg) => instance.handleWsOcsEvent(msg));
	// wsClient.setErrorCallback((errMsg) => DdLogger.printError(errMsg));
	// wsClient.setFinalConnectionClosedCallback(() => DdOptions.exit(1));
	// return wsClient;
}

module.exports = {
	getWSClient,
};
