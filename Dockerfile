FROM node:22.20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY index.js .

EXPOSE 4071
CMD ["npm", "start"]