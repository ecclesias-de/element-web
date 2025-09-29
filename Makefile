docker-build:
	docker build -t registry.rz1.metaways.net/devops/element:$$(git describe --tags) .
