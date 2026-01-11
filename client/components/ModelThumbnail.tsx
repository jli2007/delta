"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CubeIcon } from "@radix-ui/react-icons";

interface ModelThumbnailProps {
  glbUrl: string;
  size?: number;
  className?: string;
}

export function ModelThumbnail({ glbUrl, size = 64, className = "" }: ModelThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let disposed = false;

    // Create renderer using the canvas ref
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1f1f1f, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1f1f1f);

    // Create camera
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Load the GLB
    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf) => {
        if (disposed) return;

        const model = gltf.scene;
        scene.add(model);

        // Center and fit model in view
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const boxSize = box.getSize(new THREE.Vector3());

        // Move model to center
        model.position.sub(center);

        // Calculate camera distance
        const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
        if (maxDim === 0) {
          setHasError(true);
          setIsLoading(false);
          return;
        }

        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
        cameraDistance *= 2.0;

        // Position camera for 3/4 view
        camera.position.set(
          cameraDistance * 0.7,
          cameraDistance * 0.5,
          cameraDistance * 0.7
        );
        camera.lookAt(0, 0, 0);

        // Render once
        renderer.render(scene, camera);
        setIsLoading(false);
      },
      undefined,
      (error) => {
        if (disposed) return;
        console.error("Failed to load model for thumbnail:", error);
        setHasError(true);
        setIsLoading(false);
      }
    );

    return () => {
      disposed = true;
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    };
  }, [glbUrl, size]);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1f1f1f] ${className}`}
        style={{ width: size, height: size }}
      >
        <CubeIcon className="text-white/30" width={size * 0.4} height={size * 0.4} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size, display: isLoading ? 'none' : 'block' }}
      />
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[#1f1f1f]"
          style={{ width: size, height: size }}
        >
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
