# --- build ---------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Copy manifests first so the dependency layer is cached across source edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- serve ---------------------------------------------------------------
FROM nginx:1.27-alpine AS serve

# Replace the whole main config: it redirects the pid file and every temp path
# to /tmp, so the container needs exactly one writable tmpfs at runtime and can
# otherwise run with a read-only root filesystem. See docker/nginx.conf.
COPY docker/nginx.conf /etc/nginx/nginx.conf

# The build output is world-readable (root-owned, mode 644/755), which is all
# the non-root worker needs to serve it — no chown required.
COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine ships an unprivileged `nginx` user (uid 101); run as it so the
# default `docker run` is non-root even without --user.
USER nginx

EXPOSE 8080

# BusyBox wget from the alpine base; hits the same port nginx listens on.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
