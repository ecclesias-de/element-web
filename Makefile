.PHONY: docker-build start install

docker-build:
	if [ "$$(git branch --show-current)" != "" ] || ! git describe --tags --exact-match > /dev/null; then \
		echo Checkout a tag to build. Otherwise the wrong version string will be set!; \
		echo tag\(s\) = $$(git tag --points-at HEAD); \
		exit 1; \
	fi
	if [ "$$(git status --porcelain)" != "" ]; then \
		echo Git dirty! Commit or stash your changes.; \
		exit 1; \
	fi
	docker build -f ./apps/web/Dockerfile -t registry.rz1.metaways.net/devops/element:$$(git describe --tags) .
	docker push registry.rz1.metaways.net/devops/element:$$(git describe --tags)
	docker tag registry.rz1.metaways.net/devops/element:$$(git describe --tags) registry.rz1.metaways.net/devops/element:latest
	docker push registry.rz1.metaways.net/devops/element:latest

install:
	docker run -it -v $$(pwd):/app --user $$(id -u) --workdir /app node:24-bullseye yarn install

start:
	docker run -it -v $$(pwd):/app --user $$(id -u) -p 8080:8080 --workdir /app node:24-bullseye yarn start