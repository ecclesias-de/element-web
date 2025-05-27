#!/bin/bash
set -x

if [ -z "$1" ]; then
    echo "needs username arg"
    exit
fi

response="$(curl -X POST https://matrix.local.tine-dev.de/_matrix/client/v3/register -d '{"username": "'$1'", "password": "ilovebananas"}')"
session=$(echo "$response" | jq '.session' -r)
curl -X POST https://matrix.local.tine-dev.de/_matrix/client/v3/register -d '{"username": "'$1'", "password": "ilovebananas", "auth": {"type": "m.login.dummy", "session": "'$session'"}}'