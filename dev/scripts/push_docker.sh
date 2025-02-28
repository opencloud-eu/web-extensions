#!/bin/bash

# Push the docker images for an application
# Usage: ./push_docker.sh <app_name> <app_version>
# Pre-requisites: Docker images were built and tagged before, see `build_docker.sh`

APP_NAME="$1"
APP_VERSION="$2"

if [ -z "$APP_NAME" ] || [ -z "$APP_VERSION" ]; then
  echo "Error: Please provide the app name and version"
  echo "Usage: ./push_docker.sh <app_name> <app_version>"
  exit 1
fi

docker push opencloudeu/web-extensions:$APP_NAME-latest
docker push opencloudeu/web-extensions:$APP_NAME-$APP_VERSION
docker push quay.io/opencloudeu/web-extensions:$APP_NAME-latest
docker push quay.io/opencloudeu/web-extensions:$APP_NAME-$APP_VERSION