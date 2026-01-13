# Stage 1: Build React (ใช้ Node เพื่อ compile)
FROM node:24-alpine as builder
WORKDIR /app

# Copy เฉพาะไฟล์ package เพื่อ install dependencies ก่อน (ใช้ Cache ได้)
COPY package*.json ./
RUN npm install

# Copy code ทั้งหมดและ Build
COPY . .
RUN npm run build
# หมายเหตุ: Vite จะได้โฟลเดอร์ output ชื่อ 'dist'

# Stage 2: Serve with Nginx (Production Environment)
FROM nginx:alpine
# ลบ config เดิมของ nginx
RUN rm /etc/nginx/conf.d/default.conf
# ใส่ config ใหม่ที่เราสร้างไว้
COPY nginx.conf /etc/nginx/conf.d/default.conf
# เอาไฟล์ที่ Build เสร็จจาก Stage 1 มาวาง
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]