# Shared source stage. Both Vite builds below (main + Nextcloud-embed) branch
# off this ONE stage instead of running back-to-back in a single stage, so
# BuildKit schedules them CONCURRENTLY — the embed build no longer adds its full
# duration to the wall clock (~104s → overlapped with the ~74s main build on a
# multi-core box). npm ci and the context copy still happen exactly once.
FROM node:22-alpine AS src

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --prefer-offline

# Copy source code
COPY . .

# Set API URL to empty so frontend uses relative paths (nginx will proxy)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build-time version metadata. CI passes ${{ github.sha }} so every deployment
# gets a unique, traceable version shown in the UI footer.
ARG VITE_BUILD_SHA=""
ENV VITE_BUILD_SHA=$VITE_BUILD_SHA

# OpenObserve RUM/browser-logs — baked at build time. The client token is passed
# via CI secret (prod build only); the rest have safe defaults so a plain
# `docker build` still produces a working image (RUM stays OFF when the token is
# empty). Placed before both `npm run build` invocations so the main and embed
# builds see them.
ARG VITE_OPENOBSERVE_ENABLE="true"
ARG VITE_OPENOBSERVE_CLIENT_TOKEN=""
ARG VITE_OPENOBSERVE_APPLICATION_ID="bee-flow-agent-hub"
ARG VITE_OPENOBSERVE_SITE="observe.beeflow.nl"
ARG VITE_OPENOBSERVE_ORG="default"
ARG VITE_OPENOBSERVE_SERVICE="agent-hub"
ARG VITE_OPENOBSERVE_ENV="production"
ARG VITE_OPENOBSERVE_REPLAY_SAMPLE_RATE="0"
ARG VITE_OPENOBSERVE_SESSION_SAMPLE_RATE="100"
ENV VITE_OPENOBSERVE_ENABLE=$VITE_OPENOBSERVE_ENABLE \
    VITE_OPENOBSERVE_CLIENT_TOKEN=$VITE_OPENOBSERVE_CLIENT_TOKEN \
    VITE_OPENOBSERVE_APPLICATION_ID=$VITE_OPENOBSERVE_APPLICATION_ID \
    VITE_OPENOBSERVE_SITE=$VITE_OPENOBSERVE_SITE \
    VITE_OPENOBSERVE_ORG=$VITE_OPENOBSERVE_ORG \
    VITE_OPENOBSERVE_SERVICE=$VITE_OPENOBSERVE_SERVICE \
    VITE_OPENOBSERVE_ENV=$VITE_OPENOBSERVE_ENV \
    VITE_OPENOBSERVE_REPLAY_SAMPLE_RATE=$VITE_OPENOBSERVE_REPLAY_SAMPLE_RATE \
    VITE_OPENOBSERVE_SESSION_SAMPLE_RATE=$VITE_OPENOBSERVE_SESSION_SAMPLE_RATE

# Bump Node heap; default ~2GB OOMs during Rollup chunk render.
ENV NODE_OPTIONS=--max-old-space-size=4096

# ── Main build ───────────────────────────────────────────────────────────────
FROM src AS build
RUN npm run build

# ── Embed-flavored second build (Nextcloud connector shell) ──────────────────
# The NC connector proxies its embedded SPA shell from this build at /embed/
# instead of baking its own copy, so a frontend deploy reaches the embedded
# view without a connector release. Build flags MUST match what the connector
# Dockerfile used to bake: VITE_API_URL + --base point at NC's signed-proxy
# path so every asset/API URL routes back through NC → connector. APP_ID is
# stable (bee_flow), so one build serves all tenants.
#
# Its own stage (branching off `src`, NOT off `build`) so BuildKit runs it in
# parallel with the main build instead of after it. That also isolates the sed
# rewrite below: it can no longer touch the tree the main build compiles from.
#
# BUILD_EMBED=false skips this entirely (dist-embed ends up empty) for fast
# local iteration when you don't need the NC-embedded shell fresh, e.g.:
#   docker build --build-arg BUILD_EMBED=false -t ... ./agent-hub
# Defaults to true so every existing build path (CI, scripts/build-images.sh,
# a plain `docker build` with no args) keeps producing a working /embed/ shell.
FROM src AS embed
ARG APP_ID=bee_flow
ARG BUILD_EMBED=true

