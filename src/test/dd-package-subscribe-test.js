const assert = require("assert");
const chai = require('chai');
const expect = chai.expect;
const DdConsts = require('../DdConstants.js');
const {DdCliConfigFileIO} = require('../core/DdCliConfigFileIO')
const OcsCfg = require('../OcsCfg.js')
const OCS = require('@gov.nasa.jpl.m2020.cs3/ocs-js-client');
const OcsUtils = require('../OcsUtils.js');
const DdLogger = require('../DdLogger.js').logger
const SsoToken   = require('../SsoToken.js');
const OcsTestUtils = require("./utils/ocs-test-utils.js");

const ctxt = {};

const init = () => {
    const ocsConfig = new OcsCfg()
    ctxt.s3Bucket = "testtest";
    ctxt.pkgName = "DataDrive-Dev-1";
    ctxt.file_name = "slowpoke.gif";
    ctxt.dataDriveHost = DdCliConfigFileIO.builder().getDatadriveHost()
    ctxt.ocsHost = ocsConfig.getOcsEndpointHost()
    ctxt.ocsAPIDeployment = ocsConfig.getOcsApiStage();
}

describe("DataDrive-CLI", () => {
    let ocs;
    let ocsUtils;

    /**
     * Setup Tests
     */
    before(() => {
        init();
        let config = {
            ocsEndpointHost: ctxt.ocsHost,
            ocsApiStage: ctxt.ocsAPIDeployment
        };

        ocs = OcsTestUtils.getClient(config);
        ctxt.cssoToken = ocs.cliGetCSSOTokens();
        ocsUtils = OcsUtils.builder(ocs, ctxt.cssoToken.sessionToken)
    });

    after(() => {

    });

    describe("csso", () => {
        describe("get datadrive env", () => {
            it ("should get dataDriveHost", () => {
                expect(ctxt.dataDriveHost).to.be.a('string');
            });
            it ("should get ocsHost", () => {
                expect(ctxt.ocsHost).to.be.a('string');
            });
            it ("should get ocsAPIDeployment", () => {
                expect(ctxt.ocsAPIDeployment).to.be.a('string');
            });
        });
        describe("getToken", () => {
            it("should return a csso token saved on the file system", () => {
                expect(ctxt.cssoToken).to.be.a('object');
            });
        });
    });

    describe("ocsUtils", () => {
        describe("getOcsFileMetadata", () => {
            it("should get file metadta from OCS", (done) => {
                packageName = "DataDrive-Dev-1"
                ocsObject =  {
                    "package_id": "58269f36-52a9-44d1-9ba2-bdbb84bf5b7c",
                    "dataset_id": "94bfa83f-c5a1-44bf-a644-1c092177ef3b",
                    "ocs_full_name": "/data_drive/Slowpoke.gif",
                    "ocs_url": "s3://m20-dev-ids-datadrive-bucket01/data_drive/uploads/2019-05-17T00:35:43.334Z/98e90c46-ab86-409d-bde3-8ee07e4b848e/Slowpoke.gif",
                    "package_dataset_event": "OCS object indexed",
                    "package_dataset_event_time" :1558053358032,
                    "identity": "m20-dev-ids"
                }
                ocsUtils.getOcsFileMetadata(packageName, ocsObject.ocs_full_name)
                    .then(metadata => {
                        expect(metadata).to.be.a('object');
                        expect(ocsObject.ocs_full_name.toLowerCase()).to.include(metadata.ocs_name.toLowerCase());
                        done()
                    }).catch(err => {
                        expect(err).to.be.a(null)
                })
            });
        });
    });
});
