import React from "react";
import CameraTracker from "./components/CameraTracker";
import { Sparkles, HelpCircle, Activity, Camera } from "lucide-react";

export default function App() {
  return (
    <div id="app_root_container" className="min-h-screen bg-[#0A0C10] text-slate-300 font-sans flex flex-col justify-between">
      
      {/* HEADER SECTION (h-14, matching GESTURE_CAM PRO layout style) */}
      <header id="main_header" className="h-16 border-b border-slate-800 bg-[#0F1218] flex items-center justify-between px-6 shrink-0 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <span className="font-bold tracking-tight text-white font-display text-base">
              FOTO KITA <span className="text-indigo-500">BLUR</span>
            </span>
          </div>
        </div>

        {/* TOP STATUS HUB */}
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-mono uppercase text-slate-400">Sistem Aktif</span>
          </div>
          <div className="h-6 w-px bg-slate-800 hidden md:block"></div>
          <div className="text-[10px] text-slate-500 font-mono hidden md:block">
            ENGINE: MEDIAPIPE WASM | FEED: 1080P_AI
          </div>
        </div>
      </header>

      {/* MAIN BODY AREA */}
      <main id="main_dashboard_body" className="relative z-10 w-full flex-1 flex flex-col overflow-hidden">
        
        {/* INSTRUCTIONS STEP CARD */}
        <section id="onboarding_guide" className="bg-[#0F1218]/90 border-b border-slate-800 px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-1 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display font-semibold text-white text-sm">Cara Penggunaan</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Panduan interaktif pose hand-tracking:</p>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div id="step_1" className="bg-slate-950/40 border border-slate-800/60 px-4 py-2 rounded-xl flex gap-3 items-center">
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-400 shrink-0">
                1
              </span>
              <p className="text-[11px] text-slate-400 leading-tight">Nyalakan kamera & izinkan akses webcam.</p>
            </div>

            {/* Step 2 */}
            <div id="step_2" className="bg-slate-950/40 border border-slate-800/60 px-4 py-2 rounded-xl flex gap-3 items-center">
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-400 shrink-0">
                2
              </span>
              <p className="text-[11px] text-slate-400 leading-tight">Buat pose Peace Sign (✌️) di depan kamera.</p>
            </div>

            {/* Step 3 */}
            <div id="step_3" className="bg-slate-950/40 border border-slate-800/60 px-4 py-2 rounded-xl flex gap-3 items-center">
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-400 shrink-0">
                3
              </span>
              <p className="text-[11px] text-slate-400 leading-tight">Feed kamera otomatis menjadi buram/blur.</p>
            </div>
          </div>
        </section>

        {/* CAMERA WORKSPACE */}
        <section id="camera_tracking_workspace" className="w-full flex-1">
          <CameraTracker />
        </section>

      </main>

      {/* FOOTER STATUS BAR */}
      <footer id="main_footer" className="h-8 bg-indigo-600 px-6 flex items-center justify-between text-white text-[10px] font-medium shrink-0 relative z-20">
        <div className="flex gap-4">
          <span>SOURCE: WEBCAM_HD_CAPTURE</span>
          <span className="hidden sm:inline">|</span>
          <span>100% PROSES LOKAL (PRIVASI AMAN)</span>
        </div>
        <div>FOTO KITA BLUR v1.0.0 ACTIVATED</div>
      </footer>

    </div>
  );
}
