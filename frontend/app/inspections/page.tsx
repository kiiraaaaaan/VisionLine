"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  AlertTriangle, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Eye, 
  RefreshCw,
  SlidersHorizontal
} from "lucide-react";
import { API_BASE, BACKEND_URL } from "../config";

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

export default function HistoryGallery() {
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/inspections?page=${page}&limit=${limit}`;
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      if (reviewFilter) {
        url += `&review_status=${reviewFilter}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInspections(data.items);
        setTotalCount(data.total);
        setPages(data.pages);
      }
    } catch (error) {
      console.error("Error fetching inspections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [page, statusFilter, reviewFilter]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pages) {
      setPage(newPage);
    }
  };

  const resetFilters = () => {
    setStatusFilter("");
    setReviewFilter("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Inspection History Gallery
          </h1>
          <p className="text-[#86868b] text-sm mt-1">
            Browse and audit historical quality control runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition ${
              showFilters || statusFilter || reviewFilter
                ? "bg-[#0071e3]/10 border-[#0071e3]/30 text-[#0071e3]"
                : "bg-white border border-[#d1d1d6] text-[#1d1d1f] hover:bg-[#f5f5f7]"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters {(statusFilter || reviewFilter) ? "(Active)" : ""}</span>
          </button>

          <button
            onClick={fetchInspections}
            className="p-2.5 rounded-xl bg-white border border-[#d1d1d6] text-[#1d1d1f] hover:bg-[#f5f5f7] transition"
          >
            <RefreshCw className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {(showFilters || statusFilter || reviewFilter) && (
        <div className="bg-white p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 border border-[#e5e5ea] shadow-apple-card animate-fadeIn">
          <div>
            <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">Defect Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full bg-white border border-[#d1d1d6] rounded-xl px-3.5 py-2 text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] transition text-sm font-medium"
            >
              <option value="">All Defect Statuses</option>
              <option value="NORMAL">NORMAL</option>
              <option value="DEFECTIVE">DEFECTIVE</option>
              <option value="NO_OBJECTS">NO OBJECTS</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">Review Decision</label>
            <select
              value={reviewFilter}
              onChange={(e) => { setReviewFilter(e.target.value); setPage(1); }}
              className="w-full bg-white border border-[#d1d1d6] rounded-xl px-3.5 py-2 text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] transition text-sm font-medium"
            >
              <option value="">All Review Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full py-2.5 rounded-xl border border-[#d1d1d6] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition text-xs font-bold"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <RefreshCw className="w-6 h-6 text-[#0071e3] animate-spin" />
            <p className="text-[#86868b] text-xs font-semibold uppercase tracking-widest">Fetching records...</p>
          </div>
        ) : inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-[#86868b] gap-2">
            <SlidersHorizontal className="w-10 h-10 text-[#d1d1d6]" />
            <p className="font-semibold text-sm">No inspections found matching the filter query.</p>
            <button 
              onClick={resetFilters} 
              className="text-xs text-[#0071e3] hover:underline font-bold mt-1"
            >
              Clear filters and try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-[#86868b] border-b border-[#e5e5ea] font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Image</th>
                  <th className="py-4 px-6">Filename</th>
                  <th className="py-4 px-6">Inspection Status</th>
                  <th className="py-4 px-6">Scope</th>
                  <th className="py-4 px-6">Max Probability</th>
                  <th className="py-4 px-6">Review State</th>
                  <th className="py-4 px-6">Speed</th>
                  <th className="py-4 px-6">Date Run</th>
                  <th className="py-4 px-6 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5ea]">
                {inspections.map((item) => {
                  const isDefective = item.status === "DEFECTIVE";
                  const hasObjects = item.status !== "NO_OBJECTS";
                  
                  return (
                    <tr key={item.id} className="hover:bg-[#f5f5f7]/60 transition group">
                      
                      {/* Image Thumbnail */}
                      <td className="py-3.5 px-6">
                        <div className="relative w-14 h-14 bg-[#f5f5f7] rounded-xl overflow-hidden border border-[#e5e5ea]">
                          <img 
                            src={`${BACKEND_URL}/api/inspections/${item.id}/image/annotated`} 
                            alt={item.filename}
                            className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23d1d1d6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                            }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-6 font-semibold text-[#1d1d1f] truncate max-w-[200px]" title={item.filename}>
                        {item.filename}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-6">
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

                      {/* Scope */}
                      <td className="py-3.5 px-6 text-[#1d1d1f]">
                        {hasObjects ? (
                          <span>Full Frame</span>
                        ) : (
                          <span className="text-[#86868b]">None</span>
                        )}
                      </td>

                      {/* Max Defect Probability */}
                      <td className="py-3.5 px-6 font-semibold text-[#1d1d1f]">
                        {item.max_defect_probability !== null ? (
                          <span className={item.max_defect_probability >= 0.5 ? "text-[#ff3b30]" : "text-[#34c759]"}>
                            {(item.max_defect_probability * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[#86868b]">-</span>
                        )}
                      </td>

                      {/* Review Decision Status */}
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.review_status === "APPROVED" 
                            ? "bg-[#34c759]/15 text-[#34c759]" 
                            : item.review_status === "REJECTED" 
                            ? "bg-[#ff3b30]/15 text-[#ff3b30]" 
                            : "bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/20"
                        }`}>
                          {item.review_status}
                        </span>
                      </td>

                      {/* Cycle Time speed */}
                      <td className="py-3.5 px-6 font-semibold text-[#86868b] text-xs">
                        {item.total_time_ms.toFixed(1)} ms
                      </td>

                      {/* Created date */}
                      <td className="py-3.5 px-6 text-xs text-[#86868b]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>

                      {/* Inspect details */}
                      <td className="py-3.5 px-6 text-right">
                        <Link 
                          href={`/inspections/${item.id}`}
                          className="p-2 inline-flex items-center justify-center rounded-lg bg-white border border-[#d1d1d6] text-[#86868b] hover:text-[#0071e3] hover:border-[#0071e3] transition active:scale-95 shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer pagination */}
        {!loading && inspections.length > 0 && (
          <div className="px-6 py-4 border-t border-[#e5e5ea] bg-white flex items-center justify-between">
            <span className="text-xs text-[#86868b]">
              Showing <span className="font-bold text-[#1d1d1f]">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-bold text-[#1d1d1f]">
                {Math.min(page * limit, totalCount)}
              </span>{" "}
              of <span className="font-bold text-[#1d1d1f]">{totalCount}</span> inspections
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white border border-[#d1d1d6] text-[#86868b] hover:text-[#1d1d1f] disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: pages }, (_, idx) => idx + 1)
                .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === pages)
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <div key={p} className="flex items-center">
                      {showEllipsis && <span className="px-1.5 text-slate-400 text-xs">...</span>}
                      <button
                        onClick={() => handlePageChange(p)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${
                          page === p
                            ? "bg-[#0071e3] text-white shadow-sm"
                            : "bg-white border border-[#d1d1d6] text-[#86868b] hover:text-[#1d1d1f]"
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === pages}
                className="p-1.5 rounded-lg bg-white border border-[#d1d1d6] text-[#86868b] hover:text-[#1d1d1f] disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
