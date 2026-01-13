FROM node:24-alpine

WORKDIR /app

# ----------------------------------------------------
# 1. ติดตั้ง Chromium และ Font ภาษาไทย (สำคัญมากสำหรับ PDF)
# ----------------------------------------------------
# installs: chromium, thai fonts, and dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-thai

# บอก Puppeteer ว่า "ไม่ต้องโหลด Chrome มาเองนะ" (ให้ใช้ของที่เราลงข้างบน)
# ช่วยประหยัดเน็ตและลดขนาด Image ลงได้เยอะ
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ----------------------------------------------------

# Install Dependencies (Production)
COPY package*.json ./
RUN npm install --production

# Copy Source Code
COPY . .

EXPOSE 3002
CMD ["node", "server.js"]