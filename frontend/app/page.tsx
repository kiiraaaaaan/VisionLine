"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  ArrowRight,
  RefreshCw,
  Package,
  Heart,
  Zap,
  BarChart2,
  Target,
} from "lucide-react";
import { API_BASE, BACKEND_URL } from "./config";

interface DashboardStats {
  total_inspections: number;
  defect_rate: number;
  defective_count: number;
  normal_count: number;
  no_objects_count: number;
  avg_inference_time_ms: number;
  pending_reviews_count: number;
  defect_class_counts: Record<string, number>;
  daily_trends: Array<{ date: string; total: number; defective: number }>;
}

interface ModelMetrics {
  model_name: string;
  model_file: string;
  task: string;
  test_set_size: number;
  threshold: number;
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  specificity: number;
  roc_auc: number;
}

interface InspectionItem {
  id: string;
  filename: string;
  status: string;
  total_objects: number;
  defective_objects: number;
  max_defect_probability: number | null;
  total_time_ms: number;
  review_status: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [recentFeed, setRecentFeed] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, listRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/dashboard`),
        fetch(`${API_BASE}/inspections?page=1&limit=5`),
        fetch(`${API_BASE}/metrics/model-performance`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (listRes.ok) { const d = await listRes.json(); setRecentFeed(d.items); }
      if (metricsRes.ok) setModelMetrics(await metricsRes.json());
    } catch (error) {
      console.error("Error fetching dashboard statistics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchDashboardData(); };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-[#0071e3] animate-spin" />
        <p className="text-[#86868b] font-medium text-sm">Synchronizing live manufacturing data...</p>
      </div>
    );
  }

  // Fallback stats if DB is completely empty
  const activeStats = stats || {
    total_inspections: 0,
    defect_rate: 0.0,
    defective_count: 0,
    normal_count: 0,
    no_objects_count: 0,
    avg_inference_time_ms: 0.0,
    pending_reviews_count: 0,
    defect_class_counts: {},
    daily_trends: [],
  };

  return (
    <div className="space-y-10 relative">
      
      {/* Dashboard Title & Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Quality Control Dashboard
          </h1>
          <p className="text-[#86868b] text-sm mt-1">
            Real-time analytics from computer vision inspection lines.
          </p>
        </div>
        
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#d1d1d6] text-[#1d1d1f] hover:bg-[#f5f5f7] transition shadow-sm active:scale-95 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 text-[#86868b] ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Total Inspected */}
        <div className="bg-white p-6 rounded-2xl flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card hover:shadow-md transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[#86868b] font-semibold text-xs uppercase tracking-wider">Total Run</span>
            <div className="p-2 bg-[#0071e3]/10 rounded-lg text-[#0071e3]">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-[#1d1d1f] tracking-tight">
              {activeStats.total_inspections.toLocaleString()}
            </span>
            <p className="text-[11px] text-[#86868b] mt-1">Inspected products</p>
          </div>
        </div>

        {/* Defect Rate */}
        <div className="bg-white p-6 rounded-2xl flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card hover:shadow-md transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[#86868b] font-semibold text-xs uppercase tracking-wider">Defect Rate</span>
            <div className="p-2 bg-[#ff3b30]/10 rounded-lg text-[#ff3b30]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-[#1d1d1f] tracking-tight">
              {activeStats.defect_rate}%
            </span>
            <div className="w-full bg-[#e5e5ea] rounded-full h-1.5 mt-2">
              <div 
                className={`h-1.5 rounded-full ${
                  activeStats.defect_rate < 5 ? 'bg-[#34c759]' : activeStats.defect_rate < 15 ? 'bg-[#ff9500]' : 'bg-[#ff3b30]'
                }`}
                style={{ width: `${Math.min(activeStats.defect_rate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Defectives Count */}
        <div className="bg-white p-6 rounded-2xl flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card hover:shadow-md transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[#86868b] font-semibold text-xs uppercase tracking-wider">Defective Items</span>
            <div className="p-2 bg-[#ff3b30]/10 rounded-lg text-[#ff3b30]">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-[#1d1d1f] tracking-tight">
              {activeStats.defective_count.toLocaleString()}
            </span>
            <p className="text-[11px] text-[#86868b] mt-1">Confirmed defects</p>
          </div>
        </div>

        {/* Avg Processing Time */}
        <div className="bg-white p-6 rounded-2xl flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card hover:shadow-md transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[#86868b] font-semibold text-xs uppercase tracking-wider">Speed</span>
            <div className="p-2 bg-[#32ade6]/10 rounded-lg text-[#32ade6]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-[#1d1d1f] tracking-tight">
              {activeStats.avg_inference_time_ms} <span className="text-sm font-semibold text-[#86868b]">ms</span>
            </span>
            <p className="text-[11px] text-[#86868b] mt-1">Avg cycle inference time</p>
          </div>
        </div>

        {/* Pending Reviews */}
        <div className="bg-white p-6 rounded-2xl flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card hover:shadow-md transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-[#86868b] font-semibold text-xs uppercase tracking-wider">Pending Review</span>
            <div className="p-2 bg-[#ff9500]/10 rounded-lg text-[#ff9500]">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-[#1d1d1f] tracking-tight">
              {activeStats.pending_reviews_count.toLocaleString()}
            </span>
            <p className="text-[11px] text-[#86868b] mt-1">Awaiting manager review</p>
          </div>
        </div>

      </div>



      {/* Analytics Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Defect Class Breakdown (Bar chart representation) */}
        <div className="bg-white p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f]">Defect Breakdown</h2>
            <p className="text-xs text-[#86868b] mt-0.5">Defect type distributions across all runs.</p>
          </div>

          <div className="space-y-4 my-6">
            {Object.keys(activeStats.defect_class_counts).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#86868b] text-sm">
                <CheckCircle className="w-10 h-10 text-[#d1d1d6] mb-2" />
                No defects logged
              </div>
            ) : (
              Object.entries(activeStats.defect_class_counts).map(([name, count]) => {
                const totalDefects = Object.values(activeStats.defect_class_counts).reduce((a, b) => a + b, 0);
                const percent = totalDefects > 0 ? (count / totalDefects) * 100 : 0;
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#1d1d1f] capitalize">{name}</span>
                      <span className="text-[#86868b]">{count} units ({percent.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-[#e5e5ea] rounded-full h-2">
                      <div 
                        className="bg-[#5856d6] h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[#e5e5ea] pt-4 flex justify-between text-[11px] text-[#86868b]">
            <span>Keras Full-Image Evaluation</span>
            <span className="font-semibold text-[#86868b]">Direct Binary Classification</span>
          </div>
        </div>

        {/* Daily Production Performance Trends */}
        <div className="bg-white p-6 rounded-2xl lg:col-span-2 flex flex-col justify-between border border-[#e5e5ea] shadow-apple-card">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f]">Inference History & Defect Trends</h2>
            <p className="text-xs text-[#86868b] mt-0.5">Inspected items vs defective counts (last 14 days).</p>
          </div>

          <div className="h-48 my-6 flex items-end justify-between gap-2.5">
            {activeStats.daily_trends.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center h-full text-[#86868b] text-sm">
                No history recorded
              </div>
            ) : (
              activeStats.daily_trends.map((item, idx) => {
                const maxVal = Math.max(...activeStats.daily_trends.map(t => t.total), 1);
                const totalHeight = (item.total / maxVal) * 100;
                const defHeight = (item.defective / maxVal) * 100;

                // Simple date parsing
                const dayLabel = item.date.split("-").slice(2).join(""); // DD format

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 bg-white border border-[#e5e5ea] text-[10px] p-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition z-50 text-[#1d1d1f] w-28 shadow-lg">
                      <p className="font-semibold text-[#1d1d1f] mb-0.5">{item.date}</p>
                      <p>Run: <span className="text-[#1d1d1f] font-bold">{item.total}</span></p>
                      <p>Defective: <span className="text-[#ff3b30] font-bold">{item.defective}</span></p>
                    </div>

                    <div className="w-full relative h-full flex flex-col justify-end">
                      {/* Total inspected bar */}
                      <div 
                        className="bg-[#0071e3]/10 w-full rounded-t-sm group-hover:bg-[#0071e3]/20 transition cursor-pointer" 
                        style={{ height: `${totalHeight}%` }}
                      />
                      {/* Defective overlay bar */}
                      <div 
                        className="bg-[#ff3b30] w-full rounded-t-sm absolute bottom-0 cursor-pointer transition-all duration-300" 
                        style={{ height: `${defHeight}%` }}
                      />
                    </div>
                    
                    <span className="text-[10px] text-[#86868b] font-bold">{dayLabel}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-[#86868b] pt-4 border-t border-[#e5e5ea]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#0071e3]/10 border border-[#0071e3]/30 rounded-sm" />
              Total Inspected
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ff3b30] rounded-sm" />
              Defect Detected
            </div>
          </div>
        </div>

      </div>

      {/* ── Model Performance & Confusion Matrix ─────────────────────────── */}
      {modelMetrics && (
        <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
          <div className="p-5 border-b border-[#e5e5ea] bg-[#f5f5f7]/50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1d1d1f] flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#5856d6]" />
                AI Model Performance — Proof of Work
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5">
                {modelMetrics.model_name} · {modelMetrics.task} · Test set: {modelMetrics.test_set_size.toLocaleString()} samples
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#5856d6]/10 text-[#5856d6] text-[10px] font-bold uppercase tracking-wider">
              Evaluated
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left: Confusion Matrix */}
            <div>
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-1">Confusion Matrix</h3>
              <p className="text-xs text-[#86868b] mb-4">Threshold: {modelMetrics.threshold} · Binary classification on {modelMetrics.test_set_size.toLocaleString()} test images</p>
              <div className="w-full">
                {/* Axis labels */}
                <div className="flex">
                  <div className="w-28" />
                  <div className="flex-1 text-center text-[10px] font-bold text-[#86868b] uppercase tracking-wider pb-2">Predicted: NORMAL</div>
                  <div className="flex-1 text-center text-[10px] font-bold text-[#86868b] uppercase tracking-wider pb-2">Predicted: DEFECTIVE</div>
                </div>

                {/* Row 1: Actual NORMAL */}
                <div className="flex items-stretch gap-1 mb-1">
                  <div className="w-28 flex items-center justify-end pr-3 text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Actual: NORMAL</div>
                  {/* TN */}
                  <div className="flex-1 rounded-xl bg-[#34c759]/10 border-2 border-[#34c759]/40 p-4 text-center">
                    <div className="text-[10px] font-bold text-[#34c759] uppercase tracking-wider mb-1">True Negative ✓</div>
                    <div className="text-3xl font-black text-[#1d1d1f] font-mono">{modelMetrics.true_negative.toLocaleString()}</div>
                    <div className="text-[10px] text-[#86868b] mt-1">Correct — Normal</div>
                  </div>
                  {/* FP */}
                  <div className="flex-1 rounded-xl bg-[#ff9500]/10 border-2 border-[#ff9500]/30 p-4 text-center">
                    <div className="text-[10px] font-bold text-[#ff9500] uppercase tracking-wider mb-1">False Positive ✗</div>
                    <div className="text-3xl font-black text-[#1d1d1f] font-mono">{modelMetrics.false_positive}</div>
                    <div className="text-[10px] text-[#86868b] mt-1">Flagged — Was Normal</div>
                  </div>
                </div>

                {/* Row 2: Actual DEFECTIVE */}
                <div className="flex items-stretch gap-1">
                  <div className="w-28 flex items-center justify-end pr-3 text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Actual: DEFECTIVE</div>
                  {/* FN */}
                  <div className="flex-1 rounded-xl bg-[#ff3b30]/10 border-2 border-[#ff3b30]/30 p-4 text-center">
                    <div className="text-[10px] font-bold text-[#ff3b30] uppercase tracking-wider mb-1">False Negative ✗</div>
                    <div className="text-3xl font-black text-[#1d1d1f] font-mono">{modelMetrics.false_negative}</div>
                    <div className="text-[10px] text-[#86868b] mt-1">Missed — Was Defective</div>
                  </div>
                  {/* TP */}
                  <div className="flex-1 rounded-xl bg-[#34c759]/10 border-2 border-[#34c759]/40 p-4 text-center">
                    <div className="text-[10px] font-bold text-[#34c759] uppercase tracking-wider mb-1">True Positive ✓</div>
                    <div className="text-3xl font-black text-[#1d1d1f] font-mono">{modelMetrics.true_positive}</div>
                    <div className="text-[10px] text-[#86868b] mt-1">Correct — Defective</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Metric Cards */}
            <div>
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-1">Evaluation Metrics</h3>
              <p className="text-xs text-[#86868b] mb-4">Industry-standard quality assurance benchmarks</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Accuracy", value: modelMetrics.accuracy, unit: "%", color: "#34c759", desc: "Overall correct predictions" },
                  { label: "Precision", value: modelMetrics.precision, unit: "%", color: "#5856d6", desc: "Defect alerts that were real" },
                  { label: "Recall", value: modelMetrics.recall, unit: "%", color: "#ff9500", desc: "Real defects caught" },
                  { label: "F1 Score", value: modelMetrics.f1_score, unit: "%", color: "#0071e3", desc: "Precision-Recall balance" },
                  { label: "Specificity", value: modelMetrics.specificity, unit: "%", color: "#32ade6", desc: "Normal items cleared" },
                  { label: "ROC-AUC", value: modelMetrics.roc_auc, unit: "%", color: "#5856d6", desc: "Discrimination ability" },
                ].map(m => (
                  <div key={m.label} className="p-4 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7]/50 hover:shadow-sm transition">
                    <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">{m.label}</div>
                    <div className="text-2xl font-black mt-1 font-mono" style={{ color: m.color }}>
                      {m.value}<span className="text-sm font-bold text-[#86868b]">{m.unit}</span>
                    </div>
                    <div className="text-[10px] text-[#86868b] mt-1">{m.desc}</div>
                    <div className="w-full bg-[#e5e5ea] rounded-full h-1 mt-2">
                      <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${m.value}%`, backgroundColor: m.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Model info footer */}
              <div className="mt-4 p-3 rounded-xl bg-[#1d1d1f]/5 border border-[#e5e5ea] text-[10px] text-[#86868b] flex items-center justify-between">
                <span>Model: <strong className="text-[#1d1d1f]">{modelMetrics.model_name}</strong> · <strong className="text-[#1d1d1f]">{modelMetrics.model_file}</strong></span>
                <span className="font-bold text-[#34c759]">Production Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Activity Feed */}
      <div className="bg-white p-6 rounded-2xl border border-[#e5e5ea] shadow-apple-card">
        <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f]">Recent Quality Inspections</h2>
            <p className="text-xs text-[#86868b] mt-0.5">Most recent inspection runs passing through AI pipelines.</p>
          </div>
          
          <Link 
            href="/inspections" 
            className="flex items-center gap-1.5 text-xs text-[#0071e3] hover:underline font-bold group"
          >
            All Inspections 
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </Link>
        </div>

        {recentFeed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#86868b] gap-2">
            <FileSpreadsheet className="w-10 h-10 text-[#d1d1d6]" />
            <p>Inspection queue is currently empty.</p>
            <Link href="/upload" className="text-xs text-[#0071e3] hover:underline font-semibold mt-2">
              Submit your first inspection file
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-[#86868b] border-b border-[#e5e5ea] font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Inspection Image</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Defect Status</th>
                  <th className="py-3 px-4">Detections</th>
                  <th className="py-3 px-4">Max Probability</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5ea]">
                {recentFeed.map((item) => {
                  const isDefective = item.status === "DEFECTIVE";
                  const hasObjects = item.status !== "NO_OBJECTS";
                  
                  return (
                    <tr key={item.id} className="hover:bg-[#f5f5f7]/60 transition group">
                      
                      {/* Image Thumbnail */}
                      <td className="py-3.5 px-4">
                        <div className="relative w-12 h-12 bg-[#f5f5f7] rounded-lg overflow-hidden border border-[#e5e5ea]">
                          <img 
                            src={`${BACKEND_URL}/api/inspections/${item.id}/image/annotated`} 
                            alt={item.filename}
                            className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition duration-300"
                            onError={(e) => {
                              // Fallback if image not generated
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23d1d1d6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                            }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-[#1d1d1f] truncate max-w-xs">{item.filename}</td>
                      
                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isDefective 
                            ? 'bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20' 
                            : item.status === "NORMAL"
                            ? 'bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20'
                            : 'bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]'
                        }`}>
                          {isDefective ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          {item.status}
                        </span>
                      </td>

                      {/* Detected Items */}
                      <td className="py-3.5 px-4 text-[#1d1d1f]">
                        {hasObjects ? (
                          <span>
                            {item.defective_objects}/{item.total_objects} objects defective
                          </span>
                        ) : (
                          <span className="text-[#86868b]">None</span>
                        )}
                      </td>

                      {/* Defect Probability */}
                      <td className="py-3.5 px-4 font-semibold text-[#1d1d1f]">
                        {item.max_defect_probability !== null ? (
                          <span className={item.max_defect_probability >= 0.5 ? "text-[#ff3b30]" : "text-[#34c759]"}>
                            {(item.max_defect_probability * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[#86868b]">-</span>
                        )}
                      </td>

                      {/* Review Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.review_status === "APPROVED" 
                            ? "bg-[#34c759]/15 text-[#34c759]" 
                            : item.review_status === "REJECTED" 
                            ? "bg-[#ff3b30]/15 text-[#ff3b30]" 
                            : "bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30"
                        }`}>
                          {item.review_status}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 text-xs text-[#86868b]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>

                      {/* Detail Link */}
                      <td className="py-3.5 px-4 text-right">
                        <Link 
                          href={`/inspections/${item.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#0071e3] hover:underline font-bold transition"
                        >
                          Details
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                        </Link>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
