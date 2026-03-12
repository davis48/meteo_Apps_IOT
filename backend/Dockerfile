# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copie les manifestes et installe les dépendances de production
# --ignore-scripts évite les scripts post-install des paquets macOS
COPY package*.json ./
RUN npm install --omit=dev --omit=optional --ignore-scripts

# ── Runtime stage ─────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Métadonnées
LABEL org.opencontainers.image.title="meteo-backend"
LABEL org.opencontainers.image.description="API + WebSocket station météo IoT"

# Utilisateur non-root pour la sécurité
RUN addgroup -S app && adduser -S app -G app

# Copie les node_modules depuis le stage précédent
COPY --from=deps /app/node_modules ./node_modules

# Copie le code source
COPY src ./src
COPY package.json ./

# Dossier de données persistantes
RUN mkdir -p /app/data && chown -R app:app /app

USER app

EXPOSE 3002

# Healthcheck : vérifie que l'API répond
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
