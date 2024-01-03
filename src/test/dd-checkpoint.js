const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const utils = require('../core/DdUtils');
const moment = require('moment');
const fs = require('fs');

let filePath = `tmp/checkpoint.txt`
let humanReadableDate = 'Fri Aug 09 2019 15:16:36 GMT-0700 (Pacific Daylight Time)'
describe("checkpoint", () => {
    before(() => {

    });

    after(() => {
        fs.unlinkSync(filePath);
    });

    describe("write date to file and read from date file", () => {
        it("should take a take a UTC date then write to file a local date", async () => {
            let date = new Date(humanReadableDate);
            let dateStr = moment(date).format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
            await utils.writeDateToFile(filePath, date);
            let dateRead = await utils.getCheckPointDate(filePath);
            let dateStrRead = dateRead.toString();
            expect(dateStrRead).to.be.equal(dateStr);
        });
    });
});