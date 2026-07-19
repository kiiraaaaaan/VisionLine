"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Smartphone, Zap, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

export default function MobileCamPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "default-session";
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [backendIp, setBackendIp] = useState("");
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBackendIp(window.location.hostname);
      const secure = window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      setIsSecure(secure);
      
      if (!secure) {
        setErrorMsg("⚠️ browser Security Policy: Mobile browsers block camera access on unencrypted HTTP local networks. To use this browser scanner, load the platform over HTTPS, or see the IP Webcam app instructions below.");
      }
    }
  }, []);

  const startPhoneCamera = async () => {
    setErrorMsg(null);
    if (!isSecure) {
      setErrorMsg("Unable to access camera on insecure context. Please use the IP Webcam App option below.");
      return;
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Request back camera
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsStreaming(true);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Camera access denied or unavailable. Grant camera permission in your mobile browser settings.");
    }
  };

  const stopPhoneCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsStreaming(false);
  };

  // Upload frame loop
  useEffect(() => {
    if (!isStreaming || !stream || !backendIp) return;

    let active = true;
    const intervalTime = 1000;

    const loop = async () => {
      if (!active) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            canvas.toBlob(async (blob) => {
              if (blob && active) {
                const formData = new FormData();
                formData.append("file", blob, `mobile_${sessionId}.jpg`);

                try {
                  const res = await fetch(`http://${backendIp}:8000/api/analyze/mobile-stream/${sessionId}`, {
                    method: "POST",
                    body: formData
                  });
                  if (res.ok) {
                    setUploadCount(prev => prev + 1);
                    setErrorMsg(null); // clear connection error on success
                  } else {
                    setErrorMsg(`Backend returned error status: ${res.status} ${res.statusText}`);
                  }
                } catch (err: any) {
                  console.error("Failed to upload phone frame:", err);
                  setErrorMsg(`Connection Failed: Unable to reach the inspection computer at http://${backendIp}:8000. Verify your phone is connected to the same Wi-Fi.`);
                }
              }
            }, "image/jpeg", 0.85);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setTimeout(loop, intervalTime);
    };

    loop();

    return () => {
      active = false;
    };
  }, [isStreaming, stream, backendIp, sessionId]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans select-none pb-12">
      
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#0071e3]" />
          <span className="text-sm font-extrabold tracking-wider uppercase">VisionLine Mobile Streamer</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isStreaming ? (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34c759]" />
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#ff3b30]" />
          )}
          <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">
            {isStreaming ? "Live Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {errorMsg && (
          <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-red-950/30 border border-red-800/60 text-red-400 text-xs flex gap-2.5 items-start z-30 leading-relaxed">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className={`w-full aspect-[4/3] max-w-md rounded-3xl overflow-hidden relative border-2 ${isStreaming ? "border-[#0071e3]" : "border-white/10"} bg-black flex items-center justify-center shadow-2xl mb-6`}>
          {isStreaming ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white/90">Awaiting Connection</h3>
                <p className="text-xs text-white/40 max-w-[240px] mt-1 mx-auto">Tap the button below to start your camera stream.</p>
              </div>
            </div>
          )}

          {/* Active Overlay Reticle */}
          {isStreaming && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-48 h-48 border border-white/20 rounded-2xl">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#0071e3] rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#0071e3] rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#0071e3] rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#0071e3] rounded-br-lg" />
                <div className="absolute left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] top-0 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>

        {isStreaming ? (
          <button
            onClick={stopPhoneCamera}
            className="w-full max-w-md py-4 bg-white/10 hover:bg-white/15 text-white font-bold text-sm rounded-2xl transition duration-200"
          >
            Stop Streaming
          </button>
        ) : (
          <button
            onClick={startPhoneCamera}
            className="w-full max-w-md py-4 bg-[#34c759] hover:bg-[#2fb04f] disabled:opacity-40 text-white font-bold text-sm rounded-2xl transition duration-200 shadow-lg shadow-[#34c759]/20"
          >
            Start Live Camera
          </button>
        )}
      </div>

      {/* Alternative Wi-Fi Camera Connection Help Card */}
      <div className="px-6 max-w-md mx-auto w-full">
        <div className="p-5 bg-white/5 border border-white/10 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white/90">
            <HelpCircle className="w-4.5 h-4.5 text-[#ff9500]" />
            <span>Alternative: Connect via IP Webcam App</span>
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">
            If browser security blocks this page's camera context, you can turn your phone into a professional IP camera instantly:
          </p>
          <ol className="text-[11px] text-white/50 space-y-2 list-decimal list-inside pl-1">
            <li>Install a free app like <b>IP Webcam</b> (Android) or <b>Larix Broadcaster</b> (iOS).</li>
            <li>Launch the server in the app on your phone.</li>
            <li>Copy the local URL shown in the app (e.g. <code>http://192.168.29.54:8080/shot.jpg</code>).</li>
            <li>Paste it into the <b>Add Local Wi-Fi / IP Camera</b> box on the computer page.</li>
          </ol>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>

    </div>
  );
}
