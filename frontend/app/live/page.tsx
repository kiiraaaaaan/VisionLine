"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  VideoOff,
  RefreshCw,
  AlertTriangle,
  Camera,
  ChevronDown,
  Activity,
  Cpu,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  BarChart2,
  Play,
  Square,
  ArrowRight,
  Settings,
  ExternalLink,
  RotateCcw
} from "lucide-react";
import { API_BASE } from "../config";

interface ActiveStream {
  deviceId: string;
  label: string;
  stream: MediaStream;
  ipUrl?: string;
  imageKey?: number;
  status: "NORMAL" | "DEFECTIVE" | "HUMAN" | "ERROR" | "IDLE";
  confidence: number;
  isAnalyzing: boolean;
}

interface DefectLog {
  id: string;
  timestamp: Date;
  cameraLabel: string;
  confidence: number;
  totalTimeMs: number;
}

export default function LiveInspectionPage() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [activeStreams, setActiveStreams] = useState<ActiveStream[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(1.5);
  
  // Local network / IP Camera inputs
  const [newIpLabel, setNewIpLabel] = useState("");
  const [newIpUrl, setNewIpUrl] = useState("");

  // Batch stats
  const [batchStats, setBatchStats] = useState({
    total: 0,
    passed: 0,
    rejected: 0
  });

  // Separation lane / triggers
  const [diverterStatus, setDiverterStatus] = useState<"NORMAL LANE" | "REJECT LANE">("NORMAL LANE");
  const [activeWarning, setActiveWarning] = useState<string | null>(null);
  const [defectLogs, setDefectLogs] = useState<DefectLog[]>([]);

  const videoRefs = useRef<{ [deviceId: string]: HTMLVideoElement | null }>({});

  // 1. Enumerate connected video input devices
  const initDevices = useCallback(async () => {
    try {
      // Prompt user for camera permission if not granted
      await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
      const list = await navigator.mediaDevices.enumerateDevices();
      const cameras = list.filter(d => d.kind === "videoinput");
      
      setDevices(prev => {
        // Keep browser webcams + custom added local IP cameras
        const manualIpCams = prev.filter(d => d.deviceId.startsWith("ip-"));
        return [...cameras, ...manualIpCams];
      });
      
      // Auto-select first camera by default
      if (cameras.length > 0 && selectedDevices.length === 0) {
        setSelectedDevices([cameras[0].deviceId]);
      }
    } catch (e) {
      console.error("Error enumerating devices:", e);
    }
  }, [selectedDevices]);

  useEffect(() => {
    initDevices();
    navigator.mediaDevices.addEventListener("devicechange", initDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", initDevices);
    };
  }, [initDevices]);

  // Handle checking / unchecking cameras
  const handleToggleDevice = (deviceId: string) => {
    if (selectedDevices.includes(deviceId)) {
      setSelectedDevices(prev => prev.filter(id => id !== deviceId));
    } else {
      setSelectedDevices(prev => [...prev, deviceId]);
    }
  };

  // Add custom local camera feed
  const handleAddIpCamera = () => {
    if (!newIpUrl || !newIpLabel) return;
    const cleanUrl = newIpUrl.trim();
    const cleanLabel = newIpLabel.trim();
    const deviceId = `ip-${cleanUrl}`;
    
    setDevices(prev => [
      ...prev,
      {
        deviceId,
        label: `📶 ${cleanLabel}`,
        groupId: "ip-cameras"
      } as any
    ]);
    
    setSelectedDevices(prev => [...prev, deviceId]);
    setNewIpLabel("");
    setNewIpUrl("");
  };

  // Helper to update individual stream states inside the array
  const updateStreamState = useCallback((deviceId: string, updates: Partial<ActiveStream>) => {
    setActiveStreams(prev =>
      prev.map(s => (s.deviceId === deviceId ? { ...s, ...updates } : s))
    );
  }, []);

  // 2. Perform frame capture and AI analysis
  const captureAndInspect = useCallback(async (cam: ActiveStream) => {
    // If it's a local network IP camera URL, fetch directly via backend proxy
    if (cam.ipUrl) {
      updateStreamState(cam.deviceId, { isAnalyzing: true });
      try {
        const res = await fetch(`${API_BASE}/analyze/frame?threshold=0.90&url=${encodeURIComponent(cam.ipUrl)}`, {
          method: "POST"
        });

        if (res.ok) {
          const data = await res.json();
          console.log(`[IP Scan Result for ${cam.label}]:`, data);
          const isDef = data.status === "DEFECTIVE";

          setBatchStats(prev => ({
            total: prev.total + 1,
            passed: prev.passed + (isDef ? 0 : 1),
            rejected: prev.rejected + (isDef ? 1 : 0)
          }));

          if (isDef) {
            setDiverterStatus("REJECT LANE");
            setActiveWarning(`Defect detected on Wi-Fi feed: ${cam.label}`);

            // Save defective frame using backend proxy URL
            const saveRes = await fetch(`${API_BASE}/inspections/upload?threshold=0.90&url=${encodeURIComponent(cam.ipUrl)}`, {
              method: "POST"
            });

            if (saveRes.ok) {
              const saveData = await saveRes.json();
              setDefectLogs(prev => [
                {
                  id: saveData.id,
                  timestamp: new Date(),
                  cameraLabel: cam.label,
                  confidence: data.confidence,
                  totalTimeMs: data.total_time_ms
                },
                ...prev.slice(0, 9)
              ]);
            }
          } else {
            setDiverterStatus("NORMAL LANE");
            setActiveWarning(null);
          }

          updateStreamState(cam.deviceId, {
            status: data.status,
            confidence: data.confidence,
            imageKey: Date.now(), // update key to trigger refresh of IP preview card
            isAnalyzing: false
          });
        } else {
          console.error(`[IP Scan HTTP Error for ${cam.label}]:`, res.status, res.statusText);
          updateStreamState(cam.deviceId, { status: "ERROR", isAnalyzing: false });
        }
      } catch (err) {
        console.error(`[IP Scan Fetch Catch for ${cam.label}]:`, err);
        updateStreamState(cam.deviceId, { status: "ERROR", isAnalyzing: false });
      }
      return;
    }

    // Otherwise, capture local webcam stream
    const video = videoRefs.current[cam.deviceId];
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      console.log(`[Capture Skip for ${cam.label}]: video=${!!video}, readyState=${video?.readyState}, size=${video?.videoWidth}x${video?.videoHeight}`);
      return;
    }

    console.log(`[Capture Start for ${cam.label}]: size=${video.videoWidth}x${video.videoHeight}`);
    updateStreamState(cam.deviceId, { isAnalyzing: true });

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          updateStreamState(cam.deviceId, { isAnalyzing: false });
          return;
        }

        const formData = new FormData();
        formData.append("file", blob, `live_${cam.deviceId}.jpg`);

        try {
          const res = await fetch(`${API_BASE}/analyze/frame?threshold=0.90`, {
            method: "POST",
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            console.log(`[Inspection Result for ${cam.label}]:`, data);
            const isDef = data.status === "DEFECTIVE";

            setBatchStats(prev => ({
              total: prev.total + 1,
              passed: prev.passed + (isDef ? 0 : 1),
              rejected: prev.rejected + (isDef ? 1 : 0)
            }));

            if (isDef) {
              setDiverterStatus("REJECT LANE");
              setActiveWarning(`Defect detected on ${cam.label}`);

              const saveForm = new FormData();
              saveForm.append("file", blob, `live_defect_${Date.now()}.jpg`);
              const saveRes = await fetch(`${API_BASE}/inspections/upload?threshold=0.90`, {
                method: "POST",
                body: saveForm
              });

              if (saveRes.ok) {
                const saveData = await saveRes.json();
                setDefectLogs(prev => [
                  {
                    id: saveData.id,
                    timestamp: new Date(),
                    cameraLabel: cam.label,
                    confidence: data.confidence,
                    totalTimeMs: data.total_time_ms
                  },
                  ...prev.slice(0, 9)
                ]);
              }
            } else {
              setDiverterStatus("NORMAL LANE");
              setActiveWarning(null);
            }

            updateStreamState(cam.deviceId, {
              status: data.status,
              confidence: data.confidence,
              isAnalyzing: false
            });
          } else {
            console.error(`[Inspection HTTP Error for ${cam.label}]:`, res.status, res.statusText);
            updateStreamState(cam.deviceId, { status: "ERROR", isAnalyzing: false });
          }
        } catch (err) {
          console.error(`[Inspection Fetch Catch for ${cam.label}]:`, err);
          updateStreamState(cam.deviceId, { status: "ERROR", isAnalyzing: false });
        }
      }, "image/jpeg", 0.90);
    } catch (err) {
      console.error(`[Inspection Capture Catch for ${cam.label}]:`, err);
      updateStreamState(cam.deviceId, { isAnalyzing: false });
    }
  }, [updateStreamState]);

  // 3. Loop runner
  useEffect(() => {
    if (!isStreaming || activeStreams.length === 0) return;

    const interval = setInterval(() => {
      activeStreams.forEach(stream => {
        captureAndInspect(stream);
      });
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [isStreaming, activeStreams, intervalSeconds, captureAndInspect]);

  // Start Multi Camera Stream
  const startStreaming = async () => {
    if (selectedDevices.length === 0) return;
    setIsStreaming(true);
    setDiverterStatus("NORMAL LANE");
    setActiveWarning(null);

    const streams: ActiveStream[] = [];
    for (const deviceId of selectedDevices) {
      if (deviceId.startsWith("ip-")) {
        const ipUrl = deviceId.substring(3);
        const label = devices.find(d => d.deviceId === deviceId)?.label || "Local Network Feed";
        streams.push({
          deviceId,
          label,
          stream: null as any,
          ipUrl,
          imageKey: Date.now(),
          status: "IDLE",
          confidence: 0,
          isAnalyzing: false
        });
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          });
          const label = devices.find(d => d.deviceId === deviceId)?.label || "Camera Feed";
          streams.push({
            deviceId,
            label,
            stream,
            status: "IDLE",
            confidence: 0,
            isAnalyzing: false
          });
        } catch (e) {
          console.error("Failed to acquire stream for camera device:", deviceId, e);
        }
      }
    }
    setActiveStreams(streams);
  };

  // Stop Stream
  const stopStreaming = () => {
    setIsStreaming(false);
    activeStreams.forEach(s => {
      if (s.stream) {
        s.stream.getTracks().forEach(track => track.stop());
      }
    });
    setActiveStreams([]);
    setActiveWarning(null);
    setDiverterStatus("NORMAL LANE");
  };

  const resetBatch = () => {
    setBatchStats({ total: 0, passed: 0, rejected: 0 });
    setDefectLogs([]);
    setActiveWarning(null);
    setDiverterStatus("NORMAL LANE");
  };

  const defectRate = batchStats.total > 0
    ? Math.round((batchStats.rejected / batchStats.total) * 1000) / 10
    : 0.0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#e5e5ea] pb-6">
        <div>
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-1">Live Multi-Stream Terminal</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">Conveyor Belt Workstation</h1>
          <p className="text-[#86868b] text-sm mt-1 font-medium font-sans">
            Stream live feeds from local webcams or Wi-Fi IP cameras simultaneously and automate defect sorting actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34c759]" />
            </span>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]" />
          )}
          <span className="text-xs font-bold text-[#1d1d1f] tracking-wide uppercase">
            {isStreaming ? "Streaming Active" : "Line Idle"}
          </span>
        </div>
      </div>

      {/* Batch Statistics Dashboard Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e5e5ea] shadow-apple-card">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block mb-1">Batch Total inspected</span>
          <span className="text-3xl font-black text-[#1d1d1f] font-mono">{batchStats.total}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#e5e5ea] shadow-apple-card">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block mb-1">Passed (Non-Defective)</span>
          <span className="text-3xl font-black text-[#34c759] font-mono">{batchStats.passed}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#e5e5ea] shadow-apple-card">
          <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block mb-1">Rejected (Defective)</span>
          <span className="text-3xl font-black text-[#ff3b30] font-mono">{batchStats.rejected}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#e5e5ea] shadow-apple-card flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block mb-1">Defect Yield Rate</span>
            <span className={`text-3xl font-black font-mono ${defectRate > 15 ? "text-[#ff3b30]" : defectRate > 0 ? "text-[#ff9500]" : "text-[#34c759]"}`}>
              {defectRate}%
            </span>
          </div>
          <button onClick={resetBatch} className="p-2.5 hover:bg-[#f5f5f7] active:scale-95 border border-[#e5e5ea] rounded-xl text-[#ff3b30] transition" title="Reset Batch Stats">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warning Trigger Lane Alert */}
      {activeWarning && (
        <div className="p-4 bg-[#ff3b30]/10 border-2 border-[#ff3b30] rounded-2xl flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-[#ff3b30]" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-[#ff3b30] uppercase tracking-wider">⚠️ Critical Warning: Defect Caught!</h4>
            <p className="text-xs text-[#1d1d1f] font-semibold mt-0.5">{activeWarning} · Actuating pneumatic diverter gate to separate defective lane.</p>
          </div>
          <span className="px-3 py-1 bg-[#ff3b30] text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">Diverter Active</span>
        </div>
      )}

      {/* Main Grid: Left Controls, Right Camera Stream cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Side: Setup Controls */}
        <div className="lg:col-span-1 space-y-6">

          {/* Camera Selector Card */}
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
            <div className="p-4 border-b border-[#e5e5ea] bg-[#f5f5f7]/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0071e3]" /> Connect Feeds
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">Available Input Feeds</label>
                {devices.length === 0 ? (
                  <p className="text-xs text-[#86868b] italic">No cameras detected. Grant permission or plug in webcams.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {devices.map(device => {
                      const isChecked = selectedDevices.includes(device.deviceId);
                      return (
                        <label key={device.deviceId} className="flex items-center gap-3 p-2.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7]/30 hover:bg-[#f5f5f7] cursor-pointer transition">
                          <input type="checkbox" checked={isChecked} onChange={() => handleToggleDevice(device.deviceId)} disabled={isStreaming} className="rounded text-[#0071e3] focus:ring-0 w-4 h-4" />
                          <span className="text-xs font-bold text-[#1d1d1f] truncate">{device.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Wi-Fi / IP Camera Section */}
              <div className="pt-4 border-t border-[#e5e5ea] space-y-3">
                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">Add Local Wi-Fi / IP Camera</span>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Feed Label (e.g. Wi-Fi Cam 1)"
                    value={newIpLabel}
                    onChange={e => setNewIpLabel(e.target.value)}
                    disabled={isStreaming}
                    className="w-full text-xs bg-white border border-[#d1d1d6] rounded-xl px-3 py-2 focus:outline-none focus:border-[#0071e3] transition font-medium"
                  />
                  <input
                    type="text"
                    placeholder="URL (e.g. http://192.168.1.100:8080/shot.jpg)"
                    value={newIpUrl}
                    onChange={e => setNewIpUrl(e.target.value)}
                    disabled={isStreaming}
                    className="w-full text-xs bg-white border border-[#d1d1d6] rounded-xl px-3 py-2 focus:outline-none focus:border-[#0071e3] transition font-mono"
                  />
                  <button
                    onClick={handleAddIpCamera}
                    disabled={isStreaming || !newIpUrl || !newIpLabel}
                    className="w-full py-2 bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-sm"
                  >
                    Add Local Camera
                  </button>
                </div>
                <p className="text-[9px] text-[#86868b] leading-normal">
                  Connect local Wi-Fi IP cameras manually. Supports MJPEG video feeds or static JPEG endpoints (e.g., from phone IP Webcam apps).
                </p>
              </div>

              <div className="flex gap-3 pt-2 border-t border-[#e5e5ea]">
                {isStreaming ? (
                  <button onClick={stopStreaming} className="w-full py-3 bg-[#ff3b30] hover:bg-[#e0352b] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm">
                    <Square className="w-4 h-4" /> Stop Live Stream
                  </button>
                ) : (
                  <button onClick={startStreaming} disabled={selectedDevices.length === 0} className="w-full py-3 bg-[#34c759] hover:bg-[#2fb04f] disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm">
                    <Play className="w-4 h-4" /> Start Live Stream
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Telemetry settings */}
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
            <div className="p-4 border-b border-[#e5e5ea] bg-[#f5f5f7]/50">
              <h3 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2"><Settings className="w-4 h-4 text-[#5856d6]" />Telemetry Interval</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Analysis interval</label>
                <div className="relative">
                  <select value={intervalSeconds} onChange={e => setIntervalSeconds(parseFloat(e.target.value))}
                    className="w-full text-xs bg-white border border-[#d1d1d6] rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:border-[#0071e3] transition appearance-none font-medium text-[#1d1d1f]">
                    <option value="1.0">High Frequency (1.0 sec)</option>
                    <option value="1.5">Standard Frequency (1.5 sec)</option>
                    <option value="2.0">Low Frequency (2.0 sec)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Lane Separator profile */}
          <div className="p-4 bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl space-y-2 text-[10px] text-[#86868b] leading-relaxed">
            <span className="font-bold text-[#1d1d1f] uppercase tracking-wider block mb-1">Actuator lane profile</span>
            <div className="flex justify-between">
              <span>Lane Status:</span>
              <span className={`font-bold uppercase ${diverterStatus === "REJECT LANE" ? "text-[#ff3b30]" : "text-[#34c759]"}`}>
                {diverterStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Trigger:</span>
              <span className="font-bold text-[#ff3b30]">Pneumatic Air-Jet Separator</span>
            </div>
            <div className="flex justify-between">
              <span>Classifier Target:</span>
              <span className="font-bold text-[#0071e3] font-mono">industry_defect.keras</span>
            </div>
          </div>
        </div>

        {/* Right Side: Active Camera grid */}
        <div className="lg:col-span-3">
          {activeStreams.length === 0 ? (
            <div className="bg-[#0a0a0c] border border-[#1d1d1f] rounded-3xl h-[420px] flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="p-4 bg-[#1f1f23] border border-[#2d2d2f] rounded-full"><VideoOff className="w-12 h-12 text-[#86868b]" /></div>
              <div>
                <h3 className="text-white font-bold text-base">Live Video Feeds Inactive</h3>
                <p className="text-[#86868b] text-xs max-w-sm mt-1 mx-auto leading-relaxed">Select cameras from the panel on the left and click "Start Live Stream" to monitor conveyor pipelines.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeStreams.map(stream => {
                const hasResult = stream.status !== "IDLE";
                const isDef = stream.status === "DEFECTIVE";
                return (
                  <div key={stream.deviceId} className={`bg-[#0a0a0c] rounded-2xl overflow-hidden border-4 transition-all duration-300 relative shadow-lg ${
                    stream.status === "DEFECTIVE" ? "border-[#ff3b30] shadow-[0_0_12px_rgba(255,59,48,0.3)]" :
                    stream.status === "NORMAL" ? "border-[#34c759] shadow-[0_0_12px_rgba(52,199,89,0.3)]" :
                    stream.status === "HUMAN" ? "border-[#0071e3] shadow-[0_0_12px_rgba(0,113,227,0.3)]" : "border-[#1d1d1f]"
                  }`}>
                    
                    {/* Stream Header */}
                    <div className="absolute top-3 inset-x-3 pointer-events-none flex items-center justify-between z-20">
                      <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider truncate max-w-[180px]">
                        {stream.label}
                      </span>
                      {stream.isAnalyzing && (
                        <span className="bg-[#ff9500] text-white px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing
                        </span>
                      )}
                    </div>

                    {/* Live Video Feed */}
                    <div className="relative aspect-video bg-black flex items-center justify-center">
                      {stream.ipUrl ? (
                        <div className="w-full h-full flex flex-col items-center justify-center relative">
                          <img
                            src={`${stream.ipUrl}${stream.ipUrl.includes('?') ? '&' : '?'}t=${stream.imageKey || 0}`}
                            alt={stream.label}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              console.log("Direct IP preview load failed.");
                            }}
                          />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white/40 select-none pointer-events-none">
                            <Zap className="w-8 h-8 mx-auto opacity-30 animate-pulse" />
                            <p className="text-[9px] mt-1 font-bold tracking-wider">LOCAL WI-FI INFERENCE FEED ACTIVE</p>
                          </div>
                        </div>
                      ) : (
                        <video
                          ref={el => {
                            videoRefs.current[stream.deviceId] = el;
                            if (el && stream.stream && el.srcObject !== stream.stream) {
                              el.srcObject = stream.stream;
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-contain"
                        />
                      )}

                      {/* HUD colored status overlay label */}
                      {hasResult && (
                        <div className={`absolute bottom-3 right-3 px-3.5 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-black uppercase tracking-wider z-20 ${
                          isDef ? "bg-[#ff3b30]/85 border-[#ff3b30]/35 text-white" :
                          stream.status === "NORMAL" ? "bg-[#34c759]/85 border-[#34c759]/35 text-white" :
                          stream.status === "HUMAN" ? "bg-[#0071e3]/85 border-[#0071e3]/35 text-white" : "bg-black/80 border-white/10 text-white"
                        }`}>
                          {stream.status === "DEFECTIVE" ? `DEFECTIVE (${Math.round(stream.confidence * 100)}%)` :
                           stream.status === "NORMAL" ? `NORMAL (${Math.round(stream.confidence * 100)}%)` :
                           stream.status === "HUMAN" ? "HUMAN" :
                           stream.status === "ERROR" ? "ERROR" : "UNSUPPORTED"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Defect Logs Timeline */}
      {isStreaming && (
        <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden mt-6">
          <div className="p-5 border-b border-[#e5e5ea] bg-[#f5f5f7]/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1d1d1f]">Live Batch Defect Logs</h2>
              <p className="text-[#86868b] text-[10px] font-semibold mt-0.5">
                Defective items detected during this session, auto-vaulted into the PostgreSQL database.
              </p>
            </div>
            <Link href="/inspections" className="text-xs text-[#0071e3] hover:underline font-bold flex items-center gap-1">
              History Gallery <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {defectLogs.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e5e5ea] bg-[#f5f5f7]/50 text-[#86868b] font-extrabold uppercase text-[9px] tracking-wider">
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5">Inspection ID</th>
                    <th className="py-3 px-5">Trigger Feed</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Defect Confidence</th>
                    <th className="py-3 px-5">Latency</th>
                    <th className="py-3 px-5 text-right font-bold pr-6">Vault Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f5f7] font-semibold text-[#1d1d1f]">
                  {defectLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#f5f5f7]/30 transition">
                      <td className="py-3.5 px-5 font-mono text-[#86868b]">{log.timestamp.toLocaleTimeString()}</td>
                      <td className="py-3.5 px-5 font-mono text-[10px]">{log.id}</td>
                      <td className="py-3.5 px-5 text-[#5856d6] font-bold">{log.cameraLabel}</td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" /> FAIL
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[#ff3b30]">{Math.round(log.confidence * 100)}%</td>
                      <td className="py-3.5 px-5 font-mono text-[#86868b]">{log.totalTimeMs.toFixed(1)} ms</td>
                      <td className="py-3.5 px-5 text-right pr-6">
                        <Link href={`/inspections/${log.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] hover:text-[#0071e3] border border-[#d1d1d6] rounded-xl text-[10px] font-bold transition">
                          View details <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-[#86868b] space-y-2">
                <BarChart2 className="w-10 h-10 text-[#d1d1d6] mx-auto animate-pulse" />
                <p className="text-xs font-semibold">No defects detected in this session yet.</p>
                <p className="text-[10px]">Start the streaming loops. Defective parts will populate this grid.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
