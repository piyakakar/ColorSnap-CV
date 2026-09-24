# ColorSnap – Real-Time Handheld Object Color Detector

**ColorSnap** is an interactive, browser-based Computer Vision application that uses a webcam to detect and classify the dominant color of an object being held in the user's hand in real time.

Built with a **React + TypeScript** frontend, **Computer Vision (HSV color segmentation + Hand/Object tracking)**, a **Node.js/Express** backend, and **MongoDB** for logging detection history.

---

## 📸 Overview

When a user holds an object (e.g., a black TV remote, red bottle, blue pen, yellow sponge) in front of the webcam:
1. The camera captures continuous frames.
2. The Computer Vision engine tracks the hand and isolates the handheld object region.
3. Skin tones and neutral backgrounds are filtered out.
4. Pixels are converted from RGB to the **HSV color space** and classified into calibrated color bins.
5. A temporal stability smoothing filter prevents rapid flickering and computes a confidence score.
6. Meaningful detection events are automatically synchronized with the Express backend and persisted in MongoDB.

---

## ✨ Features

* 📷 **Real-Time Webcam Stream**: Live continuous frame capture with mirror/normal orientation.
* ✋ **Hand & Object Tracking**: Detects hand landmarks and dynamically locks onto the handheld object region.
* 🎨 **10 Color Classification**: Supports Red, Orange, Yellow, Green, Cyan, Blue, Purple, Pink, White, and Black across multiple shades (e.g., navy/light blue, dark/light green, crimson/scarlet).
* 🔬 **HSV Color Space Analysis**: Robust Hue, Saturation, and Value color segmentation rather than hardcoded RGB equality.
* 🛡️ **Skin Tone & Background Filtering**: Automatically discounts human skin pigments from object color calculation.
* 📊 **Temporal Stability & Confidence Indicator**: Smooths frame-to-frame jitter and provides real-time confidence metrics.
* 🗄️ **MongoDB Detection History**: Automatically records stable detection events with timestamps and confidence scores.
* ⚡ **Glassmorphism Dark Mode UI**: Modern, responsive interface with real-time color highlights, FPS counter, and status chips.

---

## 🎨 Supported Colors

The system classifies objects into **10 calibrated colors**:

1. **Red** (Crimson, Dark Red, Scarlet, Light Red)
2. **Orange** (Amber, Peach, Tangerine)
3. **Yellow** (Lemon, Gold, Sunflower)
4. **Green** (Lime, Forest, Emerald, Light Green)
5. **Cyan** (Aqua, Turquoise, Sky)
6. **Blue** (Navy, Royal Blue, Cobalt, Light Blue)
7. **Purple** (Violet, Indigo, Lavender)
8. **Pink** (Magenta, Rose, Hot Pink)
9. **White** (Bright, Cream, Off-white)
10. **Black** (Deep Black, Dark Gray, Charcoal)

---

## 🧠 How It Works

```text
       WEBCAM VIDEO FEED
               │
               ▼
      ✋ Hand & Landmark Tracking
               │
               ▼
    🎯 Held Object Region of Interest (ROI)
               │
               ▼
    🖐️ Skin-Tone & Background Filtering
               │
               ▼
    🌈 RGB → HSV Color Transformation
               │
               ▼
    📊 10-Color Histogram & Dominant Classification
               │
               ▼
    🛡️ Temporal Stability Window Filter
               │
               ▼
    ✨ Display Color + Confidence (e.g. "BLACK 94%")
               │
               ▼
    💾 Persist to MongoDB via Express REST API
```

---

## 📁 Project Structure

```text
ColorSnap/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── CameraView.tsx
│   │   │   ├── ResultPanel.tsx
│   │   │   ├── ColorPalette.tsx
│   │   │   └── HistoryList.tsx
│   │   ├── utils/
│   │   │   ├── colorDetector.ts     # HSV engine, skin filter, stability manager
│   │   │   └── handTracker.ts       # Hand tracking & object ROI calculation
│   │   ├── App.tsx                  # Main CV pipeline & state management
│   │   ├── main.tsx
│   │   ├── styles.css               # Modern dark mode glassmorphism UI
│   │   └── types.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/
│   ├── models/
│   │   └── Detection.js             # Mongoose Detection schema
│   ├── routes/
│   │   └── detectionRoutes.js       # REST API endpoints
│   ├── server.js                    # Express server entrypoint
│   └── package.json
│
├── README.md
├── .gitignore
└── package.json
```

---

## 🚀 Getting Started & Installation

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or newer)
* [MongoDB](https://www.mongodb.com/) (Optional: if MongoDB is not running, the backend seamlessly falls back to in-memory persistence)

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/ColorSnap.git
cd ColorSnap
```

### 2. Install Dependencies

Install dependencies for both backend and frontend:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Run the Backend Server

From the `backend` directory:

```bash
npm run dev
```

The Express API will be available at: `http://localhost:5000`

### 4. Run the Frontend Development Server

From the `frontend` directory:

```bash
npm run dev
```

The React frontend will be available at: `http://localhost:3000`

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health & MongoDB connection status |
| `GET` | `/api/detections` | Get the 30 most recent detection records |
| `POST` | `/api/detections` | Save a new detection event `{ color, confidence, hexCode }` |
| `DELETE` | `/api/detections` | Clear all recorded detections |

---

## 🧪 Testing Color Detections

1. Click **▶ Start Camera** and grant webcam permission.
2. Hold a colored item in your hand in front of the camera:
   * 📺 **Black remote / dark phone** → `BLACK`
   * 🔴 **Red bottle / mug** → `RED`
   * 🔵 **Blue pen / notebook** → `BLUE`
   * 🟢 **Green highlighter / card** → `GREEN`
   * 🟡 **Yellow sticky note / sponge** → `YELLOW`
   * 🟠 **Orange fruit / packaging** → `ORANGE`
   * 🟣 **Purple marker / folder** → `PURPLE`
   * 🌸 **Pink eraser / case** → `PINK`
   * 📄 **White paper / card** → `WHITE`
   * 🔷 **Cyan bottle cap / toy** → `CYAN`
3. Observe the live bounding box, confidence meter, highlighted palette swatch, and automatic MongoDB history logging.

---

## 📄 License

This project is licensed under the MIT License.
