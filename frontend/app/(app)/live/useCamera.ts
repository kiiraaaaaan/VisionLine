/**
 * useCamera — Phase 1 Live Camera Hook
 *
 * Manages MediaStream lifecycle, device enumeration, FPS counting, and
 * all camera state transitions. Designed so Phase 2+ can:
 *   - Read frames:          videoRef.current  (HTMLVideoElement)
 *   - Capture a frame:      captureFrame()    (returns ImageData or Blob)
 *   - Swap camera mid-run:  selectDevice()    (hot-swap stream)
 *   - Monitor real FPS:     fps               (live counter)
 *
 * No AI inference, no uploads, no database calls in this file.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types (exported for Phase 2 consumers) ───────────────────────────────────

export type CameraState =
  | "waiting"          // Initial — no action taken
  | "initializing"     // getUserMedia in flight
  | "streaming"        // Active MediaStream
  | "stopped"          // Manually stopped
  | "permission_denied"// Browser/OS denied access
  | "not_found"        // No camera on device
  | "error";           // Generic / unexpected error

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface CameraResolution {
  width: number;
  height: number;
}

export interface UseCameraReturn {
  // DOM ref — attach to <video> element. Phase 2 reads frames from here.
  videoRef: React.RefObject<HTMLVideoElement>;

  // State
  cameraState: CameraState;
  errorMessage: string;
  fps: number;
  resolution: CameraResolution | null;
  devices: CameraDevice[];
  selectedDeviceId: string;

  // Controls
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  selectDevice: (deviceId: string) => void;

  // Phase 2 extension point: capture a single JPEG blob from the live stream
  captureFrame: () => Promise<Blob | null>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("waiting");
  const [errorMessage, setErrorMessage] = useState("");
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState<CameraResolution | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  // ── Enumerate available video input devices ──────────────────────────────
  const enumerateDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoDevices: CameraDevice[] = all
        .filter((d) => d.kind === "videoinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
          groupId: d.groupId,
        }));
      setDevices(videoDevices);
      // Auto-select first device if none chosen yet
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch {
      // Device enumeration may return empty labels before permission is granted.
      // This is expected — we re-enumerate after the stream is acquired.
    }
  }, [selectedDeviceId]);

  // Enumerate on mount; also listen for device plug/unplug events
  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
    };
  }, [enumerateDevices]);

  // ── FPS Counter via requestAnimationFrame ────────────────────────────────
  const startFpsCounter = useCallback(() => {
    frameCountRef.current = 0;

    // Count rendered frames via rAF
    const countFrame = () => {
      frameCountRef.current += 1;
      rafRef.current = requestAnimationFrame(countFrame);
    };
    rafRef.current = requestAnimationFrame(countFrame);

    // Report FPS every second
    fpsIntervalRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
  }, []);

  const stopFpsCounter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (fpsIntervalRef.current !== null) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
    setFps(0);
  }, []);

  // ── Stop stream (internal) ───────────────────────────────────────────────
  const teardownStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopFpsCounter();
    setResolution(null);
  }, [stopFpsCounter]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      teardownStream();
    };
  }, [teardownStream]);

  // ── Start camera ─────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    teardownStream();
    setCameraState("initializing");
    setErrorMessage("");

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "environment" },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Resolve actual resolution from track settings
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        setResolution({
          width: settings.width ?? videoRef.current.videoWidth,
          height: settings.height ?? videoRef.current.videoHeight,
        });
      }

      // After acquiring stream, re-enumerate to get device labels (browser policy)
      await enumerateDevices();

      startFpsCounter();
      setCameraState("streaming");
    } catch (err: unknown) {
      teardownStream();
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraState("permission_denied");
        setErrorMessage("Camera access was denied. Open browser settings and allow camera permission for this site.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraState("not_found");
        setErrorMessage("No camera detected. Please connect a USB or built-in camera and try again.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setCameraState("error");
        setErrorMessage("Camera is in use by another application. Close other apps and retry.");
      } else if (name === "OverconstrainedError") {
        setCameraState("error");
        setErrorMessage("Selected camera does not support the requested resolution. Try a different camera.");
      } else {
        setCameraState("error");
        setErrorMessage(`Unexpected error: ${msg}`);
      }
    }
  }, [selectedDeviceId, enumerateDevices, startFpsCounter, teardownStream]);

  // ── Stop camera ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    teardownStream();
    setCameraState("stopped");
  }, [teardownStream]);

  // ── Select device (hot-swap capable) ────────────────────────────────────
  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      // If currently streaming, restart with new device immediately
      if (cameraState === "streaming") {
        teardownStream();
        setCameraState("waiting");
      }
    },
    [cameraState, teardownStream]
  );

  // ── Phase 2 extension: capture a JPEG Blob from the live stream ──────────
  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || cameraState !== "streaming") return null;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  }, [cameraState]);

  return {
    videoRef,
    cameraState,
    errorMessage,
    fps,
    resolution,
    devices,
    selectedDeviceId,
    startCamera,
    stopCamera,
    selectDevice,
    captureFrame,
  };
}
