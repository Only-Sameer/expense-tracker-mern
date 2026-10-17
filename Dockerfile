# Multi-stage image: compile the Vite frontend once, then use it for Nginx or the API image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY client ./client
COPY server ./server
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Production API image; no source maps or frontend dev dependencies are needed at runtime.
FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev
COPY --from=build /app/server ./server
EXPOSE 4000
CMD ["npm", "start", "--prefix", "server"]

# Nginx serves fingerprinted frontend assets and reverse-proxies requests to three API replicas.
FROM nginx:1.28-alpine AS web
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
