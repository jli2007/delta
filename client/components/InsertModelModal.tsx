"use client";

import { useState, useRef, useEffect } from "react";
import { Cross2Icon, UploadIcon, CubeIcon } from "@radix-ui/react-icons";

interface PendingModel {
  file: File;
  url: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

interface InsertModelModalProps {
  onClose: () => void;
  onPlaceModel: (model: PendingModel) => void;
}

export function InsertModelModal({ onClose, onPlaceModel }: InsertModelModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(0.01);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Note: We don't revoke the blob URL here since it needs to stay valid
  // for the model to be loaded after the modal closes. The URL will be
  // cleaned up when the page is refreshed or the model is removed.

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".glb")) {
      // Revoke previous URL if exists
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setFileUrl(url);
    }
  };

  const handlePlaceModel = () => {
    if (selectedFile && fileUrl) {
      onPlaceModel({
        file: selectedFile,
        url: fileUrl,
        scale,
        rotationX,
        rotationY,
        rotationZ,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-[400px] rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CubeIcon className="text-white/60" width={20} height={20} />
            <h2 className="text-white font-semibold text-lg">Insert 3D Model</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <Cross2Icon width={16} height={16} />
          </button>
        </div>

        {/* File upload area */}
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
          >
            {selectedFile ? (
              <>
                <CubeIcon className="text-cyan-400" width={32} height={32} />
                <div className="text-center">
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-white/50 text-sm mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </>
            ) : (
              <>
                <UploadIcon className="text-white/40" width={32} height={32} />
                <div className="text-center">
                  <p className="text-white/70">Click to upload GLB file</p>
                  <p className="text-white/40 text-sm mt-1">or drag and drop</p>
                </div>
              </>
            )}
          </button>
        </div>

        {/* Scale slider */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/70 text-sm">Scale</label>
            <span className="text-white/50 text-sm">{scale.toFixed(3)}x</span>
          </div>
          <input
            type="range"
            min="0.001"
            max="0.5"
            step="0.001"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Rotation sliders */}
        <div className="mb-6 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm">Rotation X (Pitch)</label>
              <span className="text-white/50 text-sm">{rotationX}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={rotationX}
              onChange={(e) => setRotationX(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm">Rotation Y (Roll)</label>
              <span className="text-white/50 text-sm">{rotationY}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={rotationY}
              onChange={(e) => setRotationY(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm">Rotation Z (Yaw)</label>
              <span className="text-white/50 text-sm">{rotationZ}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={rotationZ}
              onChange={(e) => setRotationZ(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handlePlaceModel}
            disabled={!selectedFile}
            className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-cyan-200 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-500/20 disabled:hover:text-cyan-300"
          >
            Place Model
          </button>
        </div>
      </div>
    </div>
  );
}
