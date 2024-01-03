const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const utils = require('../core/DdUtils');
const fs = require('fs');

describe("DdUtils", () => {
    let arr;
    before(() => {
        arr = [
            {
                ocs_updated_at: '2019-04-01T21:31:31Z',
                ocs_package_id: '58269f36-52a9-44d1-9ba2-bdbb84bf5b7c',
                ocs_owner: 'akassabi'
            },
            {
                ocs_updated_at: '2019-04-01T22:04:08Z',
                ocs_full_name: '/copy/8/DmDj4-jUwAAWMPB (9).jpg',
                ocs_dataset_id: '5f972d0e-7b63-477a-90e7-7cc691142555',
                ocs_package_id: '58269f36-52a9-44d1-9ba2-bdbb84bf5b7c',
                ocs_owner: 'wphyo'
            },
            {
                ocs_updated_at: '2019-04-01T21:42:54Z',
                ocs_full_name: '/copy/2/DmDj4-jUwAAWMPB (9).jpg',
                ocs_dataset_id: 'e0c09d6b-25d3-4d31-8b7b-918dd911961b',
                ocs_package_id: '58269f36-52a9-44d1-9ba2-bdbb84bf5b7c',
                ocs_owner: 'wphyo'
            },
            {
                ocs_updated_at: '2019-04-01T22:04:28Z',
                ocs_full_name: '/copy/16/DmDj4-jUwAAWMPB (9).jpg',
                ocs_dataset_id: '19914c0c-eb64-4e62-920f-536ba6b9c2c2',
                ocs_package_id: '58269f36-52a9-44d1-9ba2-bdbb84bf5b7c',
                ocs_owner: 'wphyo'
            },
            {
                ocs_updated_at: '2019-04-01T21:35:10Z',
                ocs_full_name: '/Air-Temperature-sol-100_2.png',
                ocs_dataset_id: 'ee21ad98-937d-4ef8-981c-a0e4e89c832e',
                ocs_package_id: '58269f36-52a9-44d1-9ba2-bdbb84bf5b7c',
                ocs_owner: 'wphyo'
            }
        ]
    });

    after(() => {

    });

    describe("test 1", () => {
        it("should sort asc", () => {
            arr.sort(utils.playbackEventsComparator);
            let i = 0;
            let j = 1;
            while (j < arr.length) {
                assert(arr[i].ocs_updated_at <= arr[j].ocs_updated_at, 'item at i is older than item at j');
                i += 1;
                j += 1;
            }
        });
    });

    let filePath = "somerandomplace/somefile.txt";
    describe("test canWriteToLocalFile; directory does not exist", () => {
        it("should check if folder exists and return true which means there are no conflicts", async () => {
            let config = {"overwrite": false}
            expect(utils.canWriteToLocalFile(filePath, config)).to.be.true;
        });
    });

    describe("test canWriteToLocalFile; directory exist", () => {
        before(() => {
            fs.mkdirSync("somerandomplace");
        });
        after(() => {
            fs.rmdirSync("somerandomplace");
        });
        it("should check if folder exists and return true", async () => {
            let config = {"overwrite": false}
            expect(utils.canWriteToLocalFile(filePath, config)).to.be.true;
        });
    });
})