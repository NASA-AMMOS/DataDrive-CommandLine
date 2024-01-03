export NAME ?= datadrive-commandline
export RELEASE_NAME ?= latest

install:
	npm --prefix src/ install

package:
	npm --prefix src/ run package

build:
	docker build -t $(NAME):$(RELEASE_NAME) .

test:
	npm --prefix src/ test

release:
	npm --prefix src/ run semantic-release

release-dry-run:
	npm --prefix src/ run semantic-release-dry-run