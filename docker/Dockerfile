FROM busybox@sha256:dc2d74b28e4cf8984fa52af1f39bc7c3d9c73760b41a74d629f5d11b1ab28616

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
RUN mkdir -p /usr/share/nginx/html && ln -s /web/apps /usr/share/nginx/html/apps \
  && find /web/apps

WORKDIR /web/apps
