const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

let DdOptions;
let DdSubConfig = require('../core/DdSubConfig.js');
let DdConsts = require('../core/DdConstants.js');
const {DdCliConfigFileIO} = require('../core/DdCliConfigFileIO');
let subConfig;

describe("DdOptions and DdSubConfig", () => {
    before(() => {
        DdCliConfigFileIO.builder().setFailOnError(false)
        process.env[DdConsts.ENV_PEP_HOST] = 'fakepep.m20-dev.jpl.nasa.gov';
        process.env[DdConsts.ENV_DATADRIVE_HOST] = 'fakeDD-mid.m20-dev.jpl.nasa.gov';
    });

    beforeEach(() => {
        DdOptions = require('../core/DdOptions.js');
    });

    afterEach(() => {
        // Code below is whack... because we want to de-allocate these 3 Singleton classes before testing them again
        // You can't do that unless you remove them from the module cache... what... the... f***... makes no sense
        // I must be doing something stupid, but at least it works right now...
        delete require.cache[require.resolve('../core/DdOptions.js')];
        delete subConfig;
        delete require.cache[require.resolve('commander')];
    });

    describe("Wildcard filter only", () => {
        it("should parse options correctly... regex is undefined, wildcard is *", () => {
            let argv = [ '/usr/local/Cellar/node/12.9.1/bin/node',
                '/Users/jeffliu/mipl/DataDrive-CommandLine/src/ddrv-subscribe.js',
                '-o',
                'tmp',
                '-p',
                'DataDrive-Dev-Congruent-1',
                '-r',
                '-P',
                '-f',
                '*1LLJ01.IMG'
            ]
            DdOptions.parseSubscriptionOptions(argv);
            subConfig = new DdSubConfig(DdOptions.program, false);
            expect(subConfig.fileRegex).is.equal(undefined);
            expect(subConfig.fileRegexObj).is.equal(undefined);
            expect(subConfig.fileWildcard).is.not.equal(undefined);
            expect(subConfig.fileWildcard).to.be.not.empty;
            expect(subConfig.fileWildcardRegexObj).is.not.equal(undefined);
        });

        it("should accept... NBVOW_H123_1LLJ01.IMG based on wildcard filter", () => {
            expect(subConfig.satisfiesFilter('NBVOW_H123_1LLJ01.IMG')).is.true;
        });
        it("should accept... /usr/share/bin/NBVOW_H123_1LLJ01.IMG based on wildcard filter", () => {
            expect(subConfig.satisfiesFilter('/usr/share/bin/NBVOW_H123_1LLJ01.IMG')).is.true;
        });
        it("should NOT accept... NBVOW_H123_1LLJaa01.IMG based on wildcard filter", () => {
            expect(subConfig.satisfiesFilter('NBVOW_H123_1LLJaa01.IMG')).is.false;
        });
    });

    describe("Regex filter only", () => {
        it("should parse options correctly... regex is defined, wildcard is *", () => {
            // Note: the double escape only happens when it shows up in code, when users put this in...
            // they put in '.*1LLJ01\.IMG' which when it gets into code, it will become '.*1LLJ01\\.IMG'
            let argv = [ '/usr/local/Cellar/node/12.9.1/bin/node',
                '/Users/jeffliu/mipl/DataDrive-CommandLine/src/ddrv-subscribe.js',
                '-o',
                'tmp',
                '-p',
                'DataDrive-Dev-Congruent-1',
                '-r',
                '-P',
                '-x',
                '.*1LLJ01\\.IMG'
            ]
            DdOptions.parseSubscriptionOptions(argv);
            subConfig = new DdSubConfig(DdOptions.program, false);
            expect(subConfig.fileWildcard).is.equal('*');
            expect(subConfig.fileWildcardRegexObj).is.not.undefined;
            expect(subConfig.fileRegex).is.not.equal(undefined);
            expect(subConfig.fileRegex).to.be.not.empty;
            expect(subConfig.fileRegexObj).is.not.equal(undefined);
        });

        it("should accept... NBVOW_H123_1LLJ01.IMG based on regex filter", () => {
            expect(subConfig.satisfiesFilter('NBVOW_H123_1LLJ01.IMG')).is.true;
        });
        it("should accept... /usr/share/bin/NBVOW_H123_1LLJ01.IMG based on regex filter", () => {
            expect(subConfig.satisfiesFilter('/usr/share/bin/NBVOW_H123_1LLJ01.IMG')).is.true;
        });
        it("should NOT accept... NBVOW_H123_1LLJaa01.IMG based on regex filter", () => {
            expect(subConfig.satisfiesFilter('NBVOW_H123_1LLJaa01.IMG')).is.false;
        });
        it("should NOT accept... /usr/share/bin/jplisawesome3435**.jpg based on regex filter", () => {
            expect(subConfig.satisfiesFilter('/usr/share/bin/jplisawesome3435**.jpg')).is.false;
        });
    });

    describe("Regex filter special character test 1", () => {
        it("should parse options correctly give... .*\.txt", () => {
            // Note: the double escape only happens when it shows up in code, when users put this in...
            // they put in '.*\.txt' which when it gets into code, it will become '.*\\.txt'
            let argv = [ '/usr/local/Cellar/node/12.9.1/bin/node',
                '/Users/jeffliu/mipl/DataDrive-CommandLine/src/ddrv-subscribe.js',
                '-o',
                'tmp',
                '-p',
                'DataDrive-Dev-Congruent-1',
                '-r',
                '-P',
                '-x',
                '.*\\.txt'
            ]
            DdOptions.parseSubscriptionOptions(argv);
            subConfig = new DdSubConfig(DdOptions.program, false);
            expect(subConfig.fileRegexObj).is.not.equal(undefined);
        });

        it("should accept... jeff_p1_09-15-2019.txt", () => {
            expect(subConfig.satisfiesFilter('jeff_p1_09-15-2019.txt')).is.true;
        });
        it("should accept... /usr/share/bin/jeff_p1_09-15-2019.txt", () => {
            expect(subConfig.satisfiesFilter('/usr/share/bin/jeff_p1_09-15-2019.txt')).is.true;
        });
        it("should NOT accept... jeff_p1_09-15-2019.ttxt should not accept", () => {
            expect(subConfig.satisfiesFilter('jeff_p1_09-15-2019.ttxt')).is.false;
        });
    });

    describe("No filter", () => {
        it("should parse options correctly... regex is undefined, wildcard is *", () => {
            let argv = [ '/usr/local/Cellar/node/12.9.1/bin/node',
                '/Users/jeffliu/mipl/DataDrive-CommandLine/src/ddrv-subscribe.js',
                '-o',
                'tmp',
                '-p',
                'DataDrive-Dev-Congruent-1',
                '-r',
                '-P'
            ]
            DdOptions.parseSubscriptionOptions(argv);
            subConfig = new DdSubConfig(DdOptions.program, false);
            expect(subConfig.fileWildcard).is.equal('*');
            expect(subConfig.fileWildcardRegexObj).is.not.undefined;
            expect(subConfig.fileRegex).is.equal(undefined);
            expect(subConfig.fileRegexObj).is.equal(undefined);
        });

        it("should accept... NBVOW_H123_1LLJ01.IMG based on no filters", () => {
            expect(subConfig.satisfiesFilter('NBVOW_H123_1LLJ01.IMG')).is.true;
        });
        it("should accept... /usr/share/bin/NBVOW_H123_1LLJ01.IMG based on no filters", () => {
            expect(subConfig.satisfiesFilter('/usr/share/bin/NBVOW_H123_1LLJ01.IMG')).is.true;
        });
        it("should NOT accept... NBVOW_H123_1LLJaa01.IMG based on no filters", () => {
            expect(subConfig.satisfiesFilter('NBVOW_H123_1LLJaa01.IMG')).is.true;
        });
        it("should NOT accept... /usr/share/bin/jplisawesome3435**.jpg based on no filters", () => {
            expect(subConfig.satisfiesFilter('/usr/share/bin/jplisawesome3435**.jpg')).is.true;
        });
    });

    describe("Saved search only", () => {
        it("should parse options correctly... savedsearchname is defined", () => {
            let argv = [ '/usr/local/Cellar/node/12.9.1/bin/node',
                '/Users/jeffliu/mipl/DataDrive-CommandLine/src/ddrv-subscribe.js',
                '-o',
                'tmp',
                '-p',
                'DataDrive-Dev-Congruent-1',
                '-r',
                '-P',
                '-s',
                'jeff-test-saved-search'
            ]
            DdOptions.parseSubscriptionOptions(argv);
            subConfig = new DdSubConfig(DdOptions.program, false);
            expect(subConfig.savedSearchName).is.equal('jeff-test-saved-search');
            expect(subConfig.savedSearchType).is.equal('personnel');
        });
    });
})
