# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:20.19.0-bookworm-slim
ARG CADDY_IMAGE=caddy:2.10.2-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /workspace

# Keep the pinned Toubkal toolchain/dependencies vendored in one place. The
# product build resolves Rspack, Three and OpenCascade from this installation.
COPY vendor/toubkal/package.json vendor/toubkal/package-lock.json ./vendor/toubkal/
RUN npm --prefix vendor/toubkal ci

# ASA runtime still reuses isolated vendor CAD services (StableRef/OccConverter),
# but the shipped application entry is src/web — not the Toubkal product UI.
COPY vendor/toubkal/ ./vendor/toubkal/
COPY package.json tsconfig.json ./
COPY build/ ./build/
COPY src/ ./src/
COPY spec/ ./spec/

RUN npm run build:asa

# Production is mounted below /cad/*. Keep the product source mount-neutral and
# inject the deployment base only into the release HTML artifact.
RUN node -e "const fs=require('node:fs'); const p='dist/asa/index.html'; const s=fs.readFileSync(p,'utf8'); if(!s.includes('<base ')){fs.writeFileSync(p,s.replace(/<head([^>]*)>/i,'<head$1><base href=\"/cad/\">'));}"

FROM ${CADDY_IMAGE} AS runtime
ENV XDG_CONFIG_HOME=/tmp/caddy-config
ENV XDG_DATA_HOME=/tmp/caddy-data

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/dist/asa /srv
COPY release/manifest.json /srv/asa-cad-release.json

USER 65534:65534
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/health/live"]
