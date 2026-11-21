FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PF_PORT=8787 \
    PF_HOST=0.0.0.0 \
    PF_GUI=0 \
    PF_STATIC=0
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server ./server
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "server/index.mjs"]
