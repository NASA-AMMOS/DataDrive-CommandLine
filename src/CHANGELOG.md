## [1.7.3](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.7.2...v1.7.3) (2022-01-12)


### Bug Fixes

* update jenkins node ([#86](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/86)) ([d09e2b3](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/d09e2b3)), closes [#72](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/72) [#79](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/79)

## [1.7.2](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.7.1...v1.7.2) (2021-08-23)


### Bug Fixes

* Binary error ([#81](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/81)) ([c658b02](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/c658b02)), closes [#72](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/72) [#79](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/79)

## [1.7.1](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.7.0...v1.7.1) (2021-08-23)


### Bug Fixes

* use cae-artifactory to avoid docker-hub limits + upgrade to node 14.15 since it is already tested + minor update in README sample command ([#79](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/79)) ([d91afcb](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/d91afcb))

# [1.7.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.6.2...v1.7.0) (2021-05-11)


### Features

* Update node version ([#72](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/issues/72)) ([eca60ad](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/eca60ad))

## [1.6.2](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.6.1...v1.6.2) (2020-11-25)


### Bug Fixes

* fixed bug where you could not use regex filter ([560bedc](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/560bedc))

## [1.6.1](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.6.0...v1.6.1) (2020-11-20)


### Bug Fixes

* resolved csso token renewal bug; originally reported in MSTRIAGE-2837 ([a232626](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/a232626))

# [1.6.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.5.0...v1.6.0) (2020-11-17)


### Features

* added playback for saved searches ([511f3be](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/511f3be))
* added support for subscribing to a saved search ([86da2e0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/86da2e0))
* updated to 6.5.0 ocs-js-client library ([06b7185](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/06b7185))

# [1.5.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.4.4...v1.5.0) (2020-09-22)


### Features

* updated to 6.5.0 ocs-js-client library ([333448f](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/333448f))

## [1.4.4](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.4.3...v1.4.4) (2020-08-24)


### Bug Fixes

* added better log message when you cannot connect to DataDrive middleware ([5292324](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/5292324))
* changed the way token expiration is checked and added unit tests ([a205be3](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/a205be3))
* check if csso token is about to expire and if so, reload the CSSO Token; note: this DOES NOT renew the csso token ([c940401](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/c940401))
* reason why web socket connect is closed is now displayed as opposed to debug log ([c590fde](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/c590fde))

## [1.4.3](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.4.2...v1.4.3) (2020-06-23)


### Bug Fixes

* added better debugging statements and added missing semi-colons ([8e55236](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/8e55236))
* fix bug where CLI version number is not shown ([40415ca](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/40415ca))

## [1.4.2](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.4.1...v1.4.2) (2020-04-28)


### Bug Fixes

* updated pkg libary to 4.4.7 to fix "Maximum call stack size exceeded" error ([9344162](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/9344162))

## [1.4.1](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.4.0...v1.4.1) (2020-03-25)


### Bug Fixes

* added validation for datadrive upload status messages, ignore and then suppress logging for those messages ([9b92515](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/9b92515))

# [1.4.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.3.1...v1.4.0) (2020-03-24)


### Features

* updated OCS JS library to 6.4.x ([bf4c32e](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/bf4c32e))

## [1.3.1](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.3.0...v1.3.1) (2020-03-24)


### Bug Fixes

* updated OCS JS library to 6.3.x ([70c2c45](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/70c2c45))

# [1.3.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.2.1...v1.3.0) (2020-03-24)


### Bug Fixes

* added ability to set datadrive middleware hostname and pep hostname via environment variables ([b76a0b2](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/b76a0b2))
* added flag to not load configs in DdSubConfig class; ([7486f65](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/7486f65))
* removed "Pulse authentication issue: no auth token" error message ([51f0f6e](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/51f0f6e))
* removed functions that interact with csso "authorization_token" as that is now deprecated and no longer being used ([a0752b9](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/a0752b9))
* updated how cookies are passed into requests to ensure that this will work with the new CSSO proxy ([5924320](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/5924320))


### Features

* added "show" command to list package names and descriptions ([75615d5](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/75615d5))

## [1.2.1](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.2.0...v1.2.1) (2019-09-27)


### Bug Fixes

* validHTTPResponse function incorrectly accepted 400 status codes ([d2d1054](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/d2d1054))

# [1.2.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.1.0...v1.2.0) (2019-09-24)


### Features

* added ability to run a nodejs script upon receipt of an event ([e6541b2](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/e6541b2))

# [1.1.0](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/compare/v1.0.0...v1.1.0) (2019-09-21)


### Features

* added playbacks, and regex filtering ([4278cd6](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/4278cd6))

# 1.0.0 (2019-09-11)


### Features

* automate the release to Github and generation of release notes ([7f722ea](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/7f722ea))

# 1.0.0 (2019-09-11)


### Features

* automate the release to Github and generation of release notes ([7f722ea](https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/commit/7f722ea))
