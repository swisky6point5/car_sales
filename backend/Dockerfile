FROM node:21

WORKDIR /usr/src/app

COPY package.json ./ 
COPY server.js ./ 
COPY views/ ./views/
COPY public/ ./public/

# Expose port 80
EXPOSE 80

# Install dependencies via NPM
RUN npm install
RUN npm install ejs

# Start application when container is running
CMD ["node", "server.js"]
