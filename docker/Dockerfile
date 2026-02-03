FROM nginx@sha256:6c9ab46b34b89274be77bf50253f97bf8f16eb11b98128d5694a8ae9b3efa2ed

LABEL maintainer="OpenCloud GmbH <devops@opencloud.eu>" \
  org.opencontainers.image.title="OpenCloud Web Extensions" \
  org.opencontainers.image.description="OpenCloud Web Extensions" \
  org.opencontainers.image.vendor="OpenCloud GmbH" \
  org.opencontainers.image.authors="OpenCloud GmbH" \
  org.opencontainers.image.licenses="AGPL-3.0" \
  org.opencontainers.image.documentation="https://github.com/opencloud-eu/web-extensions" \
  org.opencontainers.image.url="https://hub.docker.com/r/opencloudeu/web-extensions" \
  org.opencontainers.image.source="https://github.com/opencloud-eu/web-extensions"

ARG app_path
ARG app_name

RUN rm -f /usr/share/nginx/html/*

ADD $app_path /usr/share/nginx/html/$app_name
RUN find /usr/share/nginx/html

STOPSIGNAL SIGTERM

CMD ["nginx", "-g", "daemon off;"]
WORKDIR /usr/share/nginx/html