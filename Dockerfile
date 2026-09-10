# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:20.19.0-bookworm-slim
ARG CADDY_IMAGE=caddy:2.10.2-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /workspace/vendor/toubkal

COPY vendor/toubkal/package.json vendor/toubkal/package-lock.json ./
RUN npm ci

COPY vendor/toubkal/ ./
RUN npm run build

# The production form is reverse-proxied under /cad/*. Inject a release-only
# base URL after the vendor build instead of modifying upstream source. This
# also makes direct editor/viewer route refreshes resolve JS/CSS/WASM from
# /cad/ rather than from a nested /cad/projects/<id>/ path.
RUN node -e "const fs=require('node:fs'); const p='dist/index.html'; const s=fs.readFileSync(p,'utf8'); if(!s.includes('<base ')){fs.writeFileSync(p,s.replace(/<head([^>]*)>/i,'<head$1><base href=\"/cad/\">'));}"

FROM ${CADDY_IMAGE} AS runtime
ENV XDG_CONFIG_HOME=/tmp/caddy-config
ENV XDG_DATA_HOME=/tmp/caddy-data

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/vendor/toubkal/dist /srv
COPY release/manifest.json /srv/asa-cad-release.json

USER 65534:65534
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/health/live"]
