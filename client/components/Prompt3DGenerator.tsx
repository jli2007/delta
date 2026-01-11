"use client";

import { useState, useEffect, useRef } from "react";
import { Cross2Icon, CubeIcon, ReloadIcon, CheckCircledIcon, ExclamationTriangleIcon, ImageIcon, Pencil1Icon, ChevronLeftIcon, ChevronRightIcon, EnterFullScreenIcon } from "@radix-ui/react-icons";
import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PendingModel {
  file: File;
  url: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

interface Prompt3DGeneratorProps {
  onClose: () => void;
  onPlaceModel?: (model: PendingModel) => void;
}

interface PreviewResult {
  job_id: string;
  original_prompt: string;
  cleaned_prompt: string;
  dalle_prompt: string;
  image_urls: string[];
}

interface ThreeDJobResult {
  job_id: string;
  status: string;
  progress: number;
  message: string;
  model_url?: string;
  model_file?: string;
  download_url?: string;
  generation_time?: number;
}

type WorkflowStage = "input" | "preview" | "placing";

export function Prompt3DGenerator({ onClose, onPlaceModel }: Prompt3DGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<"architectural" | "modern" | "classical" | "futuristic">("architectural");
  const [numViews, setNumViews] = useState(1);
  
  // Workflow state
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("input");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Preview state
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isExpandedView, setIsExpandedView] = useState(false);
  
  // 3D generation state (runs silently in background)
  const [threeDJob, setThreeDJob] = useState<ThreeDJobResult | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Start 3D generation automatically when preview is ready (silently in background)
  useEffect(() => {
    if (previewResult && workflowStage === "preview" && !threeDJob) {
      start3DGeneration();
    }
  }, [previewResult, workflowStage]);

  const handleGeneratePreview = async () => {
    if (!prompt.trim()) return;

    setIsGeneratingPreview(true);
    setError(null);
    setPreviewResult(null);
    setThreeDJob(null);

    try {
      const response = await fetch(`${API_BASE}/generate-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style,
          num_views: numViews,
          high_quality: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate preview");
      }

      const result = await response.json();
      setPreviewResult(result);
      setWorkflowStage("preview");
      
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error occurred");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const start3DGeneration = async () => {
    if (!previewResult) return;

    try {
      const response = await fetch(`${API_BASE}/start-3d`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: previewResult.job_id,
          image_urls: previewResult.image_urls,
          texture_size: 1024,
          use_multi: numViews > 1,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start 3D generation");
      }

      // Start polling for 3D job status (silently)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/3d-job/${previewResult.job_id}`);
          if (!statusRes.ok) return;

          const status: ThreeDJobResult = await statusRes.json();
          setThreeDJob(status);

          if (status.status === "completed" || status.status === "failed") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        } catch (e) {
          // Silent fail - keep polling
        }
      }, 1500);

    } catch (e) {
      console.error("Failed to start 3D generation:", e);
    }
  };

  const handleRefinePrompt = async () => {
    // Stop any ongoing 3D generation polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Cancel the 3D job on the backend if one exists
    if (previewResult?.job_id) {
      try {
        await fetch(`${API_BASE}/jobs/${previewResult.job_id}/cancel`, {
          method: "POST",
        });
      } catch (e) {
        // Ignore cancel errors - job may already be done
        console.log("Could not cancel job:", e);
      }
    }
    
    // Go back to input stage
    setWorkflowStage("input");
    setPreviewResult(null);
    setThreeDJob(null);
    setSelectedImageIndex(0);
    setIsExpandedView(false);
  };

  const handleFinish = async () => {
    if (!onPlaceModel || !previewResult) return;

    // If 3D model is ready, place it immediately
    if (threeDJob?.status === "completed" && threeDJob.download_url) {
      await placeModel(threeDJob.download_url, threeDJob.model_file);
    } else {
      // Show "placing" state and wait for 3D to complete
      setWorkflowStage("placing");
      setIsPlacing(true);
      
      // Wait for 3D generation to complete
      const waitForModel = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/3d-job/${previewResult.job_id}`);
          if (!statusRes.ok) return;

          const status: ThreeDJobResult = await statusRes.json();
          setThreeDJob(status);

          if (status.status === "completed" && status.download_url) {
            clearInterval(waitForModel);
            // Pass the download_url directly - don't rely on React state which updates async
            await placeModel(status.download_url, status.model_file);
          } else if (status.status === "failed") {
            clearInterval(waitForModel);
            setError("3D generation failed. Please try again.");
            setIsPlacing(false);
            setWorkflowStage("preview");
          }
        } catch (e) {
          // Keep waiting
        }
      }, 1000);
    }
  };

  const placeModel = async (downloadUrl: string, modelFile?: string) => {
    if (!downloadUrl || !onPlaceModel) return;

    try {
      const response = await fetch(`${API_BASE}${downloadUrl}`);
      if (!response.ok) throw new Error("Failed to download model");

      const blob = await response.blob();
      const file = new File([blob], modelFile || "model.glb", { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);

      // Upload to Supabase library in background
      if (previewResult && threeDJob) {
        uploadToLibrary(file, previewResult, threeDJob).catch(err => {
          console.error('Failed to upload generated model to library:', err);
        });
      }

      onPlaceModel({
        file,
        url,
        scale: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
      });

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load model");
      setIsPlacing(false);
      setWorkflowStage("preview");
    }
  };

  const uploadToLibrary = async (file: File, preview: PreviewResult, job: ThreeDJobResult) => {
    try {
      const timestamp = Date.now();
      const glbFilename = `${timestamp}-generated.glb`;

      const { error: uploadError } = await supabase.storage
        .from('models')
        .upload(glbFilename, file, {
          contentType: 'model/gltf-binary',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: glbUrl } } = supabase.storage
        .from('models')
        .getPublicUrl(glbFilename);

      let thumbnailUrl = `https://placehold.co/200x200/1a1a1a/white?text=Generated`;

      if (preview.image_urls && preview.image_urls.length > 0) {
        try {
          const thumbnailResponse = await fetch(preview.image_urls[0]);
          const thumbnailBlob = await thumbnailResponse.blob();
          const thumbnailFilename = `${timestamp}-thumbnail.jpg`;

          const { error: thumbError } = await supabase.storage
            .from('thumbnails')
            .upload(thumbnailFilename, thumbnailBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
            });

          if (!thumbError) {
            const { data: { publicUrl } } = supabase.storage
              .from('thumbnails')
              .getPublicUrl(thumbnailFilename);
            thumbnailUrl = publicUrl;
          }
        } catch (e) {
          console.warn('Failed to upload thumbnail, using placeholder');
        }
      }

      const { error: insertError } = await supabase
        .from('models')
        .insert({
          name: preview.cleaned_prompt.substring(0, 100),
          description: `Generated from: "${preview.original_prompt}"`,
          glb_url: glbUrl,
          thumbnail_url: thumbnailUrl,
          category: 'AI Generated',
          file_size: file.size,
        });

      if (insertError) throw insertError;
      console.log('Successfully uploaded generated model to library');
    } catch (error) {
      throw error;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.metaKey) {
      handleGeneratePreview();
    }
  };

  const nextImage = () => {
    if (previewResult) {
      setSelectedImageIndex((prev) => (prev + 1) % previewResult.image_urls.length);
    }
  };

  const prevImage = () => {
    if (previewResult) {
      setSelectedImageIndex((prev) => (prev - 1 + previewResult.image_urls.length) % previewResult.image_urls.length);
    }
  };

  const quickPrompts = [
    { label: "Paris Haussmann", prompt: "Classic Parisian Haussmann-style building with ornate balconies and mansard roof" },
    { label: "Modern Tower", prompt: "Sleek glass skyscraper with geometric facade patterns" },
    { label: "Neo-Gothic", prompt: "Gothic revival cathedral with pointed arches and flying buttresses" },
    { label: "Brutalist", prompt: "Raw concrete brutalist apartment block with angular forms" },
  ];

  // Expanded Modal View
  const ExpandedModal = () => {
    if (!isExpandedView || !previewResult) return null;
    
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
        onClick={() => setIsExpandedView(false)}
      >
        {/* Close Button - Fixed Position */}
        <button
          onClick={() => setIsExpandedView(false)}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
        >
          <Cross2Icon width={20} height={20} />
        </button>
        
        {/* Navigation Arrows - Fixed Position */}
        {previewResult.image_urls.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-all"
            >
              <ChevronLeftIcon width={28} height={28} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-all"
            >
              <ChevronRightIcon width={28} height={28} />
            </button>
          </>
        )}
        
        {/* Center Content Container */}
        <div 
          className="flex flex-col items-center justify-center w-full h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image - Constrained to viewport */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0">
            <img
              src={previewResult.image_urls[selectedImageIndex]}
              alt={`View ${selectedImageIndex + 1}`}
              className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
          
          {/* Thumbnail Strip */}
          {previewResult.image_urls.length > 1 && (
            <div className="flex gap-3 justify-center mt-6 shrink-0">
              {previewResult.image_urls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImageIndex === i
                      ? "border-white ring-2 ring-white/30"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  <img src={url} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          
          {/* Counter */}
          <div className="text-center mt-3 text-white/60 text-sm shrink-0">
            {selectedImageIndex + 1} / {previewResult.image_urls.length}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Expanded Modal */}
      <ExpandedModal />
      
      {/* Main Panel */}
      <div className="absolute right-4 top-4 z-20 w-[420px] rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20">
              <CubeIcon width={16} height={16} className="text-white/80" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">3D Model Generator</h3>
              <p className="text-white/50 text-xs">
                {workflowStage === "input" && "Describe your building"}
                {(workflowStage === "preview" || workflowStage === "placing") && "Review your design"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white/60 hover:text-white transition-all"
          >
            <Cross2Icon width={16} height={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* === INPUT STAGE === */}
          {workflowStage === "input" && (
            <>
              {/* Prompt Input */}
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-medium">Building Description</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., A classic Parisian building with cream stone facade, wrought iron balconies, and blue mansard roof"
                  className="w-full h-24 px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 resize-none text-sm"
                  disabled={isGeneratingPreview}
                />
              </div>

              {/* Quick Prompts */}
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-medium">Presets</label>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp.label}
                      onClick={() => setPrompt(qp.prompt)}
                      disabled={isGeneratingPreview}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-all border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Selection */}
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-medium">Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["architectural", "modern", "classical", "futuristic"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      disabled={isGeneratingPreview}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        style === s
                          ? "bg-white/20 border-white/30 text-white"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      } disabled:opacity-50`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Views Selection */}
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-medium">Image Views</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumViews(n)}
                      disabled={isGeneratingPreview}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        numViews === n
                          ? "bg-white/20 border-white/30 text-white"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      } disabled:opacity-50`}
                    >
                      {n} {n === 1 ? "View" : "Views"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Preview Button */}
              <button
                onClick={handleGeneratePreview}
                disabled={!prompt.trim() || isGeneratingPreview}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90"
              >
                {isGeneratingPreview ? (
                  <>
                    <ReloadIcon width={16} height={16} className="animate-spin" />
                    <span>Generating Preview...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon width={16} height={16} />
                    <span>Generate Preview</span>
                  </>
                )}
              </button>

              <p className="text-white/40 text-xs text-center">
                Press ⌘ + Enter to generate
              </p>
            </>
          )}

          {/* === PREVIEW STAGE === */}
          {(workflowStage === "preview" || workflowStage === "placing") && previewResult && (
            <>
              {/* Generated Images Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Generated Views
                  </label>
                  <button
                    onClick={() => setIsExpandedView(true)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all border border-white/10"
                  >
                    <EnterFullScreenIcon className="w-3 h-3" />
                    Expand
                  </button>
                </div>
                
                {/* Image Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {previewResult.image_urls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedImageIndex(i);
                        setIsExpandedView(true);
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border transition-all hover:scale-[1.02] ${
                        selectedImageIndex === i
                          ? "border-white/40 ring-2 ring-white/20"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`View ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white/70">
                        View {i + 1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Info */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-white/50 text-xs line-clamp-2">
                  <span className="text-white/70 font-medium">Prompt: </span>
                  {previewResult.cleaned_prompt}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleRefinePrompt}
                  disabled={isPlacing}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-all border border-white/10 disabled:opacity-50"
                >
                  <Pencil1Icon width={14} height={14} />
                  <span>Refine</span>
                </button>
                
                <button
                  onClick={handleFinish}
                  disabled={isPlacing}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white hover:bg-white/90 text-black text-sm font-semibold transition-all disabled:opacity-80"
                >
                  {isPlacing ? (
                    <>
                      <ReloadIcon width={14} height={14} className="animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <CubeIcon width={14} height={14} />
                      <span>Finish & Place</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-white/40 text-xs text-center">
                Click an image to expand • Click Finish when ready
              </p>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-xs text-red-300/50 hover:text-red-300"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
