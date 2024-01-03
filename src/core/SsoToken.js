/**
 * @author wphyo
 * Created on 6/1/22.
 */
// Interface to the OCS SSO token and also a facility to keep it
// active through periodic URL cookie-based requests to an OCS service URL.
//

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('request');

const DdUtils = require('./DdUtils');
const DdLogger = require('./DdLogger.js').logger;

class SsoToken {
    constructor() {
        this.__ssoTokenValue  = null  // This should be a string value
        this.__ssoTokenExpiration = null  // This should be a string value

        this.__intervalMinutes    = 1;
        this.__intervalSecPerMin  = 60;
        this.__intervalMsecPerSec = 1000;
        this.__intervalMillis = this.__intervalMinutes * this.__intervalSecPerMin * this.__intervalMsecPerSec;

        this.__timerObj       = null;
        this.__checkAuthToken = true;

        //timestamps on auth requests and success
        this.__performAuthMetrics = true;
        this.__lastAuthAttempt = null;
        this.__lastAuthSuccess = null;
        this.__lastAuthAttemptMax = 3;
        this.__lastAuthTimeout = this.__lastAuthAttemptMax * this.__intervalMillis;
    }

    loadToken(sessionPath=null, expirationPath=null) {
        try {
            //CSSO token
            const homedir = os.homedir();
            let sesPath = sessionPath !== null ? sessionPath : path.join(homedir, ".cssotoken", "ssosession")
            let expPath = expirationPath !== null ? expirationPath : path.join(homedir, ".cssotoken", "expiration")

            //console.log("sesPath "+sesPath);
            this.__ssoTokenValue = fs.readFileSync(sesPath, 'utf8');
            this.__ssoTokenExpiration = fs.readFileSync(expPath, 'utf8');

            if ( DdUtils.isEmptyOrNullString(this.__ssoTokenValue)) {
                DdUtils.errorAndExit('SsoToken:: Empty cssotoken.  Consider re-initing your credentials');
            }
        } catch (error) {
            DdLogger.error(error.message);
            DdLogger.debug(error.stack);
            DdUtils.errorAndExit('SsoToken:: Error occurred during retrieval of cssotoken.')
        }
    }

    isTokenAboutToExpired(hours=1) {
        this.getTokenExpiration()
        if (!this.__ssoTokenExpiration) {
            DdUtils.errorAndExit('SsoToken:: Empty cssotoken.  Consider re-initing your credentials');
            return false
        }
        // Check that it has not expired.
        // Note that the expiration time written by CSSO is in seconds, not milliseconds.
        const _expireTime = Number.parseInt(this.__ssoTokenExpiration)
        let expireDate = new Date(_expireTime * 1000)  // Date object should be in milliseconds, so multiply it by 1000
        expireDate.setHours(expireDate.getHours() - hours)
        let date = new Date(Date.now())
        return date >= expireDate
    }

    getToken() {
        if (DdUtils.isEmptyOrNullString(this.__ssoTokenValue)) {
            this.loadToken()
        }
        return this.__ssoTokenValue;
    }

    setToken() {
        // validate input; make sure it is a string
        if (typeof value != "string") {
            throw Error('Token should be a string')
        }
        this.__ssoTokenValue = value
    }

    getTokenExpiration() {
        if (DdUtils.isEmptyOrNullString(this.__ssoTokenExpiration)) {
            this.loadToken()
        }
        return this.__ssoTokenExpiration
    }

    setTokenExpiration(tokenExpirationValue) {
        // validate input to be of length 10 and is a string
        if (typeof tokenExpirationValue != "string" || tokenExpirationValue.length !== 10) {
            throw Error('Token should be a string and of length 10')
        }
        this.__ssoTokenExpiration = tokenExpirationValue
    }
}

module.exports = SsoToken;
