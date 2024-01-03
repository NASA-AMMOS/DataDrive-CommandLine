FROM cae-artifactory.jpl.nasa.gov:17001/node:14.15.0

ENV HOME .

RUN apt-get update && \
    apt-get install zip && \
    mkdir -p /usr/src/app

WORKDIR /usr/src/app

RUN npm config set @gov.nasa.jpl.m2020.cs3:registry https://cae-artifactory.jpl.nasa.gov:443/artifactory/api/npm/npm-release-local/
