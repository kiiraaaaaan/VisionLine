/**
 * useAnalysisEngine — Phase 2 Live AI Analysis Hook
 *
 * Continuously requests frames from the camera module and sends them
 * to the backend AI pipeline for inference.
 *
 * Design principles:
 *   - Camera module is never modified or accessed directly.
 *     The engine only consumes `captureFrame` (a pure async function).
 *   - Exactly one backend request may be in-flight at a time.
 *     If a request is running, the scheduled tick is skipped (no queue, no backpressure).
 *   - No database writes. No inspection records. No side effects.
 *   - Phase 3 will receive `latestPrediction` and decide when to persist.
 *
 * Phase 3 extension points:
 *   - Subscribe to `latestPrediction` for event detection logic
 *   - Call `setIntervalMs(n)` to tune throughput
 *   - Replace `ANALYZE_ENDPOINT` to target edge inference in the future
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYZE_ENDPOINT = `${API_BASE}/analyze/frame`;

export const DEFAULT_INTERVAL_MS = 500; // ~2 fps analysis rate

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalysisState =
  | "idle"        // Engine is not running
  | "waiting"     // Running but camera not ready
  | "analyzing"   // Request in flight
  | "completed"   // Last request succeeded
  | "error";      // Last request failed

export interface FramePrediction {
  status: "NORMAL" | "DEFECTIVE" | "UNSUPPORTED" | "ERROR";
  confidence: number;           // 0.0 – 1.0, relative to predicted class
  rawDefectProbability: number; // Raw model output
  isLowConfidence: boolean;
  yoloTimeMs: number;
  kerasTimeMs: number;
  totalTimeMs: number;
  message: string | null;
  capturedAt: Date;             // When the frame was taken
  receivedAt: Date;             // When the result arrived
}

export interface UseAnalysisEngineReturn {
  // State
  analysisState: AnalysisState;
  latestPrediction: FramePrediction | null;
  lastAnalysisTime: Date | null;
  totalFramesAnalyzed: number;
  engineError: string;

  // Controls
  startEngine: () => void;
  stopEngine: () => void;

  // Configuration (adjustable at runtime without restarting)
  intervalMs: number;
  setIntervalMs: (ms: number) => void;

  // Threshold (passed to backend per-request)
  threshold: number;
  setThreshold: (t: number) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalysisEngine(
  captureFrame: () => Promise<Blob | null>,
  isCameraStreaming: boolean
): UseAnalysisEngineReturn {
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [latestPrediction, setLatestPrediction] = useState<FramePrediction | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [totalFramesAnalyzed, setTotalFramesAnalyzed] = useState(0);
  const [engineError, setEngineError] = useState("");
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [threshold, setThreshold] = useState(0.50);

  // Refs — no renders triggered
  const isBusyRef = useRef(false);        // True while a request is in-flight
  const isRunningRef = useRef(false);     // True while the engine loop is active
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalMsRef = useRef(intervalMs);
  const thresholdRef = useRef(threshold);

  // Keep refs in sync with state (avoids stale closures in the interval)
  useEffect(() => { intervalMsRef.current = intervalMs; }, [intervalMs]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  // ── Core analysis tick ───────────────────────────────────────────────────
  const analyseTick = useCallback(async () => {
    // Guard 1: engine disabled
    if (!isRunningRef.current) return;

    // Guard 2: camera not ready — skip this tick, engine stays running
    if (!isCameraStreaming) {
      setAnalysisState("waiting");
      return;
    }

    // Guard 3: previous request still in flight — skip without queueing
    if (isBusyRef.current) return;

    isBusyRef.current = true;
    setAnalysisState("analyzing");
    const capturedAt = new Date();

    try {
      // ── Step 1: Grab a frame from the camera module ──────────────────
      const blob = await captureFrame();

      if (!blob) {
        // Camera stopped between tick start and frame capture
        isBusyRef.current = false;
        setAnalysisState("waiting");
        return;
      }

      // ── Step 2: Send frame to the backend AI pipeline ────────────────
      const formData = new FormData();
      formData.append("file", blob, `frame_${capturedAt.getTime()}.jpg`);

      const res = await fetch(
        `${ANALYZE_ENDPOINT}?threshold=${thresholdRef.current}`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail || `HTTP ${res.status}`);
      }

      // ── Step 3: Parse and surface the prediction ─────────────────────
      const data = await res.json();
      const receivedAt = new Date();

      const prediction: FramePrediction = {
        status: data.status,
        confidence: data.confidence,
        rawDefectProbability: data.raw_defect_probability,
        isLowConfidence: data.is_low_confidence,
        yoloTimeMs: data.yolo_time_ms,
        kerasTimeMs: data.keras_time_ms,
        totalTimeMs: data.total_time_ms,
        message: data.message ?? null,
        capturedAt,
        receivedAt,
      };

      setLatestPrediction(prediction);
      setLastAnalysisTime(receivedAt);
      setTotalFramesAnalyzed((n) => n + 1);
      setEngineError("");
      setAnalysisState("completed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEngineError(msg);
      setAnalysisState("error");
      // Engine continues — next tick will retry automatically
    } finally {
      isBusyRef.current = false;
    }
  }, [captureFrame, isCameraStreaming]);

  // ── Start / stop engine ──────────────────────────────────────────────────
  const clearLoop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startEngine = useCallback(() => {
    if (isRunningRef.current) return; // Already running
    isRunningRef.current = true;
    isBusyRef.current = false;
    setEngineError("");
    setAnalysisState(isCameraStreaming ? "waiting" : "idle");

    // Schedule recurring analysis ticks
    intervalRef.current = setInterval(analyseTick, intervalMsRef.current);
  }, [analyseTick, isCameraStreaming]);

  const stopEngine = useCallback(() => {
    isRunningRef.current = false;
    isBusyRef.current = false;
    clearLoop();
    setAnalysisState("idle");
    setEngineError("");
  }, [clearLoop]);

  // ── Restart loop when intervalMs changes (without stopping engine) ───────
  const handleSetIntervalMs = useCallback(
    (ms: number) => {
      setIntervalMs(ms);
      intervalMsRef.current = ms;
      if (isRunningRef.current) {
        clearLoop();
        intervalRef.current = setInterval(analyseTick, ms);
      }
    },
    [analyseTick, clearLoop]
  );

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      clearLoop();
    };
  }, [clearLoop]);

  return {
    analysisState,
    latestPrediction,
    lastAnalysisTime,
    totalFramesAnalyzed,
    engineError,
    startEngine,
    stopEngine,
    intervalMs,
    setIntervalMs: handleSetIntervalMs,
    threshold,
    setThreshold,
  };
}
