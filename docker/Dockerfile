FROM nginx@sha256:8675d20d9cc26027c683501905b5da78ec3c7fc2a8d58d8d617e858e5fe97a93

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