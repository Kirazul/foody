FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/user/package.json ./services/user/
COPY services/order/package.json ./services/order/
COPY services/delivery/package.json ./services/delivery/
RUN npm install --workspaces --ignore-scripts
COPY proto/ ./proto/
COPY gateway/ ./gateway/
COPY services/ ./services/
