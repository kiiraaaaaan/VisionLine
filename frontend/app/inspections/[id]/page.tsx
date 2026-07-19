"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Activity, 
  FileText, 
  User, 
  Send,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { API_BASE, BACKEND_URL } from "../../config";

interface DetectionItem {
  id: string;
  class_name: string;
  yolo_confidence: number;
  mobilenet_probability: number;
  is_defective: boolean;
  box_x1: number;
  box_y1: number;
  box_x2: number;
  box_y2: number;
  polygon_points: number[][] | null;
}

interface InspectionDetail {
  id: string;
  filename: string;
  status: string;
  total_objects: number;
  defective_objects: number;
  max_defect_probability: number | null;
  yolo_time_ms: number;
  mobilenet_time_ms: number;
  total_time_ms: number;
  review_status: string;
  review_notes: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  message: string | null;
  detections: DetectionItem[];
}

export default function InspectionDetailView() {
  const { id } = useParams();
  const router = useRouter();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [reviewStatus, setReviewStatus] = useState("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewerName, setReviewerName] = useState("Quality Manager");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const fetchInspectionDetail = async () => {
    try {
      const res = await fetch(`${API_BASE}/inspections/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInspection(data);
        setReviewStatus(data.review_status === "PENDING" ? "APPROVED" : data.review_status);
        setReviewNotes(data.review_notes || "");
        setReviewerName(data.reviewer_name || "Quality Manager");
      } else {
        router.push("/inspections");
      }
    } catch (error) {
      console.error("Error fetching inspection details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInspectionDetail();
    }
  }, [id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewMessage("");
    try {
      const res = await fetch(`${API_BASE}/inspections/${id}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review_status: reviewStatus,
          review_notes: reviewNotes,
          reviewer_name: reviewerName
        })
      });

      if (res.ok) {
        setReviewMessage("Review recorded successfully!");
        fetchInspectionDetail();
      } else {
        setReviewMessage("Failed to submit review notes.");
      }
    } catch (err) {
      console.error("Error submitting review decision:", err);
      setReviewMessage("API endpoint connection error.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-[#0071e3] animate-spin" />
        <p className="text-[#86868b] font-semibold text-sm">Decoding inspection metrics...</p>
      </div>
    );
  }

  if (!inspection) return null;

  const isDefective = inspection.status === "DEFECTIVE";
  const maxDef = inspection.max_defect_probability !== null ? inspection.max_defect_probability : 0;
  const confidence = isDefective ? maxDef : 1.0 - maxDef;
  const isLowConfidence = confidence < 0.70;

  return (
    <div className="space-y-6">
      
      {/* Top breadcrumb */}
      <Link 
        href="/inspections" 
        className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition text-sm font-semibold group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
        Back to History Gallery
      </Link>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e5e5ea] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1d1d1f] truncate max-w-md">{inspection.filename}</h1>
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
              inspection.review_status === "APPROVED" 
                ? "bg-[#34c759]/15 text-[#34c759]" 
                : inspection.review_status === "REJECTED" 
                ? "bg-[#ff3b30]/15 text-[#ff3b30]" 
                : "bg-[#ff9500]/15 text-[#ff9500]"
            }`}>
              {inspection.review_status} Review Decision
            </span>
          </div>
          <p className="text-xs text-[#86868b] mt-1 font-semibold">
            ID: <span className="text-[#86868b] select-all font-mono">{inspection.id}</span> · Run on {new Date(inspection.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold ${
            isDefective 
              ? 'bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/25' 
              : inspection.status === "NORMAL"
              ? 'bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/25'
              : 'bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]'
          }`}>
            {isDefective ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {inspection.status === "DEFECTIVE" ? "DEFECTIVE" : "NORMAL"}
          </span>
        </div>
      </div>

      {isLowConfidence && (
        <div className="p-4 bg-[#ff9500]/10 border border-[#ff9500]/20 rounded-2xl text-[#ff9500] text-xs font-semibold flex items-start gap-2.5 shadow-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Low confidence prediction</p>
            <p className="text-[11px] text-[#1d1d1f] mt-0.5 font-normal">Manual inspection is recommended for this item.</p>
          </div>
        </div>
      )}

      {/* Comparison Panel (Original vs Annotated Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Original Upload */}
        <div className="bg-white p-4 rounded-2xl flex flex-col border border-[#e5e5ea] shadow-apple-card">
          <span className="text-xs font-semibold text-[#86868b] uppercase tracking-widest mb-3.5 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#5856d6]" />
            Original Inspection Image
          </span>
          <div className="relative flex-1 bg-[#f5f5f7] rounded-xl overflow-hidden min-h-[380px] flex items-center justify-center border border-[#e5e5ea]">
            <img 
              src={`${BACKEND_URL}/api/inspections/${inspection.id}/image/original`} 
              alt="Original production upload" 
              className="max-h-[500px] object-contain opacity-90 hover:opacity-100 transition duration-300"
            />
          </div>
        </div>

        {/* Right: Model Bboxes/Polygons overlays */}
        <div className="bg-white p-4 rounded-2xl flex flex-col border border-[#e5e5ea] shadow-apple-card">
          <span className="text-xs font-semibold text-[#86868b] uppercase tracking-widest mb-3.5 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#32ade6]" />
            AI Pipeline Predictions
          </span>
          <div className="relative flex-1 bg-[#f5f5f7] rounded-xl overflow-hidden min-h-[380px] flex items-center justify-center border border-[#e5e5ea]">
            <img 
              src={`${BACKEND_URL}/api/inspections/${inspection.id}/image/annotated`} 
              alt="Model predictions overlay" 
              className="max-h-[500px] object-contain"
            />
          </div>
        </div>

      </div>

      {/* Details & Review splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Diagnostics & Detections List */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Diagnostic Speeds */}
          <div className="bg-white p-6 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-6 border border-[#e5e5ea] shadow-apple-card">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#5856d6]/10 rounded-xl text-[#5856d6]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Pre-processing</p>
                <p className="text-base font-bold text-[#1d1d1f] mt-0.5">{(inspection.yolo_time_ms || 0).toFixed(1)} ms</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#32ade6]/10 rounded-xl text-[#32ade6]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Keras MobileNetV2</p>
                <p className="text-base font-bold text-[#1d1d1f] mt-0.5">{inspection.mobilenet_time_ms.toFixed(1)} ms</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#34c759]/10 rounded-xl text-[#34c759]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Total Pipeline Latency</p>
                <p className="text-base font-bold text-[#34c759] mt-0.5">{inspection.total_time_ms.toFixed(1)} ms</p>
              </div>
            </div>
          </div>

          {/* Detections List */}
          <div className="bg-white p-6 rounded-2xl border border-[#e5e5ea] shadow-apple-card">
            <h2 className="text-lg font-bold text-[#1d1d1f] mb-4">Inspection Result Breakdown</h2>
            
            {inspection.detections.length === 0 ? (
              <p className="text-sm text-[#86868b] py-4">No inspection result details logged for this run.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[#86868b] border-b border-[#e5e5ea] pb-3 font-semibold text-xs uppercase tracking-wider">
                      <th className="py-2.5">Index</th>
                      <th className="py-2.5">Asset Class</th>
                      <th className="py-2.5">Confidence</th>
                      <th className="py-2.5">Defect Probability</th>
                      <th className="py-2.5">Result</th>
                      <th className="py-2.5 text-right">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]">
                    {inspection.detections.map((det, index) => {
                      const prob = det.mobilenet_probability;
                      const confidence = det.is_defective ? prob : 1.0 - prob;
                      return (
                        <tr key={det.id} className="text-[#1d1d1f]">
                          <td className="py-3 font-bold text-[#86868b]">#{index + 1}</td>
                          <td className="py-3 capitalize font-semibold">{det.class_name}</td>
                          <td className="py-3 font-mono text-[#86868b]">{(confidence * 100).toFixed(1)}%</td>
                          <td className="py-3 font-mono">
                            <span className={prob >= 0.5 ? "text-[#ff3b30] font-bold" : "text-[#34c759]"}>
                              {(prob * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              det.is_defective 
                                ? 'bg-[#ff3b30]/10 text-[#ff3b30]' 
                                : 'bg-[#34c759]/10 text-[#34c759]'
                            }`}>
                              {det.is_defective ? "DEFECTED" : "NON-DEFECTED"}
                            </span>
                          </td>
                          <td className="py-3 text-right font-semibold text-xs text-[#86868b]">
                            Full Frame
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

        {/* Manager Review Panel */}
        <div className="space-y-6">
          
          {/* Existing review display */}
          {inspection.reviewed_at && (
            <div className="bg-white p-6 rounded-2xl border border-[#e5e5ea] border-l-4 border-l-[#5856d6] shadow-apple-card">
              <h3 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#5856d6]" />
                Submitted Audit Record
              </h3>
              
              <div className="mt-4 space-y-3.5 text-sm">
                <div>
                  <span className="text-xs text-[#86868b] block">Auditor Name</span>
                  <span className="font-semibold text-[#1d1d1f]">{inspection.reviewer_name}</span>
                </div>
                
                <div>
                  <span className="text-xs text-[#86868b] block">Audit Decision</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${
                    inspection.review_status === "APPROVED" 
                      ? "bg-[#34c759]/10 text-[#34c759]" 
                      : "bg-[#ff3b30]/10 text-[#ff3b30]"
                  }`}>
                    {inspection.review_status}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#86868b] block">Feedback Notes</span>
                  <p className="text-[#1d1d1f] mt-1 italic text-xs leading-relaxed bg-[#f5f5f7] p-3 rounded-lg border border-[#e5e5ea]">
                    "{inspection.review_notes || "No notes provided."}"
                  </p>
                </div>

                <div>
                  <span className="text-xs text-[#86868b] block">Audited At</span>
                  <span className="text-[#1d1d1f] text-xs font-semibold">
                    {new Date(inspection.reviewed_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Review Audit Form */}
          <div className="bg-white p-6 rounded-2xl relative overflow-hidden border border-[#e5e5ea] shadow-apple-card">
            <h3 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
              <User className="w-4 h-4 text-[#32ade6]" />
              Quality Manager Audit
            </h3>
            <p className="text-xs text-[#86868b] mt-1">Review inspection run and confirm validation choice.</p>

            <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">Audit Decision</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("APPROVED")}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      reviewStatus === "APPROVED"
                        ? "bg-[#34c759]/15 border-[#34c759] text-[#34c759] shadow-sm"
                        : "bg-[#f5f5f7] border border-[#d1d1d6] text-[#86868b] hover:text-[#1d1d1f]"
                    }`}
                  >
                    Approve Run
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus("REJECTED")}
                    className={`py-2 rounded-xl border text-xs font-bold transition ${
                      reviewStatus === "REJECTED"
                        ? "bg-[#ff3b30]/15 border-[#ff3b30] text-[#ff3b30] shadow-sm"
                        : "bg-[#f5f5f7] border border-[#d1d1d6] text-[#86868b] hover:text-[#1d1d1f]"
                    }`}
                  >
                    Reject Defectives
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">Inspector Name</label>
                <input
                  type="text"
                  required
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full bg-white border border-[#d1d1d6] rounded-xl px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] transition"
                  placeholder="Manager's Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">Audit Notes</label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full bg-white border border-[#d1d1d6] rounded-xl px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] transition resize-none leading-relaxed"
                  placeholder="Log defect observations, pipeline warnings, or reasons for rejection..."
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50"
              >
                {submittingReview ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Decision</span>
                  </>
                )}
              </button>
            </form>

            {reviewMessage && (
              <p className="mt-4 text-xs font-semibold text-center text-[#0071e3] animate-fadeIn">
                {reviewMessage}
              </p>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
