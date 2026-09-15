# Stage 1: Build Admin Dashboard
FROM node:20-alpine AS builder
WORKDIR /app/admin_dashboard
COPY admin_dashboard/package*.json ./
RUN npm ci
COPY admin_dashboard/ ./
RUN npm run build

# Stage 2: Nginx Web Server
FROM nginx:alpine
COPY --from=builder /app/admin_dashboard/dist /usr/share/nginx/html
COPY nginx-admin.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
