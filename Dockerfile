# Build stage
FROM node:20-alpine AS build

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

# Build the app
RUN npm run build

# Strip .map files from the image. Sourcemaps are generated via
# vite build.sourcemap:'hidden' for CI artifact upload (see workflow), but
# must never be served to clients.
RUN find /app/dist -name '*.map' -type f -delete

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config template
# Nginx's docker entrypoint automatically runs envsubst on files in /templates
# and outputs them to /etc/nginx/conf.d/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
