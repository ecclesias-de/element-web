#!/bin/sh

docker run --rm -p 8081:80 -v $(pwd)/iframe.html:/usr/share/nginx/html/index.html nginx
