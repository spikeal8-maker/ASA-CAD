# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:20.19.0-bookworm-slim
ARG CADDY_IMAGE=caddy:2.10.2-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /workspace/vendor/toubkal

COPY vendor/toubkal/package.json vendor/toubkal/package-lock.json ./
RUN npm ci

COPY vendor/toubkal/ ./
RUN npm run build

FROM ${CADDY_IMAGE} AS runtime
ENV XDG_CONFIG_HOME=/tmp/caddy-config
ENV XDG_DATA_HOME=/tmp/caddy-data

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/vendor/toubkal/dist /srv

USER 65534:65534
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/health/live"]
