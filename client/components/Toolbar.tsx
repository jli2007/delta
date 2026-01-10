"use client";

import { CursorArrowIcon, GlobeIcon, InfoCircledIcon, Pencil2Icon, CubeIcon, StackIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";

type ToolType = "select" | "teleport" | "draw" | "insert" | null;

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  showAssetManager: boolean;
  onToggleAssetManager: () => void;
}

export function Toolbar({ activeTool, setActiveTool, showAssetManager, onToggleAssetManager }: ToolbarProps) {
  return (
    <Tooltip.Provider delayDuration={0}>
      <div className="absolute left-4 top-[45%] -translate-y-1/2 z-10 flex flex-col justify-between w-14 h-[440px] rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 py-4 shadow-xl">
        <div className="flex flex-col gap-4 items-center">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setActiveTool(activeTool === "select" ? null : "select")}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
                  activeTool === "select"
                    ? "bg-white/20 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <CursorArrowIcon width={20} height={20} />
                <span className="text-[10px] font-medium">Select</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm font-medium text-white shadow-xl will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade z-50 ml-2"
                side="right"
                sideOffset={5}
              >
                Select buildings to view details
                <Tooltip.Arrow className="fill-white/10" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setActiveTool(activeTool === "teleport" ? null : "teleport")}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
                  activeTool === "teleport"
                    ? "bg-white/20 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <GlobeIcon width={20} height={20} />
                <span className="text-[10px] font-medium">Teleport</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm font-medium text-white shadow-xl will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade z-50 ml-2"
                side="right"
                sideOffset={5}
              >
                Jump to major cities
                <Tooltip.Arrow className="fill-white/10" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setActiveTool(activeTool === "draw" ? null : "draw")}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
                  activeTool === "draw"
                    ? "bg-white/20 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Pencil2Icon width={20} height={20} />
                <span className="text-[10px] font-medium">Delete</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm font-medium text-white shadow-xl will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade z-50 ml-2"
                side="right"
                sideOffset={5}
              >
                Draw an area to remove buildings
                <Tooltip.Arrow className="fill-white/10" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setActiveTool(activeTool === "insert" ? null : "insert")}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
                  activeTool === "insert"
                    ? "bg-white/20 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <CubeIcon width={20} height={20} />
                <span className="text-[10px] font-medium">Insert</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm font-medium text-white shadow-xl will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade z-50 ml-2"
                side="right"
                sideOffset={5}
              >
                Insert custom 3D models
                <Tooltip.Arrow className="fill-white/10" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={onToggleAssetManager}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
                  showAssetManager
                    ? "bg-white/20 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <StackIcon width={20} height={20} />
                <span className="text-[10px] font-medium">Assets</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm font-medium text-white shadow-xl will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade z-50 ml-2"
                side="right"
                sideOffset={5}
              >
                Manage placed 3D models
                <Tooltip.Arrow className="fill-white/10" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className="flex flex-col items-center gap-1 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all w-10">
                <InfoCircledIcon width={20} height={20} />
                <span className="text-[10px] font-medium">About</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm font-medium text-white shadow-xl will-change-[transform,opacity] data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade z-50 ml-2"
                side="right"
                sideOffset={5}
              >
                About Delta Map
                <Tooltip.Arrow className="fill-white/10" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
