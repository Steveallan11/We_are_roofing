"use client";

import { useRef, useEffect, useState } from "react";

type Props = {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
};

export function CameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera access denied");
      }
    };
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setFacingMode((m) => (m === "user" ? "environment" : "user"));
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/jpeg", 0.85);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {error ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <div>
            <p className="text-lg font-medium text-white">Camera access denied</p>
            <p className="mt-2 text-sm text-[#fca5a5]">{error}</p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-4 rounded bg-white/10 px-4 py-2 font-medium text-white hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="flex-1 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="border-t border-white/10 bg-black/80 px-4 py-4">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={toggleCamera}
                className="rounded-full bg-white/20 p-3 text-white hover:bg-white/30"
                aria-label="Toggle camera"
              >
                🔄
              </button>
              <button
                type="button"
                onClick={capture}
                className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30"
                aria-label="Capture photo"
              />
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full bg-[#ef4444] p-3 text-white hover:bg-[#dc2626]"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
