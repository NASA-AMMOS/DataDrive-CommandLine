export NAME ?= datadrive-commandline
export RELEASE_NAME ?= latest
export VERSION ?= latest


install:
	npm --prefix src/ install

package:
	docker run --rm -v "${PWD}":"/opt/ddrv/":z -e "IN_DOCKER_CONTAINER=TRUE" -e "NAME=${NAME}" -e "VERSION=${VERSION}" -e "WORKING_DIR=/opt/ddrv" cae-artifactory.jpl.nasa.gov:17001/node:18.16.1 /opt/ddrv/ci.cd/create_zip.sh
push:
	curl -H X-JFrog-Art-Api:${CAE_ARTI_TOKEN_PSW} -T deployment/dist/${NAME}__${VERSION}.zip ${ARTIFACTORY_URL}/${IMAGE_PREFIX}/${NAME}__${VERSION}.zip
copy:
	docker run --rm -v "${PWD}":"/opt/ddrv/":z -e "IN_DOCKER_CONTAINER=TRUE" -e "NAME=${NAME}" -e "VERSION=${VERSION}" -e "NEW_TAG=${NEW_TAG}" -e "WORKING_DIR=/opt/ddrv" cae-artifactory.jpl.nasa.gov:17001/node:18.16.1 /opt/ddrv/ci.cd/copy_release.sh
clean:
	docker run --rm -v "${PWD}":"/opt/ddrv/":z -e "IN_DOCKER_CONTAINER=TRUE" -e "NAME=${NAME}" -e "VERSION=${VERSION}" -e "WORKING_DIR=/opt/ddrv" cae-artifactory.jpl.nasa.gov:17001/node:18.16.1 /opt/ddrv/ci.cd/clean_dir.sh

build:
	docker build -t $(NAME):$(RELEASE_NAME) -f Dockerfile-localbuild .
	docker run -v ./:/opt/ddrv/deployment $(NAME):$(RELEASE_NAME)
	echo "Binaries exported to dist/"

test:
	npm --prefix src/ test

release:
	npm --prefix src/ install --only=dev && npm --prefix src/ run semantic-release

release-dry-run:
	npm --prefix src/ install --only=dev && npm --prefix src/ run semantic-release-dry-run