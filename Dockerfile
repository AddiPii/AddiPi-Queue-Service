FROM node:22.20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install


COPY . .

EXPOSE 3070

CMD ["npm", "start"]