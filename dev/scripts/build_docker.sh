#!/bin/bash

# Build the docker image for an application
# Usage: ./build_docker.sh <app_name> <app_version>
# Pre-requisites: App was built before and lies in `/apps/<app_name>`, see `build_app.sh`

APP_NAME="$1"
APP_VERSION="$2"

if [ -z "$APP_NAME" ] || [ -z "$APP_VERSION" ]; then
  echo "Error: Please provide the app name and version"
  echo "Usage: ./build_docker.sh <app_name> <app_version>"
  exit 1
fi

if [ ! -d "./apps/$APP_NAME" ]; then
  echo "Error: App not found at ./apps/$APP_NAME"
  echo "Please build the app first using ./build_app.sh"
  echo "and make sure to run this script from the repository root"
  exit 1
fi

docker buildx rm web-extensions-builder || true
docker buildx create --name web-extensions-builder --platform linux/arm64,linux/amd64
docker buildx use web-extensions-builder
docker buildx build --platform linux/arm64,linux/amd64 --output type=docker --file ./docker/Dockerfile --build-arg app_path=apps/$APP_NAME --build-arg app_name=$APP_NAME --tag opencloudeu/web-extensions:$APP_NAME-latest --tag opencloudeu/web-extensions:$APP_NAME-$APP_VERSION --tag quay.io/opencloudeu/web-extensions:$APP_NAME-latest --tag quay.io/opencloudeu/web-extensions:$APP_NAME-$APP_VERSION .
docker buildx rm web-extensions-builder