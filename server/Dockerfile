# The sync server has no dependencies, so there is nothing to install — just
# copy the single module into a slim Node image and run it as a non-root user.
FROM node:24-alpine

WORKDIR /app
COPY package.json index.mjs ./

ENV PORT=3000 \
    DATA_DIR=/data

# The `node` user (uid 1000) ships with the image. /data is a mounted volume,
# so the rest of the filesystem can stay read-only.
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "index.mjs"]
