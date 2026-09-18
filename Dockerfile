FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p .grok && printf '%s' '{"VITE_AUTH_ENABLED":"false","deploy":{"database":true}}' > .grok/app-env.json
ENV VITE_AUTH_ENABLED=false
ENV NITRO_PRESET=node-server
RUN npm run build:server

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV VITE_AUTH_ENABLED=false
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0
ENV PORT=8080
ENV NITRO_PORT=8080
ENV PGLITE_DATA_DIR=/data/pglite
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
VOLUME /data
EXPOSE 8080
CMD ["node", "scripts/start-prod.mjs"]
