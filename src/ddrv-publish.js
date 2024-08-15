const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const program = new Command();
const chokidar = require("chokidar");

const DdConsts = require("./core/DdConstants.js");
const DdUtils = require("./core/DdUtils.js");
const DdLogger = require("./core/DdLogger.js").logger;
const ocs_utils = require("./core/ocs_utils.js");
const utils = require("./core/utils.js");
const FormData = require("form-data");

// Basic checks for user-inputted options before we get started
function validateOptions(options = {}) {
	const errors = [];

	// Does the input dir exist?
	if (!fs.existsSync(options.sourceDir)) {
		DdUtils.errorAndExit(
			`Can't find source directory ${options.sourceDir}, quitting...`,
		);
	}

	if (errors.length) {
		const outMsg = errors.join("\n");
		return DdUtils.errorAndExit(outMsg);
	}

	return options;
}

function getArgs() {
	program
		.requiredOption(
			"-p, --package-name [pkg name]",
			"The name of the package.",
		)
		.requiredOption(
			"-s, --source-dir   <source dir>",
			"The source directory.",
		)
		.option(
			"-d, --dest-prefix  [s3-prefix]",
			"Prefix path to be prepended to S3 location",
			"",
		)
		.option(
			"-f, --filter  [value]",
			"A wildcard expression to filter files",
			"*",
		)
		.option(
			"-r, --retain-path",
			"Use the relative path when creating S3 location of file",
		)
		.option(
			"-o --overwrite",
			"Allows existing files to be overwritten on the server",
			false,
		);

	program.parse();
	return validateOptions(program.opts());
}

async function fileUploader(ocsClient, options, filePath) {
	const uploadForm = new FormData();

	uploadForm.append("pkg_id", options.packageInfo.package_id);

	const basePath = options.retainPath
		? filePath.split("/").slice(1).join("/")
		: path.basename(filePath);
	let ocsPath = path.join(options.destPrefix, basePath);
	if (!ocsPath.startsWith("/")) {
		ocsPath = "/" + ocsPath;
	}

	uploadForm.append("ocs_path", path.dirname(ocsPath));
	uploadForm.append("overwrite", JSON.stringify(options.overwrite));
	uploadForm.append("name", `s3://${options.packageInfo.s3Bucket}${ocsPath}`);
	uploadForm.append("file", fs.createReadStream(filePath));

	const res = await ocs_utils.uploadFile(ocsClient, uploadForm);
	if (!res.ok) {
		if (res.status === 500 && !options.overwrite) {
			DdLogger.error(
				`Unable to upload file ${filePath} to package ${options.packageName} and path ${ocsPath}. Overwrite option (-o) is not set, you may be attempting to overwrite an existing file...`,
			);
		} else {
			DdLogger.error(
				`${res.status} error encountered uploading file ${filePath}`,
			);
		}
		return;
	}

	DdLogger.info(`${filePath} uploded.`);
}

async function sourceDirWatcher(ocsClient, options) {
	const filterRegexp = options.filter
		? utils.filterToRegexp(options.filter)
		: null;
	DdLogger.info(
		`Watching files in directory: ${options.sourceDir}. Files will be uploaded to package ${options.packageName}.}`,
	);

	async function handleFile(changedPath) {
		if (filterRegexp && !filterRegexp.test(path.basename(changedPath))) {
			DdLogger.debug(
				`${changedPath} doesn't match filter: ${options.filter}, ignoring...`,
			);
			return;
		}
		DdLogger.info(`File found: ${changedPath}`);
		await fileUploader(ocsClient, options, changedPath);
	}

	chokidar
		.watch(options.sourceDir, {
			ignored: /(^|[\/\\])\../, // ignore dotfiles
			ignoreInitial: true,
		})
		.on("add", handleFile)
		.on("change", handleFile);
}

async function main() {
	// Get CLI args and main config
	const options = getArgs();

	// Initialize the OCS client
	const ocsClient = await ocs_utils.getOCSClient(options);

	// Check that the selected package exists and is configured w/ an s3Bucket
	const packageInfo = await ocs_utils.getPackageID(
		ocsClient,
		options.packageName,
	);
	if (!packageInfo) {
		DdUtils.errorAndExit(`Cannot find package: ${options.packageName}`);
	}

	if (!packageInfo.s3Bucket) {
		DdUtils.errorAndExit(
			`Package ${options.packageName} does not have an s3Bucket configured and thus can't be published to using this tool.`,
		);
	}
	options.packageInfo = packageInfo;

	await sourceDirWatcher(ocsClient, options);
}

main();
