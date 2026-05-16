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

# Sourcemaps export stage — CI extracts .map files from here as a build
# artifact for decoding minified stack traces. Maps never reach the nginx image.
FROM scratch AS sourcemaps
COPY --from=build /app/dist/assets/*.map /

# Production stage
FROM nginx:alpine

# Copy built assets and strip sourcemaps so they are never served to clients.
COPY --from=build /app/dist /usr/share/nginx/html
RUN find /usr/share/nginx/html -name '*.map' -type f -delete

# Copy custom nginx config template
# Nginx's docker entrypoint automatically runs envsubst on files in /templates
# and outputs them to /etc/nginx/conf.d/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