# Hardcoded absolute asset paths (e.g. <img src="/bee-flow-logo.svg" />) bypass
# Vite's --base rewrite. Strip the leading slash so they resolve relative to the
# <base href> Vite injects (which routes through NC's proxy). Build into a
# SEPARATE outDir so the ref stays the same one the nginx stage copies.
RUN if [ "$BUILD_EMBED" = "true" ]; then \
        find . -path ./node_modules -prune -o \( -name '*.jsx' -o -name '*.js' -o -name '*.html' \) -print \
            | xargs sed -i \
                -e 's|src="/bee-flow-logo|src="bee-flow-logo|g' \
                -e 's|src="/BeeFlow-logo|src="BeeFlow-logo|g' \
                -e 's|href="/bee-flow-logo|href="bee-flow-logo|g' \
                -e 's|href="/BeeFlow-logo|href="BeeFlow-logo|g' \
                -e "s|'/bee-flow-logo|'bee-flow-logo|g" \
                -e "s|'/BeeFlow-logo|'BeeFlow-logo|g" \
        && VITE_API_URL=/index.php/apps/app_api/proxy/${APP_ID} \
           npm run build -- --base=/index.php/apps/app_api/proxy/${APP_ID}/ --outDir dist-embed ; \
    else \
        echo "BUILD_EMBED=false — skipping the embed-flavored build. This image will NOT serve a working Nextcloud connector /embed/ shell; only use this for fast local iteration on the main app." \
        && mkdir -p dist-embed ; \
    fi

# Sourcemaps export stage — CI extracts .map files from here as a build
# artifact for decoding minified stack traces. Maps never reach the nginx image.
FROM scratch AS sourcemaps
COPY --from=build /app/dist/assets/*.map /

# Production stage
FROM nginx:alpine

# Copy built assets and strip sourcemaps so they are never served to clients.
COPY --from=build /app/dist /usr/share/nginx/html
# Embed-flavored shell for the Nextcloud connector, served at /embed/ (see
# nginx.conf.template). The connector proxies its embedded SPA shell here.
COPY --from=embed /app/dist-embed /usr/share/nginx/html/embed
RUN find /usr/share/nginx/html -name '*.map' -type f -delete

# Copy custom nginx config template
# Nginx's docker entrypoint automatically runs envsubst on files in /templates
# and outputs them to /etc/nginx/conf.d/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Renders the template's variables even when the deployment's stack file has a
# stale (or missing) NGINX_ENVSUBST_FILTER — without this, adding a ${VAR} to
# the template crash-loops every EXISTING self-host that pulls a newer image.
# See the script header. `chmod` because git does not carry the exec bit on
# Windows and docker-entrypoint.sh silently IGNORES anything in
# /docker-entrypoint.d/ that is not executable.
# `sed` strips CRLF: docker-entrypoint.sh SOURCES this file into a `set -e`
# shell, where a line that is just \r is a command named \r — "line 26: : not
# found", exit 127, nginx never starts. .gitattributes pins the file to LF, but
# a build from a checkout made before that (or from a copy that went through a
# Windows editor) would still bake CRLF into the image, so normalise it here too.
COPY docker-entrypoint.d/18-beeflow-template-vars.envsh /docker-entrypoint.d/
RUN sed -i 's/\r$//' /docker-entrypoint.d/18-beeflow-template-vars.envsh \
 && chmod +x /docker-entrypoint.d/18-beeflow-template-vars.envsh

# DNS resolver for nginx's dynamic upstreams, defaulted to Docker's embedded
# DNS so `docker compose up` and every self-host keep working untouched.
# Kubernetes has no 127.0.0.11 — the Kapsule manifests override this with the
# CoreDNS ClusterIP. Given a value here it can never render as an empty
# `resolver ;`, which would stop nginx from starting at all.
ENV NGINX_RESOLVER=127.0.0.11

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
