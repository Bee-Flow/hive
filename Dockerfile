# Build stage
FROM node:22-alpine AS build

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

# Build the app — bump Node heap; default ~2GB OOMs during Rollup chunk render.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# ── Embed-flavored second build (Nextcloud connector shell) ──────────────────
# The NC connector proxies its embedded SPA shell from this build at /embed/
# instead of baking its own copy, so a frontend deploy reaches the embedded
# view without a connector release. Build flags MUST match what the connector
# Dockerfile used to bake: VITE_API_URL + --base point at NC's signed-proxy
# path so every asset/API URL routes back through NC → connector. APP_ID is
# stable (bee_flow), so one build serves all tenants. Costs a second Vite
# build (~minutes) in CI.
ARG APP_ID=bee_flow

# Hardcoded absolute asset paths (e.g. <img src="/bee-flow-logo.svg" />) bypass
# Vite's --base rewrite. Strip the leading slash so they resolve relative to the
# <base href> Vite injects (which routes through NC's proxy). Done AFTER the
# main build so it can't affect it.
RUN find . -path ./node_modules -prune -o \( -name '*.jsx' -o -name '*.js' -o -name '*.html' \) -print \
    | xargs sed -i \
        -e 's|src="/bee-flow-logo|src="bee-flow-logo|g' \
        -e 's|src="/BeeFlow-logo|src="BeeFlow-logo|g' \
        -e 's|href="/bee-flow-logo|href="bee-flow-logo|g' \
        -e 's|href="/BeeFlow-logo|href="BeeFlow-logo|g' \
        -e "s|'/bee-flow-logo|'bee-flow-logo|g" \
        -e "s|'/BeeFlow-logo|'BeeFlow-logo|g"

# Build into a SEPARATE outDir so the main dist/ (copied to the nginx root
# below) stays intact.
RUN VITE_API_URL=/index.php/apps/app_api/proxy/${APP_ID} \
    npm run build -- --base=/index.php/apps/app_api/proxy/${APP_ID}/ --outDir dist-embed

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
COPY --from=build /app/dist-embed /usr/share/nginx/html/embed
RUN find /usr/share/nginx/html -name '*.map' -type f -delete

# Copy custom nginx config template
# Nginx's docker entrypoint automatically runs envsubst on files in /templates
# and outputs them to /etc/nginx/conf.d/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
