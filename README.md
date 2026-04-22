# ⚙️ Manufacturing Management System (MMS)

MMS is a next-generation industrial management portal designed for high-performance manufacturing environments. It features a sophisticated AI Voice Assistant, a high-graphics industrial product catalog, and a robust administrative suite.

## 🚀 Key Features

- **🎙️ MMS-AI Voice Assistant (Jarvis/Friday):** A hands-free, high-intelligence voice assistant powered by Google Gemini. Supports "Direct Talk" mode, bilingual interaction (English/Hindi), and professional personas.
- **📦 Advanced Product Catalog:** High-graphics product grid with 3D hover animations and automatic industrial category image mapping.
- **🏢 Admin Command Center:** Comprehensive dashboard for managing inventory, tracking employee attendance, and monitoring order pipelines.
- **🛡️ Accounts Center:** A Meta-style centralized hub for managing personal details, security settings, and payment methods.
- **📊 Real-time Analytics:** Track stock levels, manufacturing stages, and order fulfillment in real-time.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, Vanilla CSS3 (Mirror UI Glassmorphism), JavaScript (ES6+), Web Speech API.
- **Backend:** Node.js, Express.js.
- **Database:** MySQL.
- **Intelligence:** Google Gemini 1.5 Flash (via `@google/genai`).
- **Translations:** Google Translate API integration.

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- Node.js (v16+)
- MySQL Server

### 2. Database Setup
1. Create a database named `mms_db`.
2. Import the schemas located in the `/database` directory.
3. (Optional) Run `node alter_db.js` to apply latest updates.

### 3. Backend Configuration
1. Navigate to `/backend`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and configure your credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=mms_db
   JWT_SECRET=your_jwt_secret
   PORT=5000
   GEMINI_API_KEY=your_google_ai_studio_key
   ```

### 4. Running the Application
1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```
2. Open `frontend/index.html` in your browser (preferably via a local live server).

---

## 📂 Project Structure

- `/frontend`: Contains all UI assets, HTML pages, and client-side logic.
- `/backend`: Express server, API routes, and AI logic.
- `/database`: SQL schemas and migration scripts.

---

## 📄 License
This project is proprietary and built for MMS Industries.
