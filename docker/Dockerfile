FROM busybox@sha256:b3255e7dfbcd10cb367af0d409747d511aeb66dfac98cf30e97e87e4207dd76f

ARG APP_PATH
ARG APP_NAME

LABEL maintainer="OpenCloud GmbH <devops@opencloud.eu>" \
  org.opencontainers.image.title="OpenCloud Web Extensions - $APP_NAME" \
  org.opencontainers.image.description="OpenCloud Web Extensions" \
  org.opencontainers.image.vendor="OpenCloud GmbH" \
  org.opencontainers.image.authors="OpenCloud GmbH" \
  org.opencontainers.image.licenses="AGPL-3.0" \
  org.opencontainers.image.documentation="https://github.com/opencloud-eu/web-extensions" \
  org.opencontainers.image.url="https://hub.docker.com/r/opencloudeu/web-extensions" \
  org.opencontainers.image.source="https://github.com/opencloud-eu/web-extensions"

ADD $APP_PATH /web/apps/$APP_NAME
# backwards compatibility: previous images used nginx and served from /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx && ln -s /web/apps /usr/share/nginx/html \
  && find /web/apps

WORKDIR /web/apps
