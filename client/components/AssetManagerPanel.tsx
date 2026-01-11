"use client";

import { useState } from "react";
import { CubeIcon, TrashIcon, TargetIcon } from "@radix-ui/react-icons";

interface InsertedModel {
  id: string;
  name?: string;
  position: [number, number];
  height: number;
  modelUrl: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

interface AssetManagerPanelProps {
  models: InsertedModel[];
  onClose: () => void;
  onFlyTo: (position: [number, number]) => void;
  onDelete: (id: string) => void;
  onUpdateModel: (id: string, updates: { name?: string; scale?: number; positionX?: number; positionY?: number; height?: number; rotationX?: number; rotationY?: number; rotationZ?: number }) => void;
}

export function AssetManagerPanel({
  models,
  onClose: _onClose,
  onFlyTo,
  onDelete,
  onUpdateModel,
}: AssetManagerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "scale" | "positionX" | "positionY" | "height" | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (model: InsertedModel, index: number, field: "name" | "scale" | "positionX" | "positionY" | "height") => {
    setEditingId(model.id);
    setEditingField(field);
    if (field === "name") {
      setEditValue(model.name || `Model ${index + 1}`);
    } else if (field === "scale") {
      setEditValue(model.scale.toFixed(2));
    } else if (field === "positionX") {
      setEditValue(model.position[0].toFixed(6));
    } else if (field === "positionY") {
      setEditValue(model.position[1].toFixed(6));
    } else if (field === "height") {
      setEditValue(model.height.toFixed(1));
    }
  };

  const handleSaveEdit = (modelId: string) => {
    if (editingField === "name") {
      if (editValue.trim()) {
        onUpdateModel(modelId, { name: editValue.trim() });
      }
    } else if (editingField === "scale") {
      const newScale = parseFloat(editValue);
      if (!isNaN(newScale) && newScale > 0) {
        onUpdateModel(modelId, { scale: newScale });
      }
    } else if (editingField === "positionX" || editingField === "positionY") {
      const newPos = parseFloat(editValue);
      if (!isNaN(newPos)) {
        onUpdateModel(modelId, { [editingField]: newPos });
      }
    } else if (editingField === "height") {
      const newHeight = parseFloat(editValue);
      if (!isNaN(newHeight)) {
        onUpdateModel(modelId, { height: Math.max(0, newHeight) });
      }
    }
    setEditingId(null);
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, modelId: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(modelId);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditingField(null);
    }
  };

  return (
    <div className="absolute bottom-8 left-4 z-10 w-80 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <CubeIcon className="text-white/60" width={16} height={16} />
        <h3 className="text-white font-semibold text-sm">Assets</h3>
        <span className="text-white/40 text-xs">({models.length})</span>
      </div>

      {/* Model list with fixed height and scroll */}
      <div className="max-h-64 overflow-y-auto">
        {models.length === 0 ? (
          <div className="p-3 text-center text-white/40 text-xs">
            No models placed yet.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {models.map((model, index) => (
              <div
                key={model.id}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CubeIcon className="text-white" width={16} height={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Name row - editable */}
                  <div className="flex items-center gap-2">
                    {editingId === model.id && editingField === "name" ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(model.id)}
                        onKeyDown={(e) => handleKeyDown(e, model.id)}
                        className="flex-1 bg-white/10 rounded px-2 py-0.5 text-white text-sm font-medium outline-none border border-white/30"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, index, "name")}
                        className="text-white text-sm font-medium truncate hover:text-white transition-colors text-left"
                        title="Click to rename"
                      >
                        {model.name || `Model ${index + 1}`}
                      </button>
                    )}
                  </div>

                  {/* Scale row - prominent */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/50 text-xs">Scale:</span>
                    {editingId === model.id && editingField === "scale" ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(model.id)}
                        onKeyDown={(e) => handleKeyDown(e, model.id)}
                        className="w-16 bg-white/10 rounded px-2 py-0.5 text-white text-sm font-medium outline-none border border-white/30"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, index, "scale")}
                        className="text-white text-sm font-medium hover:text-white/80 transition-colors"
                        title="Click to edit scale"
                      >
                        {model.scale.toFixed(2)}x
                      </button>
                    )}
                  </div>

                  {/* Position row */}
                  <div className="flex items-center gap-1.5 text-white/40 text-xs mt-1">
                    <span className="text-white/30">Pos:</span>
                    {editingId === model.id && editingField === "positionX" ? (
                      <span className="text-white">
                        X:<input
                          type="text"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-20 bg-transparent border-none outline-none text-white text-xs"
                          autoFocus
                        />
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, index, "positionX")}
                        className="hover:text-white transition-colors"
                        title="Longitude (X)"
                      >
                        X:{model.position[0].toFixed(4)}
                      </button>
                    )}
                    {editingId === model.id && editingField === "positionY" ? (
                      <span className="text-white">
                        Y:<input
                          type="text"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-20 bg-transparent border-none outline-none text-white text-xs"
                          autoFocus
                        />
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, index, "positionY")}
                        className="hover:text-white transition-colors"
                        title="Latitude (Y)"
                      >
                        Y:{model.position[1].toFixed(4)}
                      </button>
                    )}
                    {editingId === model.id && editingField === "height" ? (
                      <span className="text-white">
                        Z:<input
                          type="text"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-12 bg-transparent border-none outline-none text-white text-xs"
                          autoFocus
                        />
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, index, "height")}
                        className="hover:text-white transition-colors"
                        title="Height (Z)"
                      >
                        Z:{model.height.toFixed(1)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onFlyTo(model.position)}
                    className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-all"
                    title="Fly to model"
                  >
                    <TargetIcon width={14} height={14} />
                  </button>
                  <button
                    onClick={() => onDelete(model.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
                    title="Delete model"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
