FROM cae-artifactory.jpl.nasa.gov:17001/node:18.16.1
MAINTAINER William Phyo <wai.phyo@jpl.nasa.gov>

ENV HOME .

RUN apt-get update && \
    apt-get install zip && \
    mkdir -p /opt/ddrv/src

WORKDIR /opt/ddrv/src
COPY src /opt/ddrv/src

COPY ./LICENSE /opt/ddrv/src/

RUN npm config set @gov.nasa.jpl.m2020.cs3:registry=https://cae-artifactory.jpl.nasa.gov:443/artifactory/api/npm/npm-release-local/
RUN npm config set @gov.nasa.jpl.ammos.ids:registry=https://artifactory.jpl.nasa.gov/artifactory/api/npm/npm-develop-local/

RUN npm i

CMD ["npm", "run", "package"]


