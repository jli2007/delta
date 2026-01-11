"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TransformGizmoProps {
  screenPosition: { x: number; y: number };
  mode: "move" | "rotate";
  currentRotation: { x: number; y: number; z: number };
  onMoveStart: () => void;
  onMove: (deltaX: number, deltaY: number) => void;
  onMoveEnd: () => void;
  onHeightChange: (deltaHeight: number) => void;
  onRotate: (axis: "x" | "y" | "z", newRotation: number) => void;
  onModeChange: (mode: "move" | "rotate") => void;
  onDelete?: () => void;
}

type DragAxis = "x" | "y" | "z" | "free" | "rotateX" | "rotateY" | "rotateZ" | null;

export function TransformGizmo({
  screenPosition,
  mode,
  currentRotation,
  onMoveStart,
  onMove,
  onMoveEnd,
  onHeightChange,
  onRotate,
  onModeChange,
  onDelete,
}: TransformGizmoProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragAxis, setDragAxis] = useState<DragAxis>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const rotationStartRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (axis: DragAxis) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      setDragAxis(axis);
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      if (axis === "rotateX") rotationStartRef.current = currentRotation.x;
      else if (axis === "rotateY") rotationStartRef.current = currentRotation.y;
      else if (axis === "rotateZ") rotationStartRef.current = currentRotation.z;

      // Save state for undo on any transform (move or rotate)
      onMoveStart();
    },
    [currentRotation, onMoveStart]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      if (dragAxis === "rotateX" || dragAxis === "rotateY" || dragAxis === "rotateZ") {
        // Calculate rotation based on horizontal drag
        const deltaAngle = deltaX * 0.5;
        let newRotation = (rotationStartRef.current + deltaAngle) % 360;
        if (newRotation < 0) newRotation += 360;

        const rotAxis = dragAxis === "rotateX" ? "x" : dragAxis === "rotateY" ? "y" : "z";
        onRotate(rotAxis, Math.round(newRotation));
      } else if (dragAxis === "x") {
        onMove(deltaX, 0);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (dragAxis === "y") {
        // Y axis - adjust height (drag up = increase height, scaled to match X/Z sensitivity)
        onHeightChange(-deltaY * 0.1);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (dragAxis === "z") {
        onMove(0, deltaY);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (dragAxis === "free") {
        // Free movement - drag in XZ plane
        onMove(deltaX, deltaY);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onMoveEnd();
      setDragAxis(null);
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragAxis, onMove, onMoveEnd, onHeightChange, onRotate]);

  const isActive = (axis: DragAxis) => dragAxis === axis;

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: screenPosition.x,
        top: screenPosition.y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Mode toggle and delete buttons */}
      <div
        className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto backdrop-blur-sm bg-black/30 rounded-lg p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onModeChange("move")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
            mode === "move"
              ? "bg-white/20 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          Move
        </button>
        <button
          onClick={() => onModeChange("rotate")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
            mode === "rotate"
              ? "bg-white/20 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          Rotate
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all text-red-400 hover:text-red-300 hover:bg-red-500/20"
            title="Delete (Del)"
          >
            Delete
          </button>
        )}
      </div>

      {mode === "move" ? (
        // Move gizmo - X, Y, Z arrows
        <svg
          width="200"
          height="200"
          viewBox="-100 -100 200 200"
          className="pointer-events-none"
        >
          {/* X axis arrow (red) - horizontal right */}
          <g
            className="pointer-events-auto cursor-ew-resize"
            onMouseDown={handleMouseDown("x")}
          >
            <line
              x1="15" y1="0" x2="75" y2="0"
              stroke={isActive("x") ? "#ff6666" : "#ef4444"}
              strokeWidth={isActive("x") ? "6" : "5"}
              strokeLinecap="round"
            />
            <polygon
              points="75,-7 90,0 75,7"
              fill={isActive("x") ? "#ff6666" : "#ef4444"}
            />
            <line x1="0" y1="0" x2="90" y2="0" stroke="transparent" strokeWidth="28" />
            <text x="78" y="-12" fill="#ef4444" fontSize="13" fontWeight="bold">X</text>
          </g>

          {/* Z axis arrow (green) - forward/back on map (shown diagonally for 3D effect) */}
          <g
            className="pointer-events-auto cursor-ns-resize"
            onMouseDown={handleMouseDown("z")}
          >
            <line
              x1="-10" y1="-10" x2="-45" y2="-60"
              stroke={isActive("z") ? "#66ff66" : "#22c55e"}
              strokeWidth={isActive("z") ? "6" : "5"}
              strokeLinecap="round"
            />
            <polygon
              points="-45,-65 -38,-52 -52,-52"
              fill={isActive("z") ? "#66ff66" : "#22c55e"}
              transform="rotate(-55, -45, -60)"
            />
            <line x1="0" y1="0" x2="-50" y2="-70" stroke="transparent" strokeWidth="28" />
            <text x="-62" y="-62" fill="#22c55e" fontSize="13" fontWeight="bold">Z</text>
          </g>

          {/* Y axis arrow (blue) - height (up on screen) */}
          <g
            className="pointer-events-auto cursor-ns-resize"
            onMouseDown={handleMouseDown("y")}
          >
            <line
              x1="0" y1="-15" x2="0" y2="-75"
              stroke={isActive("y") ? "#6699ff" : "#3b82f6"}
              strokeWidth={isActive("y") ? "6" : "5"}
              strokeLinecap="round"
            />
            <polygon
              points="-7,-75 0,-90 7,-75"
              fill={isActive("y") ? "#6699ff" : "#3b82f6"}
            />
            <line x1="0" y1="0" x2="0" y2="-90" stroke="transparent" strokeWidth="28" />
            <text x="10" y="-72" fill="#3b82f6" fontSize="13" fontWeight="bold">Y</text>
          </g>

          {/* Center point - draggable for free movement */}
          <circle
            cx="0" cy="0" r="14"
            fill={isActive("free") ? "#ffffff" : "#f0f0f0"}
            stroke={isActive("free") ? "#666" : "#444"}
            strokeWidth="2.5"
            className="pointer-events-auto cursor-move"
            onMouseDown={handleMouseDown("free")}
          />
        </svg>
      ) : (
        // Rotate gizmo - 3 rings for X, Y, Z rotation
        <svg
          width="200"
          height="200"
          viewBox="-100 -100 200 200"
          className="pointer-events-none"
        >
          {/* X rotation ring (red) - vertical ellipse */}
          <ellipse
            cx="0" cy="0" rx="25" ry="70"
            fill="none"
            stroke={isActive("rotateX") ? "#ff6666" : "#ef4444"}
            strokeWidth={isActive("rotateX") ? "7" : "5"}
            className="pointer-events-auto cursor-grab"
            onMouseDown={handleMouseDown("rotateX")}
            style={{ cursor: isDragging && dragAxis === "rotateX" ? "grabbing" : "grab" }}
          />

          {/* Y rotation ring (green) - horizontal ellipse (tilted) */}
          <ellipse
            cx="0" cy="0" rx="70" ry="25"
            fill="none"
            stroke={isActive("rotateY") ? "#66ff66" : "#22c55e"}
            strokeWidth={isActive("rotateY") ? "7" : "5"}
            transform="rotate(-30)"
            className="pointer-events-auto cursor-grab"
            onMouseDown={handleMouseDown("rotateY")}
            style={{ cursor: isDragging && dragAxis === "rotateY" ? "grabbing" : "grab" }}
          />

          {/* Z rotation ring (blue) - main circle */}
          <circle
            cx="0" cy="0" r="70"
            fill="none"
            stroke={isActive("rotateZ") ? "#6699ff" : "#3b82f6"}
            strokeWidth={isActive("rotateZ") ? "7" : "5"}
            className="pointer-events-auto cursor-grab"
            onMouseDown={handleMouseDown("rotateZ")}
            style={{ cursor: isDragging && dragAxis === "rotateZ" ? "grabbing" : "grab" }}
          />

          {/* Axis labels */}
          <text x="0" y="-80" fill="#3b82f6" fontSize="13" fontWeight="bold" textAnchor="middle">Z</text>
          <text x="80" y="4" fill="#22c55e" fontSize="13" fontWeight="bold">Y</text>
          <text x="-10" y="45" fill="#ef4444" fontSize="13" fontWeight="bold">X</text>

          {/* Center point */}
          <circle cx="0" cy="0" r="12" fill="#f0f0f0" stroke="#444" strokeWidth="2" />

          {/* Current rotation values */}
          <text x="0" y="92" fill="#ffffff" fontSize="11" textAnchor="middle" className="select-none">
            X:{Math.round(currentRotation.x)}° Y:{Math.round(currentRotation.y)}° Z:{Math.round(currentRotation.z)}°
          </text>
        </svg>
      )}
    </div>
  );
}
