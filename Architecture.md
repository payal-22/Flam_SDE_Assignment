# Architecture Documentation

This document explains how I built the real-time collaborative canvas and the technical decisions I made along the way.

---

## 📊 Data Flow: How Drawing Events Work

### The Simple Version

When you draw something, here's what happens:

```
1. You move your mouse
   ↓
2. Canvas draws the line immediately (so it feels fast)
   ↓
3. Your browser sends the coordinates to the server
   ↓
4. Server sends it to everyone else in your room
   ↓
5. Their browsers draw the same line
```

### Why I Draw Locally First

I tried two approaches:

**First attempt (Bad):**
- User draws → Send to server → Wait for response → Draw on canvas
- Problem: 100ms delay made it feel super laggy

**Final approach (Good):**
- User draws → Draw immediately → Send to server in background
- Result: Feels instant! No waiting.

### Visual Flow Diagram

```
YOUR BROWSER
    │
    ├─→ [You draw] → Canvas updates (instant!)
    │
    └─→ Send coordinates to server
            │
            ▼
        SERVER
            │
            ├─→ Broadcast to User 2
            ├─→ Broadcast to User 3
            └─→ Broadcast to User 4
                    │
                    ▼
            THEIR BROWSERS
                    │
                    └─→ Draw the same thing
```

---

## 🔌 WebSocket Messages

I use Socket.IO to send these messages between browsers and server:

### 1. Joining a Room

**When you click "Join Room":**
```javascript
// Your browser sends:
{ 
  roomId: "test-room",
  username: "Alice",
  color: "#FF5733"  // Random color for your cursor
}

// Server replies with:
{
  users: ["Alice", "Bob", "Charlie"]  // Everyone in the room
}
```

### 2. Drawing Events

**When you draw with brush:**
```javascript
// Mouse down - starting a stroke:
{
  type: "start",
  x: 150,
  y: 200,
  color: "#000000",
  brushSize: 3
}

// Mouse moving - continuing the stroke:
{
  type: "draw",
  x: 155,
  y: 205,
  color: "#000000",
  brushSize: 3
}
```

**When you draw a shape (like rectangle):**
```javascript
{
  type: "shape",
  shape: "rectangle",
  startX: 100,
  startY: 100,
  endX: 300,
  endY: 200,
  color: "#FF0000",
  brushSize: 2
}
```

### 3. Adding Text

```javascript
{
  text: "Hello World",
  x: 100,
  y: 150,
  color: "#FF0000",
  fontSize: 24
}
```

### 4. Uploading Images

```javascript
{
  imageData: "data:image/png;base64,iVBORw0KG...",  // Image as base64
  x: 200,
  y: 100,
  width: 300,
  height: 200
}
```

### 5. Cursor Position

```javascript
// Sent every 50ms when you move your mouse:
{
  x: 450,
  y: 320
}

// Server adds your info and sends to others:
{
  userId: "abc123",
  username: "Alice",
  color: "#FF5733",
  x: 450,
  y: 320
}
```

---

## ↩️ Undo/Redo: How I Handle It

### My Approach:

After every stroke, I save the entire canvas as an image:

```javascript
function saveToHistory() {
  // Convert canvas to a base64 image
  const screenshot = canvas.toDataURL();
  
  // Add to history array
  history.push(screenshot);
  
  // Limit to last 50 (to avoid crashing)
  if (history.length > 50) {
    history.shift();  // Remove oldest
  }
}

function undo() {
  // Go back one step
  historyStep--;
  
  // Load that screenshot
  const oldImage = new Image();
  oldImage.src = history[historyStep];
  
  // Draw it on canvas
  ctx.clearCanvas();
  ctx.drawImage(oldImage, 0, 0);
}
```

### Why This Approach?

**Pros:**
- Super simple to implement
- Works with any drawing (brush, shapes, text, images)
- Easy to understand

**Cons:**
- Each screenshot is ~2MB (lots of memory)
- Only works on your own computer (doesn't sync to others)
- Limited to 50 undos (to prevent browser crash)

### Why Undo Doesn't Sync to Other Users

**The problem:** Imagine this scenario:

```
10:00:00 - Alice draws a red circle
10:00:01 - Bob draws a blue square
10:00:02 - Charlie draws a green line
10:00:03 - Alice presses UNDO
```

**What should happen?**
- Remove only Alice's circle? (Bob and Charlie's stuff stays)
- Remove the green line? (Last thing drawn by anyone)
- Remove everything Alice ever drew?
  
