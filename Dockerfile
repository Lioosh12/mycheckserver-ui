FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY deploy/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY deploy/ .

EXPOSE 8080

CMD ["npm", "start"]
