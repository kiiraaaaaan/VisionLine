"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Cpu,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  Info,
  ShieldCheck,
  Layers,
  Settings,
  Database,
  ArrowUpRight,
  Layers3,
  Terminal,
  ActivitySquare
} from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load heavy Three.js canvases — page renders immediately, 3D loads in background
const ThreeDViewer = dynamic(() => import("./components/ThreeDViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[460px] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ThreeDConveyor = dynamic(() => import("./components/ThreeDConveyor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[460px] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// Decorative 3D elements — fill whitespace sections
const ThreeNeuralParticles = dynamic(() => import("./components/ThreeNeuralParticles"), {
  ssr: false,
  loading: () => <div />,
});

const ThreeFloatingShapes = dynamic(() => import("./components/ThreeFloatingShapes"), {
  ssr: false,
  loading: () => <div />,
});

const ThreeScanRings = dynamic(() => import("./components/ThreeScanRings"), {
  ssr: false,
  loading: () => <div />,
});


export default function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Pipeline scroll-driven animation state — continuous progress (0 to 1)
  const [card1Progress, setCard1Progress] = useState(0);
  const [card2Progress, setCard2Progress] = useState(0);
  const [card3Progress, setCard3Progress] = useState(0);
  const [dotY, setDotY] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const stage1Ref = useRef<HTMLDivElement>(null);
  const stage2Ref = useRef<HTMLDivElement>(null);
  const stage3Ref = useRef<HTMLDivElement>(null);
  const dot1Ref = useRef<HTMLDivElement>(null);
  const dot2Ref = useRef<HTMLDivElement>(null);
  const dot3Ref = useRef<HTMLDivElement>(null);

  // Metrics text scroll-driven reveal — 3 staggered lines
  const [metricsLine1Progress, setMetricsLine1Progress] = useState(0);
  const [metricsLine2Progress, setMetricsLine2Progress] = useState(0);
  const [metricsLine3Progress, setMetricsLine3Progress] = useState(0);
  const metricsTextRef = useRef<HTMLDivElement>(null);

  // 1. Mouse Move Parallax Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    // Map coordinates to a subtle offset range (-24px to +24px)
    const x = (clientX / window.innerWidth - 0.5) * 48;
    const y = (clientY / window.innerHeight - 0.5) * 48;
    setMousePos({ x, y });
  };

  // 2. Scroll Reveal Observer Hook
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            if (entry.target.id === "metrics") {
              setMetricsVisible(true);
            }
          } else {
            if (entry.target.id === "metrics") {
              setMetricsVisible(false);
            }
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    const elements = document.querySelectorAll(".reveal-hidden");
    elements.forEach((el) => observer.observe(el));

    const metricsEl = document.getElementById("metrics");
    if (metricsEl) observer.observe(metricsEl);

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      if (metricsEl) observer.unobserve(metricsEl);
    };
  }, []);

  // 2b. Pipeline scroll-driven card zoom + traveling dot
  useEffect(() => {
    const handlePipelineScroll = () => {
      const vh = window.innerHeight;

      // Compute a 0→1 progress for each card based on how far it has entered the viewport.
      // Window: card starts animating when its top hits 85% down the screen,
      // and is fully revealed when it reaches 40% from the top.
      const getProgress = (ref: React.RefObject<HTMLDivElement>) => {
        if (!ref.current) return 0;
        const rect = ref.current.getBoundingClientRect();
        const start = vh * 0.85;   // element enters here
        const end   = vh * 0.40;   // element is fully visible here
        const progress = (start - rect.top) / (start - end);
        return Math.max(0, Math.min(1, progress));
      };

      setCard1Progress(getProgress(stage1Ref));
      setCard2Progress(getProgress(stage2Ref));
      setCard3Progress(getProgress(stage3Ref));

      // Metrics heading staggered reveal — 3 overlapping windows
      if (metricsTextRef.current) {
        const rect = metricsTextRef.current.getBoundingClientRect();
        const calc = (startRatio: number, endRatio: number) => {
          const p = (vh * startRatio - rect.top) / (vh * (startRatio - endRatio));
          return Math.max(0, Math.min(1, p));
        };
        setMetricsLine1Progress(calc(1.0, 0.65));  // reveals first, sooner
        setMetricsLine2Progress(calc(0.92, 0.57)); // slight delay
        setMetricsLine3Progress(calc(0.84, 0.49)); // last
      }

      // Traveling dot — same logic as before
      if (!timelineRef.current) return;
      const tlRect = timelineRef.current.getBoundingClientRect();
      const getDotCenter = (dotRef: React.RefObject<HTMLDivElement>) => {
        if (!dotRef.current) return null;
        const r = dotRef.current.getBoundingClientRect();
        return r.top + r.height / 2 - tlRect.top;
      };

      const y1 = getDotCenter(dot1Ref);
      const y2 = getDotCenter(dot2Ref);
      const y3 = getDotCenter(dot3Ref);
      const mid = vh / 2;

      const isPast = (ref: React.RefObject<HTMLDivElement>) => {
        if (!ref.current) return false;
        return ref.current.getBoundingClientRect().top < mid + 120;
      };

      if (y3 !== null && isPast(stage3Ref)) {
        setDotY(y3);
      } else if (y2 !== null && isPast(stage2Ref)) {
        if (y3 !== null && stage3Ref.current) {
          const r3 = stage3Ref.current.getBoundingClientRect();
          const progress = Math.max(0, Math.min(1, (mid + 120 - r3.top) / 200));
          setDotY(y2 + (y3 - y2) * progress);
        } else { setDotY(y2); }
      } else if (y1 !== null && isPast(stage1Ref)) {
        if (y2 !== null && stage2Ref.current) {
          const r2 = stage2Ref.current.getBoundingClientRect();
          const progress = Math.max(0, Math.min(1, (mid + 120 - r2.top) / 200));
          setDotY(y1 + (y2 - y1) * progress);
        } else { setDotY(y1); }
      } else {
        setDotY(null);
      }
    };

    window.addEventListener("scroll", handlePipelineScroll, { passive: true });
    handlePipelineScroll();
    return () => window.removeEventListener("scroll", handlePipelineScroll);
  }, []);

  // 3. Dynamic Gauges States & Count-Up Animation
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [displayLatency, setDisplayLatency] = useState(0);
  const [displayFp, setDisplayFp] = useState(0);
  const [displayAccuracy, setDisplayAccuracy] = useState(99.0);
  const [displaySpeed, setDisplaySpeed] = useState(0);

  useEffect(() => {
    if (!metricsVisible) {
      setDisplayLatency(0);
      setDisplayFp(0);
      setDisplayAccuracy(99.0);
      setDisplaySpeed(0);
      return;
    }

    // Animate Latency from 0 to 24.0 (in ~1200ms)
    let latencyStart = 0;
    const latencyTarget = 24.0;
    const latencyTimer = setInterval(() => {
      latencyStart += 0.6;
      if (latencyStart >= latencyTarget) {
        setDisplayLatency(latencyTarget);
        clearInterval(latencyTimer);
      } else {
        setDisplayLatency(Number(latencyStart.toFixed(1)));
      }
    }, 30);

    // Animate FP from 0 to 0.38 (in ~1200ms)
    let fpStart = 0;
    const fpTarget = 0.38;
    const fpTimer = setInterval(() => {
      fpStart += 0.0095;
      if (fpStart >= fpTarget) {
        setDisplayFp(fpTarget);
        clearInterval(fpTimer);
      } else {
        setDisplayFp(Number(fpStart.toFixed(3)));
      }
    }, 30);

    // Animate Accuracy from 99.0 to 99.95 (in ~1200ms)
    let accStart = 99.0;
    const accTarget = 99.95;
    const accTimer = setInterval(() => {
      accStart += 0.02375;
      if (accStart >= accTarget) {
        setDisplayAccuracy(accTarget);
        clearInterval(accTimer);
      } else {
        setDisplayAccuracy(Number(accStart.toFixed(3)));
      }
    }, 30);

    // Animate Speed from 0 to 1200 (in ~1200ms)
    let speedStart = 0;
    const speedTarget = 1200;
    const speedTimer = setInterval(() => {
      speedStart += 30;
      if (speedStart >= speedTarget) {
        setDisplaySpeed(speedTarget);
        clearInterval(speedTimer);
      } else {
        setDisplaySpeed(speedStart);
      }
    }, 30);

    return () => {
      clearInterval(latencyTimer);
      clearInterval(fpTimer);
      clearInterval(accTimer);
      clearInterval(speedTimer);
    };
  }, [metricsVisible]);

  const p1 = displayLatency / 50;
  const p2 = displayFp / 1.5;
  const p3 = (displayAccuracy - 99.0) / 1.0;
  const p4 = displaySpeed / 2000;

  return (
    <div 
      onMouseMove={handleMouseMove} 
      className="stripe-mesh-bg min-h-screen flex flex-col relative text-[#1d1d1f] font-sans overflow-hidden select-none noise-overlay"
    >
      {/* Floating Parallax Background Mesh Orbs — more vivid, Stripe-style */}
      <div 
        className="mesh-blob-vivid w-[560px] h-[560px] bg-purple-400/20 top-0 -right-24"
        style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      />
      <div 
        className="mesh-blob-vivid w-[400px] h-[400px] bg-indigo-400/15 bottom-32 -left-20"
        style={{ transform: `translate(${mousePos.x * -0.8}px, ${mousePos.y * -0.8}px)` }}
      />
      <div 
        className="mesh-blob-vivid w-[600px] h-[600px] bg-violet-300/10 top-[30%] left-[20%]"
        style={{ transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px)` }}
      />
      {/* Extra accent orb bottom-right */}
      <div className="mesh-blob-vivid w-[320px] h-[320px] bg-fuchsia-400/12 bottom-0 right-1/3" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full glass-purple border-b border-[#e5e5ea]/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-[#8b5cf6] to-[#6366f1] rounded-xl shadow-lg shadow-[#8b5cf6]/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-outfit font-black text-base tracking-tight text-[#1d1d1f]">VisionLine</h1>
            <p className="font-syne font-extrabold text-[8px] tracking-widest text-[#86868b] uppercase">AI ASSURANCE CORE</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 font-outfit text-xs font-semibold text-[#86868b]">
          <a href="#features" className="hover:text-[#8b5cf6] transition duration-200">Features</a>
          <a href="#metrics" className="hover:text-[#8b5cf6] transition duration-200">Performance</a>
          <a href="#workflow" className="hover:text-[#8b5cf6] transition duration-200">Deployment</a>
          <a href="#pipeline" className="hover:text-[#8b5cf6] transition duration-200">Inference Core</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white rounded-full font-outfit text-xs font-bold shadow-lg shadow-[#8b5cf6]/20 hover:shadow-xl hover:shadow-[#8b5cf6]/30 hover:scale-[1.03] active:scale-[0.98] transition duration-300"
          >
            Enter Platform <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center py-12 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 z-10">
        {/* Aurora beam sweep across hero */}
        <div className="gradient-beam top-0 left-0 opacity-60" />

        {/* Scan rings — fills bottom whitespace of hero, full width */}
        <div className="absolute bottom-0 left-0 right-0 h-[320px] pointer-events-none z-0 opacity-50">
          <ThreeScanRings className="w-full h-full" />
        </div>

        {/* Scan rings — top-right corner accent above the gear */}
        <div className="absolute top-0 right-0 w-[340px] h-[260px] pointer-events-none z-0 opacity-40">
          <ThreeScanRings className="w-full h-full" />
        </div>

        <div className="lg:col-span-6 space-y-6 max-w-2xl text-left reveal-hidden">
          <h2 className="font-outfit font-black text-5xl md:text-6xl lg:text-7xl text-[#1d1d1f] tracking-tight leading-[1.1]">
            Experience <br />
            <span className="text-gradient-purple font-black">ZERO DEFECTS</span> <br />
            in Production
          </h2>
          <p className="text-sm md:text-base lg:text-[17px] text-[#86868b] leading-relaxed font-medium max-w-xl">
            Supercharge your quality assurance processes using our local, custom-trained in-built deep learning model. VisionLine provides real-time millisecond-level visual anomaly scanning right at the edge.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <Link
              href="/dashboard"
              className="glow-button px-7 py-3.5 bg-[#1d1d1f] hover:bg-[#2c2c2e] text-white rounded-full font-outfit text-xs font-bold transition duration-300 flex items-center gap-2 shadow-md shadow-black/10 hover:scale-[1.02]"
            >
              Launch Dashboard <ArrowUpRight className="w-4.5 h-4.5" />
            </Link>
            <Link
              href="/upload"
              className="px-7 py-3.5 bg-white/80 border border-[#e5e5ea] text-[#1d1d1f] hover:bg-white rounded-full font-outfit text-xs font-bold transition duration-300 flex items-center gap-2 hover:border-[#8b5cf6]/40 backdrop-blur-sm"
            >
              Inspection Sandbox <ChevronRight className="w-4.5 h-4.5" />
            </Link>
          </div>
        </div>


        {/* 3D WebGL Dashboard-Viewport */}
        <div className="lg:col-span-6 relative flex justify-center items-center reveal-hidden w-full h-[460px]">
          <div className="w-full h-full relative overflow-hidden flex items-center justify-center max-w-lg">
            <ThreeDViewer />
          </div>
        </div>
      </section>

      {/* Core AI Performance Gauges */}
      <section id="metrics" className="min-h-screen flex items-center py-16 px-6 z-10 relative overflow-hidden">
        {/* Seamless top blend — matches hero's purple ambient, NO white */}
        <div
          className="absolute top-0 left-0 right-0 h-48 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(to bottom, rgba(237,233,254,0.55) 0%, rgba(237,233,254,0.2) 35%, transparent 100%)',
          }}
        />
        {/* Seamless bottom blend */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(to top, rgba(245,243,255,0.55) 0%, rgba(245,243,255,0.15) 40%, transparent 100%)',
          }}
        />
        {/* Dot grid — gradient-masked so it fades in from top and bottom */}
        <div
          className="absolute inset-0 dot-grid opacity-35 pointer-events-none"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
          }}
        />
        {/* Neural particle field */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-60">
          <ThreeNeuralParticles className="w-full h-full" />
        </div>
        {/* Vivid gradient orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-400/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-400/15 rounded-full blur-[80px] pointer-events-none" />
        {/* Aurora beam */}
        <div className="gradient-beam top-0 left-1/4" />



        <div ref={metricsTextRef} className="max-w-7xl mx-auto w-full space-y-16 text-center reveal-hidden relative z-10">
          {/* Text readability glass layer — radial blur fades at edges, not a card */}
          <div
            className="space-y-5 max-w-2xl mx-auto relative"
            style={{
              padding: '40px 48px 36px',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              background: 'radial-gradient(ellipse 90% 85% at 50% 50%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 45%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 88% 82% at 50% 50%, black 30%, transparent 75%)',
              maskImage: 'radial-gradient(ellipse 88% 82% at 50% 50%, black 30%, transparent 75%)',
            }}
          >
            {/* Line 1: "Building Custom AI" */}
            <div
              style={{
                opacity: metricsLine1Progress,
                transform: `translateY(${(1 - metricsLine1Progress) * 44}px)`,
                filter: `blur(${(1 - metricsLine1Progress) * 5}px)`,
                transition: 'opacity 0.12s ease, transform 0.12s ease, filter 0.12s ease',
                willChange: 'opacity, transform, filter',
                overflow: 'hidden',
              }}
            >
              <h3 className="font-outfit font-black text-4xl md:text-5xl text-[#1d1d1f] tracking-tight leading-tight">
                Building Custom AI
              </h3>
            </div>

            {/* Line 2: "Production Systems" */}
            <div
              style={{
                opacity: metricsLine2Progress,
                transform: `translateY(${(1 - metricsLine2Progress) * 44}px)`,
                filter: `blur(${(1 - metricsLine2Progress) * 5}px)`,
                transition: 'opacity 0.12s ease, transform 0.12s ease, filter 0.12s ease',
                willChange: 'opacity, transform, filter',
                marginTop: '-4px',
              }}
            >
              <h3 className="font-outfit font-black text-4xl md:text-5xl text-[#1d1d1f] tracking-tight leading-tight">
                Production Systems
              </h3>
            </div>

            {/* Line 3: description */}
            <p
              className="text-sm md:text-base text-[#86868b] font-medium leading-relaxed max-w-lg mx-auto"
              style={{
                opacity: metricsLine3Progress,
                transform: `translateY(${(1 - metricsLine3Progress) * 32}px)`,
                filter: `blur(${(1 - metricsLine3Progress) * 4}px)`,
                transition: 'opacity 0.12s ease, transform 0.12s ease, filter 0.12s ease',
                willChange: 'opacity, transform, filter',
                marginTop: '16px',
              }}
            >
              Our in-built classifier bypasses external clouds to deliver raw speed, precision security, and low false positive rates directly onto the hardware floor.
            </p>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Gauge 1 */}
            <div className="glass-purple glass-purple-hover card-purple-glow p-8 rounded-3xl flex flex-col justify-between items-center text-center space-y-8">
              <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-widest">Inference Latency</span>
              <div className="relative w-44 h-28 flex justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 60">
                  <path d="M15,50 A35,35 0 0,1 85,50" fill="none" stroke="#e5e5ea" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M15,50 A35,35 0 0,1 85,50"
                    fill="none"
                    stroke="url(#purpleG)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="110"
                    strokeDashoffset={110 - p1 * 110}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                  <circle cx="15" cy="50" r="5.5" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5"
                    style={{ transform: `rotate(${p1 * 180}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
              </div>
              <div className="space-y-1.5">
                <span className="font-outfit font-black text-4xl text-[#1d1d1f] block">{displayLatency.toFixed(1)} ms</span>
                <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-wider">Real-Time Core</span>
              </div>
            </div>

            {/* Gauge 2 */}
            <div className="glass-purple glass-purple-hover card-purple-glow p-8 rounded-3xl flex flex-col justify-between items-center text-center space-y-8">
              <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-widest">False Positives</span>
              <div className="relative w-44 h-28 flex justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 60">
                  <path d="M15,50 A35,35 0 0,1 85,50" fill="none" stroke="#e5e5ea" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M15,50 A35,35 0 0,1 85,50"
                    fill="none" stroke="url(#purpleG)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="110" strokeDashoffset={110 - p2 * 110}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                  <circle cx="15" cy="50" r="5.5" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5"
                    style={{ transform: `rotate(${p2 * 180}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
              </div>
              <div className="space-y-1.5">
                <span className="font-outfit font-black text-4xl text-[#1d1d1f] block">{displayFp.toFixed(2)}%</span>
                <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-wider">High Precision</span>
              </div>
            </div>

            {/* Gauge 3 */}
            <div className="glass-purple glass-purple-hover card-purple-glow p-8 rounded-3xl flex flex-col justify-between items-center text-center space-y-8">
              <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-widest">Production Accuracy</span>
              <div className="relative w-44 h-28 flex justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 60">
                  <path d="M15,50 A35,35 0 0,1 85,50" fill="none" stroke="#e5e5ea" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M15,50 A35,35 0 0,1 85,50"
                    fill="none" stroke="url(#purpleG)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="110" strokeDashoffset={110 - p3 * 110}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                  <circle cx="15" cy="50" r="5.5" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5"
                    style={{ transform: `rotate(${p3 * 180}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
              </div>
              <div className="space-y-1.5">
                <span className="font-outfit font-black text-4xl text-[#1d1d1f] block">{displayAccuracy.toFixed(2)}%</span>
                <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-wider">QA Guarantee</span>
              </div>
            </div>

            {/* Gauge 4 */}
            <div className="glass-purple glass-purple-hover card-purple-glow p-8 rounded-3xl flex flex-col justify-between items-center text-center space-y-8">
              <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-widest">Inspection Speed</span>
              <div className="relative w-44 h-28 flex justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 60">
                  <path d="M15,50 A35,35 0 0,1 85,50" fill="none" stroke="#e5e5ea" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M15,50 A35,35 0 0,1 85,50"
                    fill="none" stroke="url(#purpleG)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="110" strokeDashoffset={110 - p4 * 110}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                  <circle cx="15" cy="50" r="5.5" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5"
                    style={{ transform: `rotate(${p4 * 180}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
              </div>
              <div className="space-y-1.5">
                <span className="font-outfit font-black text-4xl text-[#1d1d1f] block">{displaySpeed} PPM</span>
                <span className="font-syne font-extrabold text-[11px] text-[#86868b] uppercase tracking-wider">Parts Per Minute</span>
              </div>
            </div>
          </div>
          
          <svg className="absolute w-0 h-0">
            <defs>
              <linearGradient id="purpleG" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>

      {/* Deployment & System Architecture */}
      <section id="workflow" className="min-h-screen flex flex-col justify-center py-16 px-6 max-w-7xl mx-auto space-y-12 relative z-10 overflow-hidden">
        {/* Gradient accent orbs */}
        <div className="absolute -top-24 right-0 w-96 h-96 bg-violet-300/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-purple-400/10 rounded-full blur-[80px] pointer-events-none" />
        {/* Floating 3D shapes — top-right corner of deployment section */}
        <div className="absolute top-0 right-0 w-[420px] h-[340px] pointer-events-none z-0 opacity-70">
          <ThreeFloatingShapes className="w-full h-full" />
        </div>

        <div className="space-y-4 max-w-2xl text-left reveal-hidden">
          <div className="accent-pill w-fit">🏭 System Integration</div>
          <h3 className="font-outfit font-black text-3xl md:text-4xl tracking-tight text-[#1d1d1f]">
            Deployment & System Architecture
          </h3>
          <p className="text-xs md:text-sm text-[#86868b] font-medium leading-relaxed">
            VisionLine integrates cleanly with standard conveyor systems. Visual signals from high-speed cameras are piped to our custom AI core, sending instant PLC triggers to reject defective items without line-stops.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center reveal-hidden">
          {/* Conveyor Belt 3D Simulation (Left side of diagram) */}
          <div className="lg:col-span-8 w-full h-[460px] relative">
            <ThreeDConveyor />
          </div>

          {/* Block Diagram (Right side of diagram) */}
          <div className="lg:col-span-4 space-y-6">
            {/* AI Processor Core (Glow Highlight border) */}
            <div className="glass-purple p-6 rounded-3xl border-2 border-[#8b5cf6]/35 shadow-lg shadow-[#8b5cf6]/8 relative">
              <div className="absolute top-4 right-5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8b5cf6] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8b5cf6]"></span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-tr from-[#8b5cf6] to-[#6366f1] text-white rounded-2xl shadow-lg shadow-[#8b5cf6]/20">
                  <Cpu className="w-6.5 h-6.5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-syne font-extrabold text-[8px] tracking-widest text-[#8b5cf6] uppercase">Processing Core</h4>
                  <p className="font-outfit font-black text-base text-[#1d1d1f]">VisionLine Custom AI Engine</p>
                  <p className="text-xs text-[#86868b] leading-normal font-medium">
                    Runs local classification models directly on edge hardware. Evaluates images in under 25 milliseconds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Software Workflow Timeline */}
      <section id="pipeline" className="min-h-screen flex items-center py-16 border-y border-[#e5e5ea]/40 px-6 relative z-10 overflow-hidden">
        {/* Line grid background */}
        <div className="absolute inset-0 line-grid opacity-60" />
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -right-40 w-80 h-80 bg-purple-300/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-1/4 -left-40 w-72 h-72 bg-indigo-300/15 rounded-full blur-[80px] pointer-events-none" />
        {/* 3D floating shapes — left and right corners */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[280px] h-[420px] pointer-events-none z-0 opacity-55">
          <ThreeFloatingShapes className="w-full h-full" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[280px] h-[420px] pointer-events-none z-0 opacity-55">
          <ThreeFloatingShapes className="w-full h-full" />
        </div>


        <div className="max-w-7xl mx-auto w-full space-y-16 relative z-10">
          <div className="space-y-4 max-w-xl mx-auto text-center reveal-hidden">
            <div className="accent-pill mx-auto w-fit">🔬 Inspection Sequence</div>
            <h3 className="font-outfit font-black text-3xl md:text-4xl text-[#1d1d1f] tracking-tight">AI Inference Pipeline</h3>
            <p className="text-xs md:text-sm text-[#86868b] font-medium leading-relaxed max-w-sm mx-auto">
              Every captured frame passes through a sequential multi-stage analysis path to isolate anomalies and reject defective objects.
            </p>
          </div>

          {/* Timeline container — position:relative so the traveling dot can be absolutely positioned */}
          <div ref={timelineRef} className="relative max-w-3xl mx-auto">

            {/* Static grey connector line (base) */}
            <div className="absolute left-6 md:left-1/2 top-4 bottom-4 w-0.5 bg-[#e5e5ea] -translate-x-1/2 z-0"></div>
            {/* Animated flowing gradient line overlay */}
            <div className="absolute left-6 md:left-1/2 top-4 bottom-4 w-0.5 flow-line-gradient -translate-x-1/2 z-0"></div>

            {/* Travelling purple active dot — slides along the midline */}
            {dotY !== null && (
              <div
                className="absolute left-6 md:left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                style={{
                  top: dotY - 10,
                  transition: "top 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {/* Outer glow ring */}
                <span className="absolute inset-0 animate-ping rounded-full bg-[#8b5cf6]/40 w-5 h-5"></span>
                {/* Inner solid dot */}
                <span className="relative block w-5 h-5 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] shadow-lg shadow-[#8b5cf6]/50"></span>
              </div>
            )}

            {/* Stage 1 */}
            <div
              ref={stage1Ref}
              className="relative flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-0 pb-4"
            >
              <div
                ref={dot1Ref}
                className="absolute left-6 md:left-1/2 w-4 h-4 rounded-full border-2 border-[#d1d1d6] bg-white -translate-x-1/2 z-10"
              ></div>

              {/* Card — left side */}
              <div className="w-full md:w-1/2 md:pr-10 md:text-right pl-12 md:pl-0">
                <div
                  className="glass-purple rounded-3xl border text-left w-full"
                  style={{
                    padding: `${24 + card1Progress * 16}px ${24 + card1Progress * 16}px`,
                    opacity: card1Progress,
                    transform: `scale(${0.72 + card1Progress * 0.28}) translateY(${(1 - card1Progress) * 32}px)`,
                    transformOrigin: "right center",
                    borderColor: `rgba(139,92,246,${card1Progress * 0.45})`,
                    boxShadow: `0 0 ${card1Progress * 48}px 0 rgba(139,92,246,${card1Progress * 0.18})`,
                    willChange: "transform, opacity",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-syne font-extrabold text-[9px] text-white bg-[#86868b] px-2.5 py-1 rounded-lg uppercase tracking-widest">PHASE 1</span>
                    <h4 className="font-outfit font-black text-lg text-[#1d1d1f]">OOD Visual Heuristic check</h4>
                  </div>
                  <p className="text-sm text-[#86868b] leading-relaxed font-medium">
                    Analyses pixel standard deviation to check for solid black/white noise frames. Automatically rejects blank frames to prevent false activations.
                  </p>
                </div>
              </div>
              <div className="hidden md:block w-1/2"></div>
            </div>

            {/* Stage 2 */}
            <div
              ref={stage2Ref}
              className="relative flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-0 pb-4"
            >
              <div
                ref={dot2Ref}
                className="absolute left-6 md:left-1/2 w-4 h-4 rounded-full border-2 border-[#d1d1d6] bg-white -translate-x-1/2 z-10"
              ></div>

              <div className="hidden md:block w-1/2"></div>
              {/* Card — right side */}
              <div className="w-full md:w-1/2 md:pl-10 pl-12">
                <div
                  className="glass-purple rounded-3xl border text-left w-full"
                  style={{
                    padding: `${24 + card2Progress * 16}px ${24 + card2Progress * 16}px`,
                    opacity: card2Progress,
                    transform: `scale(${0.72 + card2Progress * 0.28}) translateY(${(1 - card2Progress) * 32}px)`,
                    transformOrigin: "left center",
                    borderColor: `rgba(139,92,246,${card2Progress * 0.45})`,
                    boxShadow: `0 0 ${card2Progress * 48}px 0 rgba(139,92,246,${card2Progress * 0.18})`,
                    willChange: "transform, opacity",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-syne font-extrabold text-[9px] text-white bg-[#86868b] px-2.5 py-1 rounded-lg uppercase tracking-widest">PHASE 2</span>
                    <h4 className="font-outfit font-black text-lg text-[#1d1d1f]">YOLOv8 Operator Scanner</h4>
                  </div>
                  <p className="text-sm text-[#86868b] leading-relaxed font-medium">
                    Runs a high-speed pre-trained detector to detect human presence. Flags images containing operator interference, ensuring workspace safety standards.
                  </p>
                </div>
              </div>
            </div>

            {/* Stage 3 */}
            <div
              ref={stage3Ref}
              className="relative flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-0"
            >
              <div
                ref={dot3Ref}
                className="absolute left-6 md:left-1/2 w-4 h-4 rounded-full border-2 border-[#d1d1d6] bg-white -translate-x-1/2 z-10"
              ></div>

              {/* Card — left side */}
              <div className="w-full md:w-1/2 md:pr-10 md:text-right pl-12 md:pl-0">
                <div
                  className="glass-purple rounded-3xl border bg-gradient-to-br from-white to-[#8b5cf6]/5 text-left w-full"
                  style={{
                    padding: `${24 + card3Progress * 16}px ${24 + card3Progress * 16}px`,
                    opacity: card3Progress,
                    transform: `scale(${0.72 + card3Progress * 0.28}) translateY(${(1 - card3Progress) * 32}px)`,
                    transformOrigin: "right center",
                    borderColor: `rgba(139,92,246,${0.15 + card3Progress * 0.40})`,
                    boxShadow: `0 0 ${card3Progress * 56}px 0 rgba(139,92,246,${card3Progress * 0.22})`,
                    willChange: "transform, opacity",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-syne font-extrabold text-[9px] text-white bg-[#86868b] px-2.5 py-1 rounded-lg uppercase tracking-widest">PHASE 3</span>
                    <h4 className="font-outfit font-black text-lg text-[#1d1d1f]">Custom-Trained Classifier</h4>
                  </div>
                  <p className="text-sm text-[#86868b] leading-relaxed font-medium">
                    Invokes our custom-trained deep learning classifier head to verify defects (e.g. dents, cracks, scratches). Stores accurate anomaly descriptions and outputs decisions.
                  </p>
                </div>
              </div>
              <div className="hidden md:block w-1/2"></div>
            </div>


          </div>
        </div>
      </section>

      {/* Call To Action */}
      <section className="py-24 px-6 max-w-7xl mx-auto text-center relative z-10">
        <div className="glass-purple p-12 rounded-3xl border border-[#8b5cf6]/25 shadow-2xl max-w-3xl mx-auto space-y-6 bg-gradient-to-br from-white to-[#8b5cf6]/5 relative overflow-hidden reveal-hidden w-full">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#8b5cf6]/10 blur-[60px] rounded-full"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#6366f1]/10 blur-[60px] rounded-full"></div>
          
          <h2 className="font-outfit font-black text-3xl tracking-tight text-[#1d1d1f]">
            Supercharge Your QA Process
          </h2>
          <p className="text-xs md:text-sm text-[#86868b] max-w-lg mx-auto font-medium leading-relaxed">
            Deploy real-time local anomaly validation checks directly into your factory line workflows. Get started in minutes.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white rounded-full font-outfit text-xs font-bold shadow-lg shadow-[#8b5cf6]/20 hover:scale-[1.03] active:scale-[0.98] transition duration-300"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/inspections"
              className="px-8 py-3.5 bg-white border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-full font-outfit text-xs font-bold transition duration-300 hover:border-[#8b5cf6]/35"
            >
              Browse Inspection History
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#e5e5ea] bg-[#f5f5f7] text-center px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#8b5cf6]" />
            <span className="font-outfit font-black text-sm text-[#1d1d1f] tracking-wide">VisionLine</span>
          </div>
          <p className="font-syne font-extrabold text-[9px] text-[#86868b] tracking-wider uppercase">
            © {new Date().getFullYear()} VisionLine Quality Inspection Inc. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
