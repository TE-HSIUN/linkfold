FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY index.js ./
COPY src ./src
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
