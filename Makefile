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
	docker build -t registry.rz1.metaways.net/devops/element:$$(git describe --tags) .
	docker push registry.rz1.metaways.net/devops/element:$$(git describe --tags)