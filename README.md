# Real-Time Collaborative Drawing Canvas

A real-time multi-user drawing application where multiple users can draw simultaneously on a shared canvas using WebSockets.
Try it Out ---> https://flam-sde-assignment.vercel.app/
---

##  What This Does

- Multiple people can draw on the same canvas at the same time
- See other users' cursors and drawings in real-time
- Works on desktop and mobile (touch support)
- Different rooms for different groups
- Save, load, and download your drawings

---

##  Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm (comes with Node.js)

### Step 1: Install and Run Backend

```bash
cd server
npm install
npm start
```

The server will start at `http://localhost:5000`

### Step 2: Install and Run Frontend

Open a **new terminal window** and run:

```bash
cd client
npm install
npm start
```

The app will open at `http://localhost:3000`

---

##  How to Test with Multiple Users

### Option 1: Same Computer
1. Open `http://localhost:3000` in Chrome
2. Enter your name: **Alice**
3. Enter room ID: **test-room**
4. Click "Join Room"
5. Open `http://localhost:3000` in **Firefox** (or incognito Chrome)
6. Enter your name: **Bob**
7. Enter room ID: **test-room** (same as Alice)
8. Click "Join Room"
9. Draw in one window → it appears in the other instantly!

### Option 2: Different Computers (Same WiFi)
1. Find your computer's IP address:
   - Windows: Run `ipconfig` in CMD, look for IPv4 Address
   - Mac/Linux: Run `ifconfig` or `ip addr`, look for inet address
2. On Computer 1: Open `http://YOUR-IP:3000`
3. On Computer 2: Open `http://YOUR-IP:3000`
4. Both join the same room ID

---

##  Features

### Drawing Tools
- **Brush** - Freehand drawing
- **Eraser** - Remove parts of drawing
- **Line** - Draw straight lines
- **Rectangle** - Draw rectangles
- **Circle** - Draw circles
- **Triangle** - Draw triangles
- **Arrow** - Draw arrows
- **Star** - Draw stars

### Other Features
- **Text Tool** - Add text anywhere
- **Image Upload** - Upload and place images (max 2MB)
- **Colors** - 10 preset colors + custom color picker
- **Undo/Redo** - Fix mistakes (keeps last 50 actions)
- **Save/Load** - Save to browser storage
- **Download** - Export as PNG image
- **User Cursors** - See where others are drawing

---

## 🐛 Known Limitations & Bugs

### Performance Issues
1. **Slow with 10+ users** - Too many drawing events at once
2. **Large images lag** - Keep images under 1MB for best performance
3. **Undo/redo only works locally** - Doesn't sync to other users

### Missing Features
1. **No authentication** - Anyone can join any room
2. **Drawings don't persist** - Refresh = lose everything (except saved to localStorage)
3. **Can't edit shapes** - Once drawn, can't move or resize
4. **No layers** - Everything on one layer

### Known Bugs
1. **Mobile eraser** - Sometimes doesn't work on first touch (touch again)
2. **Very long text** - Might go off-canvas
3. **Slow internet** - Drawings might appear delayed
4. **Room cleanup** - Empty rooms stay in server memory until restart

### What Would Break It
- Uploading 10MB images
- 50+ users in one room
- Drawing while disconnected (lost forever)
- Special characters in room names might cause issues

---

##  Time Spent on Project

**Total Time: ~12-15 hours**

Breakdown:
- **Basic canvas setup** - 2 hours
- **WebSocket integration** - 3 hours
- **Drawing tools (shapes, text, images)** - 4 hours
- **Bug fixes and testing** - 2 hours
- **UI/UX improvements** - 2 hours
- **Documentation** - 1 hour

---

##  Project Structure

```
collaborative-canvas/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── Canvas.jsx   # Main drawing component
│   │   ├── hooks/
│   │   │   └── useWebSocket.js  # WebSocket logic
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
└── server/                  # Node.js backend
    ├── src/
    │   └── server.js        # Express + Socket.IO server
    └── package.json
```

---


