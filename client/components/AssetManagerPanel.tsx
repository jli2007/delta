"use client";

import { useState } from "react";
import { Cross2Icon, CubeIcon, TrashIcon, TargetIcon } from "@radix-ui/react-icons";

interface InsertedModel {
  id: string;
  position: [number, number];
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
  onUpdateModel: (id: string, updates: { scale?: number; rotationX?: number; rotationY?: number; rotationZ?: number }) => void;
}

export function AssetManagerPanel({
  models,
  onClose,
  onFlyTo,
  onDelete,
  onUpdateModel,
}: AssetManagerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"scale" | "rotationX" | "rotationY" | "rotationZ" | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (model: InsertedModel, field: "scale" | "rotationX" | "rotationY" | "rotationZ") => {
    setEditingId(model.id);
    setEditingField(field);
    if (field === "scale") {
      setEditValue(model.scale.toFixed(3));
    } else if (field === "rotationX") {
      setEditValue(model.rotationX.toString());
    } else if (field === "rotationY") {
      setEditValue(model.rotationY.toString());
    } else {
      setEditValue(model.rotationZ.toString());
    }
  };

  const handleSaveEdit = (modelId: string) => {
    if (editingField === "scale") {
      const newScale = parseFloat(editValue);
      if (!isNaN(newScale) && newScale > 0) {
        onUpdateModel(modelId, { scale: newScale });
      }
    } else if (editingField) {
      const newRotation = parseInt(editValue);
      if (!isNaN(newRotation)) {
        onUpdateModel(modelId, { [editingField]: newRotation % 360 });
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
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <CubeIcon className="text-white/60" width={16} height={16} />
          <h3 className="text-white font-semibold text-sm">Assets</h3>
          <span className="text-white/40 text-xs">({models.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <Cross2Icon width={14} height={14} />
        </button>
      </div>

      {/* Model list with fixed height and scroll (fits ~3 items) */}
      <div className="max-h-36 overflow-y-auto">
        {models.length === 0 ? (
          <div className="p-3 text-center text-white/40 text-xs">
            No models placed yet.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {models.map((model, index) => (
              <div
                key={model.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <CubeIcon className="text-cyan-400" width={14} height={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">
                    Model {index + 1}
                  </p>
                  <div className="flex items-center gap-1 text-white/40 text-[10px] flex-wrap">
                    {editingId === model.id && editingField === "scale" ? (
                      <span className="text-cyan-400">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-12 bg-transparent border-none outline-none text-cyan-400 text-[10px]"
                          autoFocus
                        />x
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, "scale")}
                        className="hover:text-cyan-400 transition-colors"
                        title="Click to edit scale"
                      >
                        {model.scale.toFixed(3)}x
                      </button>
                    )}
                    <span>·</span>
                    {editingId === model.id && editingField === "rotationX" ? (
                      <span className="text-cyan-400">
                        X:<input
                          type="text"
                          inputMode="numeric"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-8 bg-transparent border-none outline-none text-cyan-400 text-[10px]"
                          autoFocus
                        />°
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, "rotationX")}
                        className="hover:text-cyan-400 transition-colors"
                        title="Rotation X (Pitch)"
                      >
                        X:{model.rotationX}°
                      </button>
                    )}
                    {editingId === model.id && editingField === "rotationY" ? (
                      <span className="text-cyan-400">
                        Y:<input
                          type="text"
                          inputMode="numeric"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-8 bg-transparent border-none outline-none text-cyan-400 text-[10px]"
                          autoFocus
                        />°
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, "rotationY")}
                        className="hover:text-cyan-400 transition-colors"
                        title="Rotation Y (Roll)"
                      >
                        Y:{model.rotationY}°
                      </button>
                    )}
                    {editingId === model.id && editingField === "rotationZ" ? (
                      <span className="text-cyan-400">
                        Z:<input
                          type="text"
                          inputMode="numeric"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(model.id)}
                          onKeyDown={(e) => handleKeyDown(e, model.id)}
                          className="w-8 bg-transparent border-none outline-none text-cyan-400 text-[10px]"
                          autoFocus
                        />°
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(model, "rotationZ")}
                        className="hover:text-cyan-400 transition-colors"
                        title="Rotation Z (Yaw)"
                      >
                        Z:{model.rotationZ}°
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onFlyTo(model.position)}
                    className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-all"
                    title="Fly to model"
                  >
                    <TargetIcon width={12} height={12} />
                  </button>
                  <button
                    onClick={() => onDelete(model.id)}
                    className="p-1 rounded-md hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
                    title="Delete model"
                  >
                    <TrashIcon width={12} height={12} />
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
