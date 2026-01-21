import React, { useRef, useState, useEffect } from 'react';
import { 
  Paintbrush, Eraser, Undo, Redo, Trash2, Users, Wifi, WifiOff,
  Square, Circle, Triangle, ArrowRight, Star, Type, Image as ImageIcon,
  Download, Save, Upload, Minus, Droplet
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

const Canvas = () => {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [username, setUsername] = useState('');
  const [fps, setFps] = useState(60);
  const [startPos, setStartPos] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [fontSize, setFontSize] = useState(24);
  const [showTextInput, setShowTextInput] = useState(false);
  
  const { 
    socket, 
    connected, 
    users, 
    cursors, 
    latency,
    joinRoom,
    sendDrawEvent,
    sendCursorMove,
    saveCanvasState,
    loadCanvasState
  } = useWebSocket(roomId);

  const lastFrameTime = useRef(Date.now());

  // Predefined colors
  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    
    if (!canvas || !previewCanvas) return;
    
    const ctx = canvas.getContext('2d');
    const previewCtx = previewCanvas.getContext('2d');
    
    if (!ctx || !previewCtx) return;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    previewCtx.lineCap = 'round';
    previewCtx.lineJoin = 'round';

    // Save initial state
    saveToHistory();

    // FPS counter
    const fpsInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastFrameTime.current;
      setFps(Math.round(1000 / delta));
      lastFrameTime.current = now;
    }, 1000);

    return () => clearInterval(fpsInterval);
  }, [hasJoinedRoom]);

  // Listen for remote drawing events
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDraw = (data) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.brushSize;
      ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';

      if (data.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else if (data.type === 'draw') {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      } else if (data.type === 'shape') {
        drawShape(ctx, data.shape, data.startX, data.startY, data.endX, data.endY, data.color, data.brushSize);
      }
    };

    const handleRemoteText = (data) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawText(ctx, data.text, data.x, data.y, data.color, data.fontSize);
      saveToHistory();
    };

    const handleRemoteImage = (data) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, data.x, data.y, data.width, data.height);
        saveToHistory();
      };
      img.src = data.imageData;
    };

    socket.on('draw', handleRemoteDraw);
    socket.on('draw-text', handleRemoteText);
    socket.on('draw-image', handleRemoteImage);
    socket.on('clear-canvas', handleClearCanvas);
    socket.on('canvas-state', (state) => {
      if (state) {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          saveToHistory();
        };
        img.src = state;
      }
    });

    return () => {
      socket.off('draw', handleRemoteDraw);
      socket.off('draw-text', handleRemoteText);
      socket.off('draw-image', handleRemoteImage);
      socket.off('clear-canvas', handleClearCanvas);
      socket.off('canvas-state');
    };
  }, [socket]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(canvas.toDataURL());
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const drawShape = (ctx, shape, startX, startY, endX, endY, shapeColor, lineWidth) => {
    ctx.strokeStyle = shapeColor;
    ctx.lineWidth = lineWidth;
    ctx.globalCompositeOperation = 'source-over';
    
    const width = endX - startX;
    const height = endY - startY;

    ctx.beginPath();
    
    switch(shape) {
      case 'rectangle':
        ctx.rect(startX, startY, width, height);
        break;
      case 'circle':
        const radius = Math.sqrt(width * width + height * height);
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        break;
      case 'line':
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        break;
      case 'triangle':
        ctx.moveTo(startX + width / 2, startY);
        ctx.lineTo(startX, startY + height);
        ctx.lineTo(startX + width, startY + height);
        ctx.closePath();
        break;
      case 'arrow':
        const headlen = 20;
        const angle = Math.atan2(height, width);
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
        break;
      case 'star':
        const centerX = startX + width / 2;
        const centerY = startY + height / 2;
        const outerRadius = Math.min(Math.abs(width), Math.abs(height)) / 2;
        const innerRadius = outerRadius / 2;
        const spikes = 5;
        let rot = Math.PI / 2 * 3;
        let x = centerX;
        let y = centerY;
        const step = Math.PI / spikes;

        ctx.moveTo(centerX, centerY - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = centerX + Math.cos(rot) * outerRadius;
          y = centerY + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;

          x = centerX + Math.cos(rot) * innerRadius;
          y = centerY + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(centerX, centerY - outerRadius);
        ctx.closePath();
        break;
    }
    
    ctx.stroke();
  };

  const drawText = (ctx, text, x, y, textColor, textSize) => {
    ctx.fillStyle = textColor;
    ctx.font = `${textSize}px Arial`;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillText(text, x, y);
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);

    if (tool === 'text') {
      setTextPosition(coords);
      setShowTextInput(true);
      return;
    }

    if (['rectangle', 'circle', 'line', 'triangle', 'arrow', 'star'].includes(tool)) {
      setStartPos(coords);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    sendDrawEvent({
      type: 'start',
      x: coords.x,
      y: coords.y,
      color,
      brushSize,
      tool
    });
  };

  const draw = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);

    sendCursorMove(coords.x, coords.y);

    if (!isDrawing) return;

    if (['rectangle', 'circle', 'line', 'triangle', 'arrow', 'star'].includes(tool)) {
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas) return;
      
      const previewCtx = previewCanvas.getContext('2d');
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      drawShape(previewCtx, tool, startPos.x, startPos.y, coords.x, coords.y, color, brushSize);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    sendDrawEvent({
      type: 'draw',
      x: coords.x,
      y: coords.y,
      color,
      brushSize,
      tool
    });
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    
    if (['rectangle', 'circle', 'line', 'triangle', 'arrow', 'star'].includes(tool) && startPos) {
      e.preventDefault();
      const coords = getCoordinates(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      drawShape(ctx, tool, startPos.x, startPos.y, coords.x, coords.y, color, brushSize);
      
      sendDrawEvent({
        type: 'shape',
        shape: tool,
        startX: startPos.x,
        startY: startPos.y,
        endX: coords.x,
        endY: coords.y,
        color,
        brushSize
      });

      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      
      saveToHistory();
      setStartPos(null);
    } else {
      saveToHistory();
    }
    
    setIsDrawing(false);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPosition) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    drawText(ctx, textInput, textPosition.x, textPosition.y, color, fontSize);

    if (socket) {
      socket.emit('draw-text', {
        text: textInput,
        x: textPosition.x,
        y: textPosition.y,
        color,
        fontSize
      });
    }

    saveToHistory();
    setTextInput('');
    setShowTextInput(false);
    setTextPosition(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const maxWidth = 400;
        const maxHeight = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;

        ctx.drawImage(img, x, y, width, height);

        if (socket) {
          socket.emit('draw-image', {
            imageData: event.target.result,
            x,
            y,
            width,
            height
          });
        }

        saveToHistory();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history[newStep];
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history[newStep];
    }
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const clearCanvas = () => {
    handleClearCanvas();
    if (socket) {
      socket.emit('clear-canvas');
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL();
    localStorage.setItem('savedCanvas', dataURL);
    alert('Canvas saved!');
  };

  const loadCanvas = () => {
    const saved = localStorage.getItem('savedCanvas');
    if (saved) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
      };
      img.src = saved;
    }
  };

  const handleJoinRoom = () => {
    if (roomId.trim() && username.trim()) {
      joinRoom(username);
      setHasJoinedRoom(true);
    }
  };

  if (!hasJoinedRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-6 text-center">Join Collaborative Canvas</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Room ID</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                className="w-full px-4 py-2 border rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            <button
              onClick={handleJoinRoom}
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Collaborative Canvas</h1>
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <><Wifi className="w-4 h-4 text-green-500" /> <span className="text-green-600">Connected</span></>
            ) : (
              <><WifiOff className="w-4 h-4 text-red-500" /> <span className="text-red-600">Disconnected</span></>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            <span>{users.length} online</span>
          </div>
          <div className="text-sm text-gray-600">
            Room: <span className="font-mono">{roomId}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={saveCanvas} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={loadCanvas} className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1">
            <Upload className="w-4 h-4" /> Load
          </button>
          <button onClick={downloadCanvas} className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white shadow-md p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Basic Tools */}
          <div className="flex gap-2">
            <button
              onClick={() => setTool('brush')}
              className={`p-2 rounded ${tool === 'brush' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Brush"
            >
              <Paintbrush className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Eraser"
            >
              <Eraser className="w-5 h-5" />
            </button>
          </div>

          {/* Shape Tools */}
          <div className="flex gap-2 border-l pl-4">
            <button
              onClick={() => setTool('line')}
              className={`p-2 rounded ${tool === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Line"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('rectangle')}
              className={`p-2 rounded ${tool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Rectangle"
            >
              <Square className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`p-2 rounded ${tool === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Circle"
            >
              <Circle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('triangle')}
              className={`p-2 rounded ${tool === 'triangle' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Triangle"
            >
              <Triangle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('arrow')}
              className={`p-2 rounded ${tool === 'arrow' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Arrow"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('star')}
              className={`p-2 rounded ${tool === 'star' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Star"
            >
              <Star className="w-5 h-5" />
            </button>
          </div>

          {/* Creative Tools */}
          <div className="flex gap-2 border-l pl-4">
            <button
              onClick={() => setTool('text')}
              className={`p-2 rounded ${tool === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Text"
            >
              <Type className="w-5 h-5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded bg-gray-200 hover:bg-gray-300"
              title="Upload Image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Color Picker */}
          <div className="flex gap-2 border-l pl-4">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded border-2 ${color === c ? 'border-gray-800' : 'border-gray-300'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-8 h-8 rounded border-2 border-gray-300 flex items-center justify-center bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500"
              >
                <Droplet className="w-4 h-4 text-white" />
              </button>
              {showColorPicker && (
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute top-10 left-0 z-10"
                />
              )}
            </div>
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2 border-l pl-4">
            <label className="text-sm">Size: {brushSize}px</label>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-32"
            />
          </div>

          {/* Font Size (for text) */}
          {tool === 'text' && (
            <div className="flex items-center gap-2 border-l pl-4">
              <label className="text-sm">Font: {fontSize}px</label>
              <input
                type="range"
                min="12"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-32"
              />
            </div>
          )}

          {/* History Controls */}
          <div className="flex gap-2 border-l pl-4 ml-auto">
            <button
              onClick={undo}
              disabled={historyStep <= 0}
              className="p-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              title="Undo"
            >
              <Undo className="w-5 h-5" />
            </button>
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="p-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              title="Redo"
            >
              <Redo className="w-5 h-5" />
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 rounded bg-red-500 text-white hover:bg-red-600"
              title="Clear Canvas"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="border-2 border-gray-300 bg-white cursor-crosshair shadow-lg"
            style={{ touchAction: 'none' }}
          />
          <canvas
            ref={previewCanvasRef}
            width={1200}
            height={700}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ touchAction: 'none' }}
          />
          
          {/* User Cursors */}
          {Object.entries(cursors).map(([userId, cursor]) => (
            <div
              key={userId}
              className="absolute pointer-events-none"
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: cursor.color }} />
              <div className="text-xs bg-black text-white px-2 py-1 rounded mt-1 whitespace-nowrap">
                {cursor.username}
              </div>
            </div>
          ))}

          {/* Text Input Modal */}
          {showTextInput && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white p-6 rounded-lg shadow-xl">
                <h3 className="text-lg font-bold mb-4">Add Text</h3>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Enter text..."
                  className="w-full px-4 py-2 border rounded mb-4"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleTextSubmit}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Text
                  </button>
                  <button
                    onClick={() => {
                      setShowTextInput(false);
                      setTextInput('');
                      setTextPosition(null);
                    }}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t p-2 flex justify-between text-sm text-gray-600">
        <div>Tool: <span className="font-semibold capitalize">{tool}</span></div>
        <div>FPS: <span className="font-semibold">{fps}</span></div>
        <div>Latency: <span className="font-semibold">{latency}ms</span></div>
      </div>
    </div>
  );
};

export default Canvas;