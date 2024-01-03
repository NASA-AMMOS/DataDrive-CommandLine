const OCS = require('@gov.nasa.jpl.m2020.cs3/ocs-js-client');

let csso;

const OcsTestUtils = (function() {
    const OcsTestUtils = function() {};

    OcsTestUtils.getClient = function (config = {}) {
        ocs = new OCS(config);
        return ocs
    };

    OcsTestUtils.createPackage = function (ocs, pkgName, s3Bucket, congruentPaths, cb) {
        // Get the list of requried metadata.
        ocs.describeRequiredMetadata(OcsTestUtils.toRqst(), function (err, resp) {
            OcsTestUtils.processResp(ocs, err, resp, function (err, meta) {
                if (err) {
                    return handleError(cb, err);
                }
                const _meta = {};
                for (const m of meta) {
                    _meta[m.tag] = `${m.tag}_val`;
                }
                const _params = {
                    packageName: pkgName,
                    metadata: _meta
                };
                if (s3Bucket) _params.s3Bucket = s3Bucket;
                if (congruentPaths) _params.congruentPaths = congruentPaths;
                ocs.createPackage(OcsTestUtils.toRqst(_params), function (err, resp) {
                    OcsTestUtils.processResp(ocs, err, resp, function (err, resp) {
                        if (err) {
                            return handleError(cb, err);
                        }
                        return cb(null, resp);
                    });
                });
            });
        });
    };
     
    OcsTestUtils.toRqst = function (input) {
        let _rqst = {
            csso: {
                sessionToken: csso
            },
            input: input
        };
        return _rqst;
    };

    OcsTestUtils.processResp = function (ocs, err, resp, cb) {
        // Check for errors.
        if (err) {
            return cb(OcsTestUtils.getFriendlyError(err), null);
        }
        if (resp.error) {
            return cb(resp.error, null);
        }
        // If no errors, save CSSO creds.
        if (resp.csso.authToken) {
            if (resp.csso.authToken != csso.authToken) {
                // Only save the auth token if it is different.
                ocs.cliSaveCSSOAuthToken(resp.csso.authToken);
                csso.authToken = resp.csso.authToken;
            }
        }
        cb(null, resp.data);
    };

    const handleError = function (cb, err, msg) {
        mlog.error(`ERROR: ${msg}`, err);
        if (err instanceof Error) {
            cb(err, null);
            return;
        } else {
            let _msg;
            if (typeof err === 'object') {
                _msg = JSON.stringify(err, null, 2);
            } else {
                _msg = err;
            }
            cb(Error(_msg), null);
            return;
        }
    };

    return OcsTestUtils;
})();

module.exports = OcsTestUtils;