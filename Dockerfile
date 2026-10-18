FROM node:20-alpine
WORKDIR /app

# get the latest security fixes for the system packages
RUN apk upgrade --no-cache

# install only the packages needed to run the app
COPY package*.json ./
RUN npm ci --omit=dev

# npm is only needed to install packages, not to run the app
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY server.js ./
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds

# the node image already has a non-root user called "node"
USER node

EXPOSE 3000
CMD ["node", "server.js"]
