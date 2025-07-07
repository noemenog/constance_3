# Use an official Node runtime as a parent image
# FROM node:23-bullseye-slim AS build
FROM node:23-alpine AS build

#Argument to determine 'vite' build mode. default value 'dev' is set incase no value is passed in
ARG BUILD_MODE=debug
ENV BUILD_MODE=${BUILD_MODE:-debug}

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

# Build the React app
RUN npm run build-${BUILD_MODE:-debug}


# Use an official Nginx runtime as a parent image
FROM nginx:1.27.2-alpine

# Copy the ngnix.conf content into the container
COPY nginx.conf /etc/nginx/conf.d/default.conf
# COPY nginx.conf /etc/nginx/nginx.conf

# Copy the React app build files to the container (using "dist" folder besacuse thats where vite puts build files)
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for Nginx
EXPOSE 80

# Install nano
RUN apk add --update nano

# Start Nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]




# COPY --chown=airflow:root apt.conf /etc/apt/apt.conf
# # USER root

# RUN apk add --update nano

# RUN apt update -y
# RUN apt-get install -y --no-install-recommends nano 
# RUN apt-get autoremove -yqq --purge
# RUN apt-get clean
# RUN rm -rf /var/lib/apt/lists/*