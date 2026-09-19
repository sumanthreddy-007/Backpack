import { useEffect, useRef } from "react";

// Notes are stored in one canonical coordinate system. This prevents a
// responsive browser canvas from changing saved drawing positions.
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 1200;

function DrawingBlock({ width, height, enabled, tool = "pencil", drawingData = [], onChange }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const currentStroke = useRef([]);

  useEffect(() => {
    if (!canvasRef.current || !width || !height) return;
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    redrawCanvas(drawingData);
  }, [width, height]);

  useEffect(() => {
    if (!drawing.current) redrawCanvas(drawingData);
  }, [drawingData, width, height]);

  const toScreen = (point) => ({
    x: point.x * (width / CANVAS_WIDTH),
    y: point.y * (height / CANVAS_HEIGHT),
  });

  const redrawCanvas = (strokes) => {
    const ctx = ctxRef.current;
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);

    for (const stroke of strokes || []) {
      const points = stroke.points || [];
      if (points.length < 2) continue;
      const first = toScreen(points[0]);
      ctx.globalCompositeOperation = stroke.isEraser ? "destination-out" : "source-over";
      ctx.lineWidth = stroke.isEraser ? 20 * (width / CANVAS_WIDTH) : 2.5 * (width / CANVAS_WIDTH);
      ctx.strokeStyle = "#1d1d1f";
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length; i += 1) {
        const point = toScreen(points[i]);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH, (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width))),
      y: Math.max(0, Math.min(CANVAS_HEIGHT, (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height))),
    };
  };

  const startDrawing = (e) => {
    if (!enabled || !canvasRef.current) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = getPoint(e);
    currentStroke.current = [p];

    const ctx = ctxRef.current;
    if (ctx) {
      const scale = width / CANVAS_WIDTH;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.lineWidth = (tool === "eraser" ? 20 : 2.5) * scale;
      ctx.strokeStyle = "#1d1d1f";
      const screenPoint = toScreen(p);
      ctx.beginPath();
      ctx.moveTo(screenPoint.x, screenPoint.y);
    }
  };

  const draw = (e) => {
    if (!enabled || !drawing.current) return;
    const point = getPoint(e);
    currentStroke.current.push(point);
    const ctx = ctxRef.current;
    if (ctx) {
      const screenPoint = toScreen(point);
      ctx.lineTo(screenPoint.x, screenPoint.y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {}

    if (currentStroke.current.length >= 2) {
      onChange([
        ...(drawingData || []),
        { isEraser: tool === "eraser", points: [...currentStroke.current] },
      ]);
    }
    currentStroke.current = [];
    if (ctxRef.current) ctxRef.current.globalCompositeOperation = "source-over";
  };

  return (
    <canvas
      ref={canvasRef}
      className={`drawing-canvas ${enabled ? "drawing-active" : ""} ${tool === "eraser" ? "eraser-active" : ""}`}
      style={{ touchAction: "none", display: "block" }}
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={stopDrawing}
      onPointerCancel={stopDrawing}
    />
  );
}

export default DrawingBlock;
