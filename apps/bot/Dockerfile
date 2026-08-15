FROM node:22.19.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:bot

FROM node:22.19.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
USER node
CMD ["node", "apps/bot/dist/index.js"]