## ⚡ Performance: Why I Made These Choices

### Problem 1: Too Many Messages

**What I discovered:**
- Mouse moves 100+ times per second when drawing
- If I send every movement, that's 100 messages/second
- With 10 users = 1,000 messages/second
- Server crashed!

**My solution: Throttling**
```javascript
let lastSentTime = 0;

function onMouseMove(x, y) {
  const now = Date.now();
  
  // Only send if 16ms passed (60 times per second)
  if (now - lastSentTime > 16) {
    socket.emit('draw', { x, y });
    lastSentTime = now;
  }
}
```

**Result:** 
- 60 messages/second (still smooth)
- 40% less network traffic
- Server doesn't crash

### Problem 2: Memory Explosion

**First version:**
```javascript
// Saved every single drawing action
history.push(canvas.toDataURL());

// After 5 minutes of drawing:
// 200 strokes × 2MB each = 400MB memory
// Browser crashed!
```

**My fix:**
```javascript
const MAX_HISTORY = 50;

if (history.length > MAX_HISTORY) {
  history.shift();  // Remove oldest one
}
```

**Trade-off:**
- Can only undo last 50 actions
- But browser doesn't crash
- 50 is enough for most people

### Problem 3: Large Image Uploads

**What happened:**
- User uploaded 10MB photo
- Converting to base64 = 13MB string
- Sending to 5 other users = 65MB network traffic
- Everyone's browser froze

**My fix:**
```javascript
// Check file size before uploading
if (file.size > 2 * 1024 * 1024) {  // 2MB limit
  alert("Image too large! Keep it under 2MB");
  return;
}

// Also resize image if it's too big
if (width > 400) {
  height = (height * 400) / width;
  width = 400;
}
```

### Problem 4: Shape Preview Lag

**First attempt:**
When drawing a rectangle, I did this on every mouse move:
```javascript
// Clear entire canvas
ctx.clearRect(0, 0, width, height);

// Redraw everything from history
history.forEach(item => redraw(item));

// Draw preview rectangle
ctx.strokeRect(startX, startY, currentX, currentY);
```

**Problem:** Redrawing everything 60 times per second = super slow!

**My solution: Two canvases**
```html
<!-- Main canvas: permanent drawings -->
<canvas ref={mainCanvas}></canvas>

<!-- Preview canvas: temporary shapes (on top) -->
<canvas ref={previewCanvas} style="position: absolute"></canvas>
```

```javascript
// Mouse move: Only clear preview canvas
previewCtx.clearRect(0, 0, width, height);
previewCtx.strokeRect(startX, startY, currentX, currentY);

// Main canvas never touched = stays fast!
```

---

## 🔄 Conflict Resolution: Simultaneous Drawing

### What Happens When Two People Draw at Once?

**Example:**
```
10:00:00.000 - Alice draws red line at x=100
10:00:00.050 - Bob draws blue circle at x=100
```

**My approach: Let both happen**

```
Alice's browser:
  - Draws red line immediately
  - Sends to server
  - Receives Bob's circle
  - Draws blue circle on top

Bob's browser:
  - Draws blue circle immediately
  - Sends to server
  - Receives Alice's red line
  - Draws red line on top
```

**Result:** They see different things! 

Alice sees: Red line → Blue circle
Bob sees: Blue circle → Red line

### Why This Happens

The server just forwards messages in the order it receives them. Network timing is random.

```
SERVER:
  Receives Alice's event at 10:00:00.023
  Receives Bob's event at 10:00:00.019
  
  Sends Bob's first (it arrived first)
  Then sends Alice's
```

### When This Is Fine

**Most of the time it doesn't matter:**
- Drawing in different areas
- Different colors
- Small timing differences

### When This Breaks

**1. Drawing on exact same spot:**
```
Alice: Writes "Hello" at x=100, y=100
Bob: Writes "Goodbye" at x=100, y=100
Result: Text overlaps, unreadable mess
```

**2. Eraser timing issues:**
```
Alice draws a circle
Bob erases that spot
Network lag: Circle arrives AFTER erase command
Result: Circle magically appears after being "erased"
```

**3. Clear canvas problems:**
```
Alice draws complex picture
Bob clicks "Clear All"
Alice's last stroke is still in-flight
Result: Cleared canvas with one random stroke on it
```





---

