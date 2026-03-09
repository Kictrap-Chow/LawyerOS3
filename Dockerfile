# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with Node.js
FROM node:18-alpine

WORKDIR /app

# Copy built assets from builder stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.js ./

# Install production dependencies (express, etc.)
RUN npm install --production

# Create data directory
RUN mkdir data

EXPOSE 3000

CMD ["node", "server.js"]
