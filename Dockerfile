FROM node:20-alpine
WORKDIR /app

# install only the packages needed to run the app
COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds

# the node image already has a non-root user called "node"
USER node

EXPOSE 3000
CMD ["node", "server.js"]
