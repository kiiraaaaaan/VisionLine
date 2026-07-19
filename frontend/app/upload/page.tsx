"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileImage,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  RefreshCw,
  Info,
  User,
  Calendar,
  Save,
  Plus,
  Download,
  FileText,
  BadgeCheck,
  Package,
  ChevronDown,
  Search,
  X,
  ListFilter,
  Layers,
  ArrowLeft
} from "lucide-react";
import { API_BASE, BACKEND_URL } from "../config";

interface DetectionItem {
  class_name: string;
  yolo_confidence: number;
  mobilenet_probability: number;
  is_defective: boolean;
  box_x1: number;
  box_y1: number;
  box_x2: number;
  box_y2: number;
}

interface SingleResult {
  id: string;
  filename: string;
  status: string;
  total_objects: number;
  defective_objects: number;
  max_defect_probability: number | null;
  yolo_time_ms: number;
  mobilenet_time_ms: number;
  total_time_ms: number;
  message: string | null;
  detections: DetectionItem[];
}

interface ZipResultItem {
  id: string;
  filename: string;
  status: string;
  total_objects: number;
  defective_objects: number;
  max_defect_probability: number | null;
  total_time_ms: number;
  review_status: string;
}

export default function UploadSandbox() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const [threshold] = useState(0.90);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Results
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const [zipResults, setZipResults] = useState<ZipResultItem[]>([]);
  const [isZip, setIsZip] = useState(false);
  
  // Tab view modes for visual telemetry
  const [viewMode, setViewMode] = useState<"annotated" | "original">("annotated");
  
  // Detail mode while viewing a single item from a ZIP batch
  const [selectedZipItem, setSelectedZipItem] = useState<ZipResultItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (filePreview) URL.revokeObjectURL(filePreview); };
  }, [filePreview]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMsg("");
    setSuccessMsg("");
    setSingleResult(null);
    setZipResults([]);
    setSelectedZipItem(null);
    setImageDimensions(null);
    
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    
    if (ext === ".zip") {
      setIsZip(true);
      setFile(selectedFile);
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
        setFilePreview(null);
      }
      handleUploadSubmit(selectedFile, true);
    } else if ([".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"].includes(ext)) {
      setIsZip(false);
      setFile(selectedFile);
      if (filePreview) URL.revokeObjectURL(filePreview);
      const objectUrl = URL.createObjectURL(selectedFile);
      setFilePreview(objectUrl);
      const img = new Image();
      img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = objectUrl;
      handleUploadSubmit(selectedFile, false);
    } else {
      setErrorMsg("Unsupported format. Please select an image (JPG, PNG, WEBP, BMP, TIF) or a ZIP file.");
    }
  };

  const triggerFileInput = () => { if (loading) return; fileInputRef.current?.click(); };

  const handleUploadSubmit = async (selectedFile: File, uploadAsZip: boolean) => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    const endpoint = uploadAsZip ? "upload-zip" : "upload";
    
    try {
      const res = await fetch(`${API_BASE}/inspections/${endpoint}?threshold=${threshold}`, {
        method: "POST",
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        if (uploadAsZip) {
          setZipResults(data);
          setSuccessMsg(`Successfully processed ZIP batch of ${data.length} images.`);
        } else {
          setSingleResult(data);
          setViewMode("annotated");
          setSuccessMsg("Image processed successfully.");
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Inspection analysis failed.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to connect to backend REST server.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch full details of a specific inspection from ZIP batch
  const handleViewZipItemDetails = async (item: ZipResultItem) => {
    setLoading(true);
    setErrorMsg("");
    setSelectedZipItem(item);
    
    try {
      const res = await fetch(`${API_BASE}/inspections/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setSingleResult(data);
        setViewMode("annotated");
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Failed to retrieve inspection details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Connection failure retrieving item details.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToZipSummary = () => {
    setSingleResult(null);
    setSelectedZipItem(null);
    setErrorMsg("");
  };

  const resetWorkspace = () => {
    setFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    setImageDimensions(null);
    setSingleResult(null);
    setZipResults([]);
    setSelectedZipItem(null);
    setIsZip(false);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const getRecommendation = (resultObj: SingleResult | ZipResultItem | null) => {
    if (!resultObj) return "";
    if (resultObj.status === "UNSUPPORTED") return "The uploaded image does not contain recognizable industrial equipment. Please upload a clear gear/PCB photo.";
    
    const isDef = resultObj.status === "DEFECTIVE";
    
    // Check if it's a detail object or summary object
    const maxDef = (resultObj as SingleResult).max_defect_probability ?? 0;
    const confidence = isDef ? (1.0 - maxDef) : maxDef;

    if (confidence < 0.70) return "Low Confidence: Manual QA review recommended before making sorting decisions.";
    if (isDef) return "FAIL: Defect detected. Route item to the Reject Lane for maintenance or recycling.";
    return "PASS: No defects detected. Item is safe to route to the Normal Lane.";
  };

  // Batch stats calculation
  const totalCount = zipResults.length;
  const defectCount = zipResults.filter(r => r.status === "DEFECTIVE").length;
  const passCount = totalCount - defectCount;
  const yieldRate = totalCount > 0 ? Math.round((passCount / totalCount) * 1000) / 10 : 100;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#e5e5ea] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1d1d1f]">Equipment Inspection Workstation</h1>
          <p className="text-[#86868b] text-sm mt-1.5 font-medium font-sans">
            Active Quality Assurance Terminal · Run visual telemetry and batch upload defect analyses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34c759]" />
          </span>
          <span className="text-xs font-bold text-[#1d1d1f] tracking-wide uppercase">Terminal Online</span>
        </div>
      </div>

      {/* Card 1: Image & ZIP Upload (Full Width) */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
        <div className="p-5 border-b border-[#e5e5ea] bg-[#f5f5f7]/50 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#1d1d1f] flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#0071e3]" />
            Asset Acquisition Station
          </h2>
          <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Start your inspection here</span>
        </div>
        <div className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/zip,application/x-zip-compressed"
            onChange={handleChange}
            disabled={loading}
          />

          {file ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 flex items-start gap-3">
                  <BadgeCheck className="w-5 h-5 text-[#34c759] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#1d1d1f]">
                      {isZip ? "ZIP Archive Staged" : "Image Successfully Staged"}
                    </h4>
                    <p className="text-[11px] text-[#86868b] mt-0.5">
                      {isZip ? "Batch folder locked in memory. Commencing parallel analysis..." : "Asset locked in terminal memory. Analysis starts automatically."}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-xs border-t border-[#e5e5ea] pt-4">
                  <div className="flex justify-between py-1">
                    <span className="text-[#86868b] font-medium">File Name:</span>
                    <span className="font-bold text-[#1d1d1f] truncate max-w-[240px]" title={file.name}>{file.name}</span>
                  </div>
                  {!isZip && (
                    <div className="flex justify-between py-1">
                      <span className="text-[#86868b] font-medium">Resolution:</span>
                      <span className="font-bold text-[#1d1d1f]">{imageDimensions ? `${imageDimensions.width} × ${imageDimensions.height} px` : "Decoding..."}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-[#86868b] font-medium">Archive Size:</span>
                    <span className="font-bold text-[#1d1d1f]">{((file.size || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={triggerFileInput} disabled={loading} className="px-4 py-2.5 bg-white border border-[#d1d1d6] hover:bg-[#f5f5f7] disabled:opacity-50 text-[#1d1d1f] font-bold text-xs rounded-xl shadow-sm transition active:scale-95">
                    {isZip ? "Replace ZIP" : "Replace Image"}
                  </button>
                  <button onClick={resetWorkspace} disabled={loading} className="px-4 py-2.5 bg-white text-[#ff3b30] border border-[#ff3b30]/25 hover:bg-[#ff3b30]/5 disabled:opacity-50 font-bold text-xs rounded-xl transition active:scale-95">Clear</button>
                </div>
              </div>

              <div className="relative aspect-video rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] overflow-hidden flex items-center justify-center max-h-[280px]">
                {isZip ? (
                  <div className="text-center space-y-2 p-6">
                    <Package className="w-16 h-16 text-[#0071e3] mx-auto animate-bounce" />
                    <p className="text-xs font-bold text-[#1d1d1f]">ZIP Archive Locked</p>
                    <p className="text-[10px] text-[#86868b]">{zipResults.length > 0 ? `${zipResults.length} files parsed` : "Extracting entries..."}</p>
                  </div>
                ) : (
                  filePreview && <img src={filePreview} alt="Equipment Telemetry Input" className="max-h-full max-w-full object-contain" />
                )}
              </div>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-xl py-14 px-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-4 ${dragActive ? "border-[#0071e3] bg-[#0071e3]/5" : "border-[#d1d1d6] bg-[#f5f5f7]/40 hover:border-[#0071e3] hover:bg-[#f5f5f7]/60"}`}
            >
              <div className="p-4 bg-[#0071e3]/10 text-[#0071e3] rounded-full"><UploadCloud className="w-10 h-10" /></div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#1d1d1f]">Drag and drop equipment image or ZIP file here</h3>
                <p className="text-xs text-[#86868b]">or click to <span className="text-[#0071e3] underline font-bold">browse local files</span></p>
                <p className="text-[10px] text-[#86868b] mt-2 font-medium">Accepted formats: ZIP, JPG, JPEG, PNG, WEBP, BMP (Max 25MB)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Card 2: Visual Telemetry / Results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
            
            {/* Telemetry Header */}
            <div className="p-5 border-b border-[#e5e5ea] bg-[#f5f5f7]/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#5856d6]" />
                {isZip && !selectedZipItem ? "Batch Processing Results" : "Visual Telemetry"}
              </h2>
              {singleResult && (
                <div className="flex items-center gap-3">
                  {selectedZipItem && (
                    <button
                      onClick={handleBackToZipSummary}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#0071e3] hover:underline"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Batch
                    </button>
                  )}
                  <div className="flex bg-[#e8e8ed] p-0.5 rounded-lg text-[10px] font-bold">
                    {["annotated", "original"].map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m as "annotated" | "original")}
                        className={`px-2 py-1 rounded-md transition capitalize ${viewMode === m ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b] hover:text-[#1d1d1f]"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Telemetry Core Content */}
            <div className="p-5 min-h-[340px] flex flex-col items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <RefreshCw className="w-8 h-8 text-[#ff9500] animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#1d1d1f]">AI Analysis in Progress...</p>
                    <p className="text-xs text-[#86868b] mt-1 font-medium">Executing neural network classification models.</p>
                  </div>
                </div>
              ) : isZip && !selectedZipItem ? (
                // ZIP batch view mode
                zipResults.length > 0 ? (
                  <div className="w-full space-y-6">
                    {/* Batch Yield Card */}
                    <div className="grid grid-cols-3 gap-4 border-b border-[#e5e5ea] pb-5">
                      <div className="text-center">
                        <span className="text-[10px] text-[#86868b] uppercase tracking-wider block font-bold">Yield Pass Rate</span>
                        <span className={`text-2xl font-black font-mono ${yieldRate > 80 ? "text-[#34c759]" : "text-[#ff3b30]"}`}>{yieldRate}%</span>
                      </div>
                      <div className="text-center border-x border-[#e5e5ea]">
                        <span className="text-[10px] text-[#86868b] uppercase tracking-wider block font-bold">Defect Count</span>
                        <span className="text-2xl font-black font-mono text-[#ff3b30]">{defectCount}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-[#86868b] uppercase tracking-wider block font-bold">Total Batch Size</span>
                        <span className="text-2xl font-black font-mono text-[#1d1d1f]">{totalCount}</span>
                      </div>
                    </div>
                    
                    {/* Results Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#e5e5ea] bg-[#f5f5f7]/50 text-[#86868b] uppercase text-[9px] font-extrabold tracking-wider">
                            <th className="py-2.5 px-3">Filename</th>
                            <th className="py-2.5 px-3">Verdict</th>
                            <th className="py-2.5 px-3">Confidence</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f5f5f7] font-semibold text-[#1d1d1f]">
                          {zipResults.map(item => {
                            const isItemDef = item.status === "DEFECTIVE";
                            return (
                              <tr key={item.id} className="hover:bg-[#f5f5f7]/40 transition">
                                <td className="py-3 px-3 truncate max-w-[200px]" title={item.filename}>{item.filename}</td>
                                <td className="py-3 px-3">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isItemDef ? "bg-[#ff3b30]/10 text-[#ff3b30]" : item.status === "NORMAL" ? "bg-[#34c759]/10 text-[#34c759]" : "bg-black/10 text-white"}`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 font-mono">
                                  {item.max_defect_probability !== null 
                                    ? `${((isItemDef ? 1.0 - item.max_defect_probability : item.max_defect_probability) * 100).toFixed(0)}%`
                                    : "N/A"}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={() => handleViewZipItemDetails(item)}
                                    className="px-2.5 py-1 bg-[#f5f5f7] hover:bg-[#0071e3] hover:text-white border border-[#d1d1d6] rounded-lg text-[10px] font-bold transition"
                                  >
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-[#86868b] space-y-3">
                    <Package className="w-10 h-10 text-[#d1d1d6] mx-auto" />
                    <p className="text-xs font-semibold">Staged ZIP file results will populate here</p>
                  </div>
                )
              ) : singleResult ? (
                // Single image view mode
                <div className="w-full space-y-4">
                  <div className={`relative aspect-video rounded-xl bg-[#f5f5f7] border-4 overflow-hidden flex items-center justify-center transition-colors duration-300 ${singleResult.status === "DEFECTIVE" ? "border-[#ff3b30]" : singleResult.status === "NORMAL" ? "border-[#34c759]" : "border-[#e5e5ea]"}`}>
                    <img
                      src={viewMode === "annotated" ? `${BACKEND_URL}/api/inspections/${singleResult.id}/image/annotated?t=${Date.now()}` : `${BACKEND_URL}/api/inspections/${singleResult.id}/image/original`}
                      alt="Inspection"
                      className="max-h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-[#f5f5f7]">
                    <div className="flex items-center gap-3">
                      <span className={`p-3 rounded-xl ${singleResult.status === "DEFECTIVE" ? "bg-[#ff3b30]/10 text-[#ff3b30]" : singleResult.status === "NORMAL" ? "bg-[#34c759]/10 text-[#34c759]" : "bg-[#86868b]/10 text-[#86868b]"}`}>
                        {singleResult.status === "DEFECTIVE" ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                      </span>
                      <div>
                        <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider">Verifying Output</span>
                        <h4 className="text-base font-extrabold text-[#1d1d1f] mt-0.5">
                          {singleResult.status === "DEFECTIVE" ? "DEFECTIVE (FAIL)" : singleResult.status === "NORMAL" ? "NORMAL (PASS)" : "UNSUPPORTED"}
                        </h4>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border shadow-sm ${singleResult.status === "DEFECTIVE" ? "bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/35" : singleResult.status === "NORMAL" ? "bg-[#34c759]/10 text-[#34c759] border-[#34c759]/35" : "bg-[#86868b]/10 text-[#86868b] border-[#86868b]/35"}`}>
                      {singleResult.status === "DEFECTIVE" ? "FAIL" : singleResult.status === "NORMAL" ? "PASS" : "N/A"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-[#86868b] space-y-3">
                  <FileImage className="w-10 h-10 text-[#d1d1d6] mx-auto" />
                  <p className="text-xs font-semibold">Awaiting asset upload and analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Inspection Ticket */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-apple-card overflow-hidden">
            <div className="p-5 border-b border-[#e5e5ea] bg-[#f5f5f7]/50">
              <h2 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2"><FileText className="w-4 h-4 text-[#86868b]" />Inspection Ticket</h2>
            </div>
            <div className="p-5 space-y-5">
              {singleResult ? (
                <div className="space-y-4">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Inspection ID</span><span className="font-mono font-bold text-[#1d1d1f] truncate max-w-[160px]">{singleResult.id}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">File Source</span><span className="font-bold text-[#1d1d1f] truncate max-w-[160px]">{singleResult.filename}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Timestamp</span><span className="font-medium text-[#1d1d1f] flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-[#86868b]" />{new Date().toLocaleTimeString()}</span></div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#86868b]">Confidence Score</span>
                      <span className="font-bold text-[#1d1d1f]">
                        {singleResult.max_defect_probability !== null 
                          ? `${((singleResult.status === "DEFECTIVE" ? 1.0 - singleResult.max_defect_probability : singleResult.max_defect_probability) * 100).toFixed(1)}%` 
                          : "0.0%"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Classification time</span><span className="font-medium text-[#1d1d1f]">{singleResult.mobilenet_time_ms.toFixed(1)} ms</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Total analysis cycle</span><span className="font-medium text-[#1d1d1f]">{singleResult.total_time_ms.toFixed(1)} ms</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Inspector</span><span className="font-bold text-[#1d1d1f] flex items-center gap-1"><User className="w-3.5 h-3.5 text-[#86868b]" />Quality Engineer</span></div>
                  </div>

                  <div className="p-4 rounded-xl border bg-[#f5f5f7] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1d1d1f]"><Info className="w-4 h-4 text-[#0071e3]" /><span>Operational Advisory</span></div>
                    <p className="text-xs text-[#1d1d1f] leading-relaxed font-semibold">{getRecommendation(singleResult)}</p>
                  </div>
                </div>
              ) : isZip && zipResults.length > 0 ? (
                // Render batch summary ticket
                <div className="space-y-4">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Batch Yield Rate</span><span className="font-bold text-[#34c759]">{yieldRate}%</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Total Inspected</span><span className="font-bold text-[#1d1d1f]">{totalCount} items</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Passed (Normal)</span><span className="font-bold text-[#34c759]">{passCount} items</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Rejected (Defective)</span><span className="font-bold text-[#ff3b30]">{defectCount} items</span></div>
                    <div className="flex justify-between items-center"><span className="text-[#86868b]">Inspector</span><span className="font-bold text-[#1d1d1f] flex items-center gap-1"><User className="w-3.5 h-3.5 text-[#86868b]" />Quality Engineer</span></div>
                  </div>

                  <div className="p-4 rounded-xl border bg-[#f5f5f7] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1d1d1f]"><Info className="w-4 h-4 text-[#ff9500]" /><span>Batch Advisory</span></div>
                    <p className="text-xs text-[#1d1d1f] leading-relaxed font-semibold">
                      {defectCount > 0 
                        ? `Attention: ${defectCount} defective parts were detected. Select individual items in the table to review their telemetry images and print sorting reports.`
                        : "Inspection clean. All items in the batch passed the AI criteria safely. Yield is at 100%."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-[#86868b] text-xs">Awaiting analysis report...</div>
              )}
            </div>
          </div>
          {errorMsg && <div className="p-3 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#ff3b30] text-[11px] font-semibold">{errorMsg}</div>}
          {successMsg && <div className="p-3 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 text-[#34c759] text-[11px] font-semibold">{successMsg}</div>}
        </div>

      </div>
    </div>
  );
}
