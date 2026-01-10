"use client";

import { useState } from "react";
import { MagicWandIcon, Cross2Icon, CubeIcon, ReloadIcon } from "@radix-ui/react-icons";

interface Prompt3DGeneratorProps {
  onClose: () => void;
  onGenerate?: (prompt: string) => void;
}

export function Prompt3DGenerator({ onClose, onGenerate }: Prompt3DGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    
    // TODO: Integrate with actual 3D generation API
    // For now, just simulate a delay
    setTimeout(() => {
      setIsGenerating(false);
      if (onGenerate) {
        onGenerate(prompt);
      }
      // Optionally clear prompt after generation
      // setPrompt("");
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.metaKey) {
      // Cmd+Enter to generate
      handleGenerate();
    }
  };

  return (
    <div className="absolute right-4 top-4 z-20 w-[380px] rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
            <MagicWandIcon width={16} height={16} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">Generate 3D Object</h3>
            <p className="text-white/50 text-xs">Describe what you want to create</p>
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
      <div className="p-4 space-y-4">
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-white/70 text-sm font-medium">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="e.g., A modern glass office building with 10 floors and green terraces"
            className="w-full h-32 px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none text-sm"
            disabled={isGenerating}
          />
          <p className="text-white/40 text-xs">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 text-[10px]">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 text-[10px]">Enter</kbd> to generate
          </p>
        </div>

        {/* Quick Prompts */}
        <div className="space-y-2">
          <label className="text-white/70 text-sm font-medium">Quick Prompts</label>
          <div className="flex flex-wrap gap-2">
            {[
              "Modern Skyscraper",
              "Residential Complex",
              "Shopping Mall",
              "Park with Trees",
            ].map((quickPrompt) => (
              <button
                key={quickPrompt}
                onClick={() => setPrompt(quickPrompt)}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-all border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quickPrompt}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-500"
        >
          {isGenerating ? (
            <>
              <ReloadIcon width={16} height={16} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <CubeIcon width={16} height={16} />
              <span>Generate 3D Object</span>
            </>
          )}
        </button>

        {/* Info Text */}
        <p className="text-white/40 text-xs text-center">
          Generated objects will appear on the map where you click
        </p>
      </div>
    </div>
  );
}
