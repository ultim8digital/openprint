FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig*.json vite.config.ts index.html ./
COPY server ./server
COPY scripts ./scripts
COPY shared ./shared
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","build/server/index.js"]

# Optional native CAD runtime. The final/default stage below remains lightweight.
FROM runtime AS cad
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv libgl1 libglu1-mesa libglib2.0-0 libxrender1 libxext6 libsm6 \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/cad
COPY cad-worker/requirements.txt /tmp/cad-requirements.txt
RUN /opt/cad/bin/pip install --no-cache-dir -r /tmp/cad-requirements.txt \
    && rm /tmp/cad-requirements.txt
COPY cad-worker/cad.py cad-worker/worker.py cad-worker/LICENSE cad-worker/NOTICE.md ./cad-worker/
COPY cad-worker/examples ./cad-worker/examples
ENV CAD_PYTHON=/opt/cad/bin/python
USER node
RUN /opt/cad/bin/python /app/cad-worker/worker.py --check

FROM runtime AS standalone
