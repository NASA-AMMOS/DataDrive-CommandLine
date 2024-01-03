const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const SsoToken = require('../core/SsoToken');
const moment = require('moment');
const fs = require('fs');

let ssoToken;

describe("SsoToken", () => {
    before(() => {
        ssoToken = new SsoToken();
    });

    after(() => {

    });

    describe("loadToken", () => {
        it("should correctly load the token and expiration", async () => {
            ssoToken.loadToken(sessionPath=`${process.cwd()}/test/ssosession`, expirationPath=`${process.cwd()}/test/expiration`);
            expect(ssoToken.getToken()).to.be.not.empty;
            expect(ssoToken.getTokenExpiration()).to.be.not.empty;
        });
    });

    describe("isTokenAboutToExpired", () => {
        it("should return true because loaded token in loadToken should be about to expire or expired", async () => {
            expect(ssoToken.isTokenAboutToExpired()).equals(true);
        });

        it("should throw error as setTokenExpiration should be a string and in seconds (string should be length of 10)", async () => {
            let expireDate = new Date(Date.now());
            expireDate.setHours(expireDate.getHours() + 5);
            expect(() => {ssoToken.setTokenExpiration(expireDate.getTime().toString())}).to.throw();
        });

        it("should return false after setting an epoch time that is Date.now plus 5 hours", async () => {
            let expireDate = new Date(Date.now());
            expireDate.setHours(expireDate.getHours() + 5);
            let time = Math.floor(expireDate.getTime() / 1000);
            ssoToken.setTokenExpiration(time.toString());
            expect(ssoToken.isTokenAboutToExpired()).equals(false);
        });

        it("should return true after setting an epoch time that is Date.now plus 30 minutes", async () => {
            let expireDate = new Date(Date.now());
            expireDate.setMinutes(expireDate.getMinutes() + 30);
            let time = Math.floor(expireDate.getTime() / 1000);
            ssoToken.setTokenExpiration(time.toString());
            expect(ssoToken.isTokenAboutToExpired()).equals(true);
        });
    });
});