"use strict";

const DdPackageJSON = require("../package.json");

const CLIENT_NAME = "DataDrive CLI";
const CLIENT_VERSION = DdPackageJSON.version;
const CLIENT_TITLE = CLIENT_NAME + " " + CLIENT_VERSION;

//Event types from the OCS object event emitted
const OCS_EVENTYPE_OBJECT_INDEXED = "OBJ_INDEXED";
const OCS_EVENTYPE_OBJECT_REMOVED = "OBJ_REMOVED_FROM_INDEX";
const OCS_EVENTYPE_OBJECT_DELETED = "OBJ_REMOVED_DELETED";

//OCS Package metadata field names
const OCS_PACKAGE_NAME = "name";
const OCS_PACKAGE_DESCRIPTION = "description";

//This needs to be configurable at some point
//const DATADRIVE_HOST = "https://datadrive-mid-exp.m20-dev.jpl.nasa.gov/";

//Our Environment...er...Json file will be located
const CFG_FILEDIR = ".datadrive";
const CFG_FILENAME = "datadrive.json";

//OCS's versions of where their environment file will be located
const OCS_CFG_FILEDIR = ".ocs";
const OCS_CFG_FILENAME = "ocs.json";

//Data drive configuration
const PROP_DATADRIVE_HOST = "datadriveHost";
const ENV_DATADRIVE_HOST = "DATADRIVEHOST";
const PROP_PEP_HOST = "pepHost";
const ENV_PEP_HOST = "PEPHOST";
const PROP_DEBUG_ENABLED = "debugEnabled";
const ENV_DEBUG_ENABLED = "DEBUG";

const DEFAULT_DD_HOST = "datadrive-mid.m20-dev.jpl.nasa.gov";
const DEFAULT_PEP_HOST = "data.m20-dev.jpl.nasa.gov";
const DEFAULT_LOG_PATH = "./";
const DEFAULT_AUTH_TYPE = "M20";

//OCS configuration
const PROP_OCS_HOST = "ocsEndpointHost";
const PROP_OCS_API_DEPLOYMENT = "ocsApiStage";

//Event types... either OCS or PLAYBACK
const EVENTTYPE_OCS = "OCS";
const EVENTTYPE_PLAYBACK = "PLAYBACK";

//S3 related constants
const S3_PROTOCOL = "s3://";
const S3_URL_PATTERN = "^s3://([^/]+)/(.*?([^/]+))$";
const S3_URL_REGEX = new RegExp(S3_URL_PATTERN);

const SSO_SESSION_KEY_LOOKUP = {
    M20: "ssosession",
    MGSS: "mdmsSsoToken",
};

const SSO_KEY_LOOKUP = {
    M20: "csso",
    MGSS: "sso",
};

// This is for debug on nttooles Mac running middleware locally
//const DATADRIVE_HOST = "https://wphyo-mac.m20-dev.jpl.nasa.gov:8085";

module.exports = {
    CLIENT_NAME,
    CLIENT_VERSION,
    CLIENT_TITLE,
    OCS_EVENTYPE_OBJECT_INDEXED,
    OCS_EVENTYPE_OBJECT_REMOVED,
    OCS_EVENTYPE_OBJECT_DELETED,
    CFG_FILEDIR,
    CFG_FILENAME,
    ENV_DATADRIVE_HOST,
    ENV_PEP_HOST,
    ENV_DEBUG_ENABLED,
    PROP_DATADRIVE_HOST,
    PROP_PEP_HOST,
    PROP_OCS_HOST,
    PROP_OCS_API_DEPLOYMENT,
    PROP_DEBUG_ENABLED,
    OCS_CFG_FILEDIR,
    OCS_CFG_FILENAME,
    OCS_PACKAGE_NAME,
    OCS_PACKAGE_DESCRIPTION,
    DEFAULT_DD_HOST,
    DEFAULT_PEP_HOST,
    EVENTTYPE_OCS,
    EVENTTYPE_PLAYBACK,
    S3_PROTOCOL,
    S3_URL_PATTERN,
    S3_URL_REGEX,
    DEFAULT_LOG_PATH,
    SSO_SESSION_KEY_LOOKUP,
    DEFAULT_AUTH_TYPE,
    SSO_KEY_LOOKUP,
    //DATADRIVE_HOST
};
