FROM node:21

# Create a directory for the application's files
WORKDIR /usr/src/app

# Copy package information files to the image
COPY package.json ./ 

# Copy application file to the container
COPY server.js ./ 

# Expose port 80
EXPOSE 80

# Install dependencies via NPM
RUN npm install

# Start application when container is running
CMD ["node", "server.js"]
