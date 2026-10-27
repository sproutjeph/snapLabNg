# Build stage: install and build the web app.
FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/rules/package.json packages/rules/package.json
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --filter @snaplab/web build

# Run stage: the API serves the built web app from the same origin.
FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV PORT=8080 NODE_ENV=production
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build /app/packages/rules/node_modules ./packages/rules/node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/package.json ./package.json
# No USER: the entrypoint starts as root so it can chown the root-owned Fly
# volume at /data, then drops to bun (uid 1000) via setpriv before exec.
RUN printf '%s\n' '#!/bin/sh' 'set -e' 'if [ "$(id -u)" = "0" ]; then' '  mkdir -p /data' '  chown bun:bun /data' '  exec setpriv --reuid=bun --regid=bun --clear-groups "$@"' 'fi' 'exec "$@"' > /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
EXPOSE 8080
CMD ["bun", "apps/api/src/index.ts"]
