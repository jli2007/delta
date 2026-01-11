"use client";

import { useState, useRef, useEffect } from "react";
import { Cross2Icon, UploadIcon, CubeIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { supabase } from "@/lib/supabase";
import { ModelThumbnail } from "./ModelThumbnail";

interface PendingModel {
  file: File;
  url: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

interface LibraryModel {
  id: string;
  name: string;
  thumbnail_url: string;
  glb_url: string;
  category?: string;
}

interface InsertModelModalProps {
  onClose: () => void;
  onPlaceModel: (model: PendingModel) => void;
}

export function InsertModelModal({ onClose, onPlaceModel }: InsertModelModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "library">("library");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryModels, setLibraryModels] = useState<LibraryModel[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  // Load library models once on mount
  useEffect(() => {
    const loadLibraryModels = async () => {
      setIsLoadingLibrary(true);
      try {
        const { data, error } = await supabase
          .from('models')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLibraryModels(data || []);
      } catch (error) {
        console.error("Failed to load library models:", error);
        setLibraryModels([]);
      } finally {
        setIsLoadingLibrary(false);
      }
    };

    loadLibraryModels();
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".glb")) {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setFileUrl(url);
    }
  };

  const handlePlaceModel = async () => {
    if (!selectedFile || !fileUrl) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Upload GLB to storage
      const { error: uploadError } = await supabase.storage
        .from('models')
        .upload(filename, selectedFile, {
          contentType: 'model/gltf-binary',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('models')
        .getPublicUrl(filename);

      // Insert metadata (no thumbnail - we use live 3D preview)
      const { error: insertError } = await supabase
        .from('models')
        .insert({
          name: selectedFile.name.replace('.glb', ''),
          glb_url: publicUrl,
          thumbnail_url: '', // Empty - we render live preview from glb_url
          category: 'User Upload',
          file_size: selectedFile.size,
        });

      if (insertError) throw insertError;

      // Place on map
      onPlaceModel({
        file: selectedFile,
        url: fileUrl,
        scale: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
      });
    } catch (error) {
      console.error('Failed to upload:', error);
      alert('Failed to upload to library. Model will still be placed.');

      onPlaceModel({
        file: selectedFile,
        url: fileUrl,
        scale: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectLibraryModel = async (model: LibraryModel) => {
    try {
      const response = await fetch(model.glb_url);
      const blob = await response.blob();
      const file = new File([blob], `${model.name}.glb`, { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);

      onPlaceModel({
        file,
        url,
        scale: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
      });
    } catch (error) {
      console.error("Failed to load library model:", error);
    }
  };

  const filteredModels = libraryModels.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-[500px] rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
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

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("library")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === "library"
                ? "text-white bg-white/10 border-b-2 border-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Public Library
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === "upload"
                ? "text-white bg-white/10 border-b-2 border-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Content - Both tabs stay mounted, only visibility changes */}
        <div className="max-h-[70vh] overflow-y-auto">
          {/* Library Tab */}
          <div className={`p-4 ${activeTab === "library" ? "" : "hidden"}`}>
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" width={16} height={16} />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
                />
              </div>
            </div>

            {/* Model List */}
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-white/40 text-sm">Loading models...</div>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CubeIcon className="text-white/20 mb-3" width={48} height={48} />
                <p className="text-white/40 text-sm">
                  {searchQuery ? "No models found" : "No models in library yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelectLibraryModel(model)}
                    className="group w-full flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all"
                  >
                    {/* Live 3D Thumbnail */}
                    <div className="w-28 h-28 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
                      <ModelThumbnail glbUrl={model.glb_url} size={112} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white text-sm font-medium truncate">{model.name}</p>
                      {model.category && (
                        <p className="text-white/50 text-xs mt-0.5">{model.category}</p>
                      )}
                    </div>

                    {/* Icon */}
                    <CubeIcon className="text-white/40 group-hover:text-white/80 transition-colors flex-shrink-0" width={18} height={18} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload Tab */}
          <div className={`p-4 ${activeTab === "upload" ? "" : "hidden"}`}>
            {/* File upload area */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 p-12 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            >
              {selectedFile && fileUrl ? (
                <>
                  {/* Show live preview of selected file */}
                  <div className="w-40 h-40 rounded-lg overflow-hidden">
                    <ModelThumbnail glbUrl={fileUrl} size={160} />
                  </div>
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

            {/* Place button for upload tab */}
            {selectedFile && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceModel}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white hover:bg-white/90 text-black transition-all text-sm font-medium disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Place Model'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
