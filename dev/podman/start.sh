#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
POD_NAME="opencloud-dev"
OC_IMAGE="docker.io/opencloudeu/opencloud-rolling:7.2.0"
TIKA_IMAGE="docker.io/apache/tika:3.3.1.0"

# If running inside a container where the repo is mounted at a different path,
# set REPO_HOST_PATH to the real host path of the repository.
REPO_HOST_PATH="${REPO_HOST_PATH:-$REPO_ROOT}"

CONFIG_DIR="$SCRIPT_DIR/config"
HOST_CONFIG_DIR="${REPO_HOST_PATH}/dev/podman/config"

# Detect host IP — override with OC_HOST env var
OC_HOST="${OC_HOST:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
OC_PORT="${OC_PORT:-9200}"
OC_URL="https://${OC_HOST}:${OC_PORT}"

echo "Repository:      $REPO_ROOT"
echo "Host mount path: $REPO_HOST_PATH"
echo "OpenCloud:       $OC_URL"
echo ""

# Clean up any previous run
podman pod exists "$POD_NAME" 2>/dev/null && {
  echo "Removing existing pod..."
  podman pod rm -f "$POD_NAME" >/dev/null
}

# Build extensions
echo "Building extensions..."
(cd "$REPO_ROOT" && pnpm build)

# Collect built extensions as volume mounts
APP_VOLUMES=()
for dist_dir in "$REPO_ROOT"/packages/web-app-*/dist; do
  app_name=$(basename "$(dirname "$dist_dir")")
  app_name="${app_name#web-app-}"
  host_dist="${REPO_HOST_PATH}/packages/web-app-${app_name}/dist"
  APP_VOLUMES+=(-v "$host_dist:/web/apps/$app_name:ro")
done

# Write config files with current host
echo "Configuring for $OC_URL..."
cat > "$CONFIG_DIR/idp.yaml" <<EOF
clients:
  - id: web
    name: OpenCloud web app
    application_type: web
    insecure: true
    trusted: true
    redirect_uris:
      - ${OC_URL}/
      - ${OC_URL}/oidc-callback.html
      - ${OC_URL}/oidc-silent-redirect.html
    origins:
      - ${OC_URL}
EOF

cat > "$CONFIG_DIR/web.config.json" <<EOF
{
  "server": "${OC_URL}",
  "theme": "${OC_URL}/themes/opencloud/theme.json",
  "openIdConnect": {
    "metadata_url": "${OC_URL}/.well-known/openid-configuration",
    "authority": "${OC_URL}",
    "client_id": "web",
    "response_type": "code",
    "scope": "openid profile email"
  },
  "apps": ["files", "text-editor", "pdf-viewer", "search", "external", "admin-settings"]
}
EOF

cat > "$CONFIG_DIR/apps.yaml" <<EOF
importer:
  config:
    companionUrl: '${OC_URL}/companion'
EOF

# Create pod
echo "Creating pod..."
podman pod create --name "$POD_NAME" -p "${OC_PORT}:9200"

# Start Tika
echo "Starting Tika..."
podman run -d --pod "$POD_NAME" --name opencloud-tika "$TIKA_IMAGE" >/dev/null

# Start OpenCloud
echo "Starting OpenCloud..."
podman run -d --pod "$POD_NAME" --name opencloud-main \
  --entrypoint /bin/sh \
  -v "$HOST_CONFIG_DIR/idp.yaml:/etc/opencloud/idp.yaml:ro" \
  -v "$HOST_CONFIG_DIR/web.config.json:/web/config.json:ro" \
  -v "$HOST_CONFIG_DIR/apps.yaml:/etc/opencloud/apps.yaml:ro" \
  -v "$HOST_CONFIG_DIR/csp.yaml:/etc/opencloud/csp.yaml:ro" \
  "${APP_VOLUMES[@]}" \
  -e "OC_URL=${OC_URL}" \
  -e OC_INSECURE=true \
  -e OC_LOG_LEVEL=error \
  -e IDM_CREATE_DEMO_USERS=true \
  -e IDM_ADMIN_PASSWORD=admin \
  -e PROXY_ENABLE_BASIC_AUTH=true \
  -e PROXY_TLS=true \
  -e PROXY_HTTP_ADDR=0.0.0.0:9200 \
  -e PROXY_CSP_CONFIG_FILE_LOCATION=/etc/opencloud/csp.yaml \
  -e WEB_ASSET_APPS_PATH=/web/apps \
  -e WEB_UI_CONFIG_FILE=/web/config.json \
  -e SEARCH_EXTRACTOR_TYPE=tika \
  -e SEARCH_EXTRACTOR_TIKA_TIKA_URL=http://localhost:9998 \
  -e SEARCH_EXTRACTOR_CS3SOURCE_INSECURE=true \
  "$OC_IMAGE" \
  -c 'opencloud init || true && opencloud server' >/dev/null

# Wait for startup
echo -n "Waiting for OpenCloud to start"
for i in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "${OC_URL}/" 2>/dev/null || echo "000")
  if [ "$code" != "000" ]; then
    echo " ready!"
    echo ""
    echo "========================================="
    echo " OpenCloud is running at ${OC_URL}"
    echo " Login: admin / admin"
    echo "========================================="
    echo ""
    echo " Logs:  podman pod logs -f ${POD_NAME}"
    echo " Stop:  podman pod stop ${POD_NAME}"
    echo " Clean: podman pod rm -f ${POD_NAME}"
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo " timeout (may still be starting)"
echo "Check: podman logs opencloud-main"
