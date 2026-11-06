# Stage 1: build the static bundle.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
# No package-lock.json is committed yet (see README) - `npm install`
# rather than `npm ci` until one exists; switch to `npm ci` once it's
# generated and committed, for reproducible builds.
RUN npm install

COPY . .

# Optional: only needed if the frontend is deployed SEPARATELY from the
# backend (different host/CDN). The default docker-compose.yml deployment
# doesn't set this - nginx.conf reverse-proxies /api to the backend
# container instead, so the app just uses its relative '/api' fallback
# (see src/api/client.js) and never needs an absolute URL baked in.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: serve the static bundle with nginx.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -qO- http://localhost:80/ > /dev/null || exit 1
