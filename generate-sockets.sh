#!/bin/bash

if (( $# != 2 )); then
    echo "Socket Group ID or Name are not provided"
    exit 2
fi

set -ex

SOCKET_GROUP_ID=$1
SOCKET_GROUP_NAME=$2

if [ -f ".env" ]; then
 export $(cat .env | xargs)
fi

# sockets code generation commands
SUDO="sudo"
COMMAND="docker run --name openapi-$SOCKET_GROUP_ID --rm -v ${PWD}:/local aitheon/openapi-generator-cli"
FOLDER_PREFIX="/local/"
if [[ $LIB_GENERATE_USE_NPM == "true" ]]; then
  echo "Using local java package to generate rest";
  SUDO=""
  COMMAND="java -jar /opt/openapi-generator-cli.jar"
  FOLDER_PREFIX=""
fi

# cleanup socket group
$SUDO rm -rf ./server/modules/sockets/generated/$SOCKET_GROUP_ID/*

$COMMAND generate --skip-validate-spec \
    -i ${FOLDER_PREFIX}server/modules/sockets/generated/$SOCKET_GROUP_ID-group-openapi.json \
    -g typescript-angular \
    -o ${FOLDER_PREFIX}server/modules/sockets/generated/$SOCKET_GROUP_ID/typescript \
    -D fileNaming=kebab-case \
    -D modelPropertyNaming=original \
    -D prependFormOrBodyParameters=true

$COMMAND generate --skip-validate-spec \
    -i ${FOLDER_PREFIX}server/modules/sockets/generated/$SOCKET_GROUP_ID-group-openapi.json \
    -g cpp-pistache-server \
    -o ${FOLDER_PREFIX}server/modules/sockets/generated/$SOCKET_GROUP_ID/cpp \
    -D modelPackage=aitheon.$SOCKET_GROUP_NAME \
    -D helpersPackage=aitheon.$SOCKET_GROUP_NAME

$COMMAND generate --skip-validate-spec \
    -i ${FOLDER_PREFIX}server/modules/sockets/generated/$SOCKET_GROUP_ID-group-openapi.json \
    -g python \
    -o ${FOLDER_PREFIX}server/modules/sockets/generated/$SOCKET_GROUP_ID/python \
    -D generateSourceCodeOnly=true