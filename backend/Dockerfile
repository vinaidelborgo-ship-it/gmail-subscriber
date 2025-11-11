# ---- Gmail Subscriber Backend (Node.js) ----
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["npm","start"]