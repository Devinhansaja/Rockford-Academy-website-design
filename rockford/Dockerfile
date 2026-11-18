# Production image for Coolify / any Docker host. No npm install: the app uses Node built-ins only.
# Persistent data: mount volumes at /app/storage (database, CVs, backups, outbox) and /app/public/uploads (images, flyers).

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=storage TRUST_PROXY=true COOKIE_SECURE=true
COPY --chown=node:node . .
RUN mkdir -p storage public/uploads && chown -R node:node storage public/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]
