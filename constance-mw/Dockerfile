# Use an official Node runtime as a parent image
FROM node:23-alpine AS build

# Set proxy environment variables
ENV HTTP_PROXY="http://proxy-dmz.intel.com:912"
ENV HTTPS_PROXY="http://proxy-dmz.intel.com:912"
ENV NO_PROXY="intel.com,.intel.com,10.0.0.0/8,192.168.0.0/16,localhost,.local,127.0.0.0/8,134.134.0.0/16"


# Set the working directory to /app
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the app
RUN npm run build

# Expose port
EXPOSE 7000

# set node options environment variable
ENV NODE_OPTIONS="--max-old-space-size=16384"

# Install nano
RUN apk add --update nano

# Start the app when the container starts
CMD ["node", "dist/app.js"]