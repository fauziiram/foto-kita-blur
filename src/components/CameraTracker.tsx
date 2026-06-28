import React, { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Camera, RefreshCw, Eye, EyeOff, Sparkles, Image as ImageIcon, Download, Trash, Check, X, ShieldAlert, Sliders, Volume2, VolumeX, Terminal, Shield, Code, ChevronRight } from "lucide-react";
import { detectPeaceSign, GestureResult, Landmark } from "../utils/handDetection";

// Define the hand connection paths for drawing the skeleton
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [5, 6], [6, 7], [7, 8],         // Index
  [9, 10], [10, 11], [11, 12],    // Middle
  [13, 14], [14, 15], [15, 16],   // Ring
  [17, 18], [18, 19], [19, 20],   // Pinky
  [0, 5], [5, 9], [9, 13], [13, 17], [0, 17] // Palm base
];

export default function CameraTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Application States
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings States
  const [blurIntensity, setBlurIntensity] = useState<number>(24);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  // Detection Results States
  const [isHandDetected, setIsHandDetected] = useState<boolean>(false);
  const [gestureInfo, setGestureInfo] = useState<GestureResult | null>(null);
  const [activeBlur, setActiveBlur] = useState<boolean>(false);

  // Dynamic Event Console Logs
  const [logs, setLogs] = useState<string[]>([]);

  // Photo Snap States
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlash, setIsFlash] = useState<boolean>(false);
  const [photos, setPhotos] = useState<string[]>([]);

  // Add system logs helper
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 24)]);
  };

  // Sound effects synthesizer
  const playSynthesizedSound = (type: "beep" | "success" | "click") => {
    if (!isSoundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === "beep") {
        osc.type = "square";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === "success") {
        // High dual chord
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Sound synthesis failed", e);
    }
  };

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    addLog("SYSTEM_BOOT: INITIALIZING MODULES");
    async function initMediaPipe() {
      try {
        setIsModelLoading(true);
        addLog("WASM_LOADER: FETCHING CORE LIBRARY...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        addLog("WASM_LOADER: CORE READY");
        addLog("MODEL_LOADER: FETCHING HAND_LANDMARKER TASK...");
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        landmarkerRef.current = landmarker;
        setIsModelLoading(false);
        addLog("MODEL_LOADER: READY. ENGINE STANDBY");
      } catch (err: any) {
        console.error("Failed to load MediaPipe Hand Landmarker", err);
        setErrorMsg("Gagal memuat model deteksi tangan MediaPipe.");
        addLog("FATAL: MODEL LOADING ERROR");
        setIsModelLoading(false);
      }
    }

    initMediaPipe();

    // Get camera devices on load
    navigator.mediaDevices?.enumerateDevices()
      .then(devs => {
        const videoDevs = devs.filter(d => d.kind === "videoinput");
        setDevices(videoDevs);
        if (videoDevs.length > 0) {
          setSelectedDeviceId(videoDevs[0].deviceId);
          addLog(`CAMERA_API: FOUND ${videoDevs.length} VIDEO INPUTS`);
        }
      })
      .catch(e => console.warn("Failed to list camera devices", e));

    return () => {
      stopCamera();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Handle webcam stream start/stop
  const startCamera = async () => {
    stopCamera();
    try {
      addLog("WEBCAM_STREAM: REQUESTING ACCESS...");
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setCameraPermission("granted");
      setErrorMsg(null);
      addLog("WEBCAM_STREAM: LIVE CONNECTED");
      playSynthesizedSound("click");
    } catch (err: any) {
      console.error("Webcam access error", err);
      setCameraPermission("denied");
      setErrorMsg("Izin kamera ditolak atau kamera tidak tersedia.");
      addLog("WEBCAM_STREAM: PERMISSION_DENIED");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      addLog("WEBCAM_STREAM: DISCONNECTED");
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsHandDetected(false);
    setGestureInfo(null);
    setActiveBlur(false);
  };

  // Device switcher helper
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    addLog("CAMERA_API: SWITCHING INPUT CHANNEL");
    if (isCameraActive) {
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  // Sound toggler
  const toggleSound = () => {
    const nextState = !isSoundEnabled;
    setIsSoundEnabled(nextState);
    addLog(`SYSTEM_AUDIO: ${nextState ? "MUTED_OFF" : "MUTED_ON"}`);
    if (nextState) {
      setTimeout(() => playSynthesizedSound("success"), 50);
    }
  };

  // Detection loop
  useEffect(() => {
    let lastVideoTime = -1;
    let localIsHandDetected = false;

    async function predictLoop() {
      if (
        isCameraActive && 
        videoRef.current && 
        landmarkerRef.current && 
        videoRef.current.readyState >= 2
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        // Sync canvas size with video size
        if (canvas && video) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
        }

        const now = video.currentTime;
        if (now !== lastVideoTime) {
          lastVideoTime = now;
          const startTimeMs = performance.now();
          
          // Detect hand landmarks
          const detections = landmarkerRef.current.detectForVideo(video, startTimeMs);

          if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detections && detections.landmarks && detections.landmarks.length > 0) {
              if (!localIsHandDetected) {
                localIsHandDetected = true;
                setIsHandDetected(true);
                addLog("HAND_SIGHTED: YES");
              }
              
              // Process first hand detected
              const firstHandLandmarks = detections.landmarks[0] as Landmark[];
              const result = detectPeaceSign(firstHandLandmarks);
              setGestureInfo(result);

              // Sound trigger on state change
              if (result.isPeaceSign !== activeBlur) {
                setActiveBlur(result.isPeaceSign);
                addLog(result.isPeaceSign ? "PATTERN_MATCH: PEACE_SIGN" : "PATTERN_RESET: NORMAL");
                if (result.isPeaceSign) {
                  addLog(`TRIGGER_EXEC: GAUSSIAN_BLUR ACTIVE (${blurIntensity}px)`);
                }
                playSynthesizedSound(result.isPeaceSign ? "success" : "beep");
              }

              // Draw hand skeleton overlay if enabled
              if (showSkeleton) {
                const colorTheme = result.isPeaceSign 
                  ? { joint: "#fbbf24", line: "rgba(251, 191, 36, 0.7)", glow: "rgba(251, 191, 36, 0.5)" } // Gold glow for Peace Sign
                  : { joint: "#3b82f6", line: "rgba(96, 165, 250, 0.6)", glow: "rgba(59, 130, 246, 0.4)" }; // Blue theme matching professional polish

                // Draw connecting lines
                ctx.lineWidth = 3;
                ctx.shadowBlur = 6;
                ctx.shadowColor = colorTheme.joint;

                HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
                  const startPt = firstHandLandmarks[startIdx];
                  const endPt = firstHandLandmarks[endIdx];
                  if (startPt && endPt) {
                    ctx.strokeStyle = colorTheme.line;
                    ctx.beginPath();
                    ctx.moveTo(startPt.x * canvas.width, startPt.y * canvas.height);
                    ctx.lineTo(endPt.x * canvas.width, endPt.y * canvas.height);
                    ctx.stroke();
                  }
                });

                // Draw joints
                ctx.shadowBlur = 10;
                firstHandLandmarks.forEach((landmark) => {
                  ctx.fillStyle = colorTheme.joint;
                  ctx.beginPath();
                  ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, 2 * Math.PI);
                  ctx.fill();
                });
                
                // Clear shadows
                ctx.shadowBlur = 0;
              }
            } else {
              if (localIsHandDetected) {
                localIsHandDetected = false;
                setIsHandDetected(false);
                setGestureInfo(null);
                addLog("HAND_SIGHTED: NO");
              }
              if (activeBlur) {
                setActiveBlur(false);
                addLog("TRIGGER_EXEC: BLUR_OFF");
                playSynthesizedSound("beep");
              }
            }
          }
        }
      }

      if (isCameraActive) {
        requestRef.current = requestAnimationFrame(predictLoop);
      }
    }

    if (isCameraActive) {
      requestRef.current = requestAnimationFrame(predictLoop);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraActive, showSkeleton, activeBlur, blurIntensity]);

  // Handle Photo Snap with countdown
  const takeSnapshot = () => {
    if (!isCameraActive || videoRef.current === null) return;
    playSynthesizedSound("click");
    addLog("SHUTTER_SEQUENCE: STANDBY_3S");
    setCountdown(3);
  };

  // Countdown handler
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        playSynthesizedSound("click");
        addLog(`SHUTTER_SEQUENCE: T-${countdown}`);
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Capture Photo!
      triggerCapture();
      setCountdown(null);
    }
  }, [countdown]);

  const triggerCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Trigger Flash Effect
    setIsFlash(true);
    playSynthesizedSound("success");
    addLog("SHUTTER_SEQUENCE: CAPTURING FRAME");
    setTimeout(() => {
      setIsFlash(false);
    }, 150);

    // Render snapshot with optional blur & tracking overlay applied
    const tempCanvas = document.createElement("canvas");
    const video = videoRef.current;
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");

    if (tempCtx) {
      // Mirror the context as our live feed is mirrored
      tempCtx.translate(tempCanvas.width, 0);
      tempCtx.scale(-1, 1);

      // Apply blur filter if peace sign is active
      if (activeBlur) {
        tempCtx.filter = `blur(${blurIntensity}px)`;
      }

      // Draw the video frame
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.filter = "none"; // reset

      // Mirror back for overlays so text/drawing is oriented correctly
      tempCtx.translate(tempCanvas.width, 0);
      tempCtx.scale(-1, 1);

      // Draw hand landmarks if enabled and currently detected
      if (showSkeleton && isHandDetected && gestureInfo && canvasRef.current) {
        tempCtx.drawImage(canvasRef.current, 0, 0);
      }

      // If blurred, we can stamp a beautiful watermarked label
      if (activeBlur) {
        tempCtx.fillStyle = "rgba(15,18,24,0.85)";
        tempCtx.beginPath();
        tempCtx.roundRect(16, 16, 210, 36, 8);
        tempCtx.fill();

        tempCtx.fillStyle = "#fbbf24";
        tempCtx.font = "bold 13px system-ui";
        tempCtx.fillText("✌️ PEACE BLUR ACTIVE", 28, 38);
      }

      const imgDataUrl = tempCanvas.toDataURL("image/png");
      setPhotos(prev => [imgDataUrl, ...prev]);
      addLog("SHUTTER_SEQUENCE: SAVE_SNAPSHOT SUCCESS");
    }
  };

  const deletePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    addLog("GALLERY_API: DELETED SNAPSHOT");
    playSynthesizedSound("click");
  };

  return (
    <div id="camera_tracker_app" className="flex flex-col lg:flex-row flex-1 w-full bg-[#0A0C10] lg:overflow-hidden">
      
      {/* 1. LEFT SIDEBAR: Tracking modules and triggers */}
      <aside id="left_sidebar_container" className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0F1218] p-4 sm:p-5 order-2 lg:order-1 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-5">
        
        {/* MODULES CONTROL */}
        <div id="tracking_modules_section">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold font-mono">
            Tracking Modules
          </h3>
          <div className="space-y-3">
            {/* Hand skeletal toggle */}
            <div id="skeleton_toggle_box" className="flex items-center justify-between p-2.5 rounded-lg bg-[#0A0C10]/60 border border-slate-800">
              <span className="text-xs text-slate-300 font-medium">Hand Skeleton</span>
              <button
                id="btn_toggle_skeleton_switch"
                onClick={() => {
                  setShowSkeleton(!showSkeleton);
                  addLog(`MODULE_TRACKER: SKELETON_${!showSkeleton ? "ON" : "OFF"}`);
                  playSynthesizedSound("click");
                }}
                className={`w-9 h-5 rounded-full transition-colors relative duration-200 focus:outline-none ${
                  showSkeleton ? "bg-indigo-600" : "bg-slate-800"
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${
                  showSkeleton ? "right-1" : "left-1"
                }`} />
              </button>
            </div>

            {/* Audio chime toggle */}
            <div id="audio_toggle_box" className="flex items-center justify-between p-2.5 rounded-lg bg-[#0A0C10]/60 border border-slate-800">
              <span className="text-xs text-slate-300 font-medium">Sound Feedback</span>
              <button
                id="btn_toggle_sound_switch"
                onClick={toggleSound}
                className={`w-9 h-5 rounded-full transition-colors relative duration-200 focus:outline-none ${
                  isSoundEnabled ? "bg-indigo-600" : "bg-slate-800"
                }`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${
                  isSoundEnabled ? "right-1" : "left-1"
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* TRIGGER LOGIC */}
        <div id="trigger_logic_section">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold font-mono">
            Trigger Logic
          </h3>
          <div className="bg-slate-950 rounded-xl p-4 border border-indigo-950/30 font-mono text-[11px] leading-relaxed shadow-inner">
            <div className="text-indigo-400 mb-1">{"if (gesture == 'PEACE') {"}</div>
            <div className="text-slate-300 ml-4 mb-1 underline decoration-indigo-500 decoration-2">
              camera.setBlur(<span className="text-amber-400 font-bold">{blurIntensity}px</span>);
            </div>
            <div className="text-indigo-400">{"}"}</div>
          </div>
        </div>

        {/* ACTIVE DETECTION STATUS BANNER */}
        <div id="detection_event_section" className="lg:mt-auto mt-0 lg:pt-4 pt-0 lg:border-t border-t-0 border-slate-800/60 flex flex-col justify-center">
          {activeBlur ? (
            <div id="status_event_alert_active" className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl animate-fade-in">
              <div className="text-[10px] text-red-400 uppercase font-bold mb-1 tracking-wider flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Detection Event
              </div>
              <p className="text-xs text-red-200 leading-normal font-sans">
                V-Sign (Peace) terdeteksi. Mengaburkan viewport sebesar <span className="font-bold text-red-400">{blurIntensity}px</span>.
              </p>
            </div>
          ) : (
            <div id="status_event_alert_idle" className="bg-slate-900/30 border border-slate-800/40 p-4 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Detection Idle
              </div>
              <p className="text-xs text-slate-400 leading-normal font-sans">
                Mendeteksi kamera... Belum ada pose pemicu yang aktif.
              </p>
            </div>
          )}
        </div>

      </aside>

      {/* 2. MIDDLE VIEWPORT: Main camera workspace */}
      <main id="middle_viewport_container" className="flex-1 bg-black/40 p-4 sm:p-6 flex flex-col gap-6 order-1 lg:order-2 lg:overflow-y-auto overflow-y-visible">
        
        {/* VIEWPORT BOX */}
        <div 
          id="webcam_stage_card" 
          className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl aspect-video w-full flex items-center justify-center group"
        >
          {/* MIRRORED LIVE FEED VIDEO & OVERLAY CANVAS */}
          <video
            ref={videoRef}
            id="webcam_video_stream"
            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none transition-all duration-300"
            style={{ 
              transform: "scaleX(-1)", 
              filter: activeBlur ? `blur(${blurIntensity}px)` : "none" 
            }}
            playsInline
            muted
          />

          <canvas
            ref={canvasRef}
            id="tracking_overlay_canvas"
            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-10"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* DYNAMIC SHUTTER FLASH OVERLAY */}
          {isFlash && (
            <div 
              id="shutter_flash_overlay" 
              className="absolute inset-0 bg-white z-40 transition-opacity duration-150 animate-pulse"
            />
          )}

          {/* INITIAL/OFF CAMERA PLACEHOLDER */}
          {!isCameraActive && (
            <div id="camera_disabled_placeholder" className="flex flex-col items-center justify-center p-8 z-20 text-center select-none animate-fade-in">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center text-slate-400 mb-4 group-hover:scale-105 transition-transform duration-300 shadow-xl">
                <Camera className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-base font-display font-semibold text-white mb-2">Kamera Offline</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                Tekan tombol di bawah untuk menyalakan kamera. Semua pemrosesan citra berjalan lokal pada CPU/GPU browser Anda.
              </p>
              <button
                id="btn_activate_camera_large"
                onClick={startCamera}
                disabled={isModelLoading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-600 text-white font-medium text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition-all duration-150 flex items-center gap-2"
              >
                {isModelLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    Memproses Engine AI...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Hubungkan Kamera
                  </>
                )}
              </button>
            </div>
          )}

          {/* WEBCAM HUD OVERLAYS (When active) */}
          {isCameraActive && (
            <>
              {/* COUNTDOWN TIMER */}
              {countdown !== null && (
                <div id="snapshot_countdown_hud" className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30">
                  <span className="text-7xl font-display font-black text-amber-400 animate-ping">
                    {countdown}
                  </span>
                </div>
              )}

              {/* HUD STATUS OVERLAYS */}
              <div id="viewport_hud_header" className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none select-none z-20">
                <div className="border-l-2 border-t-2 border-white/40 w-6 h-6" />
                
                {activeBlur ? (
                  <div className="px-3 py-1 bg-red-600 text-white font-bold text-[10px] font-mono rounded shadow-lg animate-pulse tracking-wider">
                    ACTIVE_BLUR ON
                  </div>
                ) : (
                  <div className="px-3 py-1 bg-[#0F1218]/90 border border-slate-800 text-slate-400 text-[10px] font-mono rounded tracking-wider">
                    ACTIVE_BLUR OFF
                  </div>
                )}

                <div className="border-r-2 border-t-2 border-white/40 w-6 h-6" />
              </div>

              {/* HUD FOOTER CORNER LINES */}
              <div id="viewport_hud_footer_corners" className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none select-none z-20">
                <div className="border-l-2 border-b-2 border-white/40 w-6 h-6" />
                <span className="text-white/40 text-[9px] font-mono">REC [●] LIVE</span>
                <div className="border-r-2 border-b-2 border-white/40 w-6 h-6" />
              </div>
            </>
          )}
        </div>

        {/* QUICK CONTROL ACTIONS BAR */}
        {isCameraActive && (
          <div id="quick_controls_panel" className="bg-[#0F1218] border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                id="btn_take_photo"
                onClick={takeSnapshot}
                disabled={countdown !== null}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Snapshot (3s)
              </button>

              <button
                id="btn_toggle_skeleton_quick"
                onClick={() => {
                  setShowSkeleton(!showSkeleton);
                  addLog(`MODULE_TRACKER: SKELETON_${!showSkeleton ? "ON" : "OFF"}`);
                  playSynthesizedSound("click");
                }}
                className={`flex-1 sm:flex-none p-2.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  showSkeleton 
                    ? "bg-[#0A0C10] text-indigo-400 border-indigo-500/20" 
                    : "bg-[#0A0C10] text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
              >
                {showSkeleton ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>Skeleton</span>
              </button>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {devices.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-500 font-mono">WEBCAM:</span>
                  <select
                    id="camera_device_select"
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="bg-slate-950 text-[10px] text-slate-300 border border-slate-800 rounded-lg py-1.5 px-2 focus:outline-none focus:border-indigo-500 max-w-[130px] font-mono"
                  >
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `CAM_${devices.indexOf(device) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                id="btn_deactivate_camera"
                onClick={stopCamera}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/40 rounded-lg text-xs font-medium transition-all"
              >
                Matikan
              </button>
            </div>
          </div>
        )}

        {/* ERROR DISPLAY */}
        {errorMsg && (
          <div id="error_alert_box" className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 flex gap-3 items-start animate-shake">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-rose-400">Kesalahan Kamera / Sistem</h4>
              <p className="text-[11px] text-rose-300/80 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* PHOTO SNAPSHOTS GALLERY */}
        {photos.length > 0 && (
          <div id="captured_photos_card" className="bg-[#0F1218] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="font-display font-semibold text-white text-xs">Snapshot Gallery ({photos.length})</h3>
              </div>
              <button
                id="btn_clear_all_photos"
                onClick={() => {
                  setPhotos([]);
                  addLog("GALLERY_API: CLEARED_ALL");
                  playSynthesizedSound("click");
                }}
                className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors font-mono uppercase"
              >
                Hapus Semua
              </button>
            </div>

            <div id="photos_grid" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div 
                  key={index} 
                  id={`photo_card_${index}`}
                  className="relative group aspect-video bg-slate-950 border border-slate-800/60 rounded-lg overflow-hidden shadow"
                >
                  <img src={photo} alt={`Snapshot ${index}`} className="w-full h-full object-cover" />
                  
                  {/* Action overlays (always visible on mobile touch screen, hover triggered on desktop) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800/80 px-3 py-2 flex items-center justify-between opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
                    <span className="text-[10px] font-mono text-slate-500">#{index + 1}</span>
                    <div className="flex gap-2">
                      <a
                        id={`btn_download_photo_${index}`}
                        href={photo}
                        download={`peace-blur-snapshot-${index}.png`}
                        className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-all active:scale-90"
                        title="Unduh Gambar"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        id={`btn_delete_photo_${index}`}
                        onClick={() => deletePhoto(index)}
                        className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded transition-all active:scale-90"
                        title="Hapus Gambar"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* 3. RIGHT PANEL: Live logs console & biomechanics analytics */}
      <aside id="right_sidebar_container" className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#0F1218] p-4 sm:p-5 order-3 lg:order-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-6 lg:overflow-y-auto overflow-y-visible">
        
        {/* SENSITIVITY CONFIG */}
        <div id="tracking_settings_section" className="lg:pb-4 pb-0 lg:border-b border-b-0 border-slate-800/60">
          <div className="flex items-center gap-1.5 text-slate-400 mb-3">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold font-mono">
              Intensity Config
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="input_blur_strength_slider" className="text-slate-400 font-medium">Blur Radius</label>
              <span className="font-mono text-indigo-400 font-bold">{blurIntensity}px</span>
            </div>
            <input
              id="input_blur_strength_slider"
              type="range"
              min="4"
              max="60"
              value={blurIntensity}
              onChange={(e) => {
                setBlurIntensity(Number(e.target.value));
              }}
              className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
            />
          </div>
        </div>

        {/* SYSTEM CONSOLE LOGS */}
        <div id="tracking_console_section" className="flex-1 flex flex-col min-h-[160px]">
          <div className="flex items-center gap-1.5 text-slate-400 mb-3">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold font-mono">
              Tracking Console
            </h3>
          </div>
          <div 
            id="console_log_lines_box" 
            className="flex-1 bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono text-[10px] leading-relaxed overflow-y-auto h-[160px] max-h-[220px] shadow-inner select-none space-y-1.5 scrollbar-thin"
          >
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-8">[CONSOLE_STANDBY]</div>
            ) : (
              logs.map((log, i) => {
                let colorClass = "text-slate-500";
                if (log.includes("PEACE_SIGN") || log.includes("GAUSSIAN_BLUR")) {
                  colorClass = "text-amber-400 font-bold";
                } else if (log.includes("CONNECTED") || log.includes("READY")) {
                  colorClass = "text-emerald-400";
                } else if (log.includes("ACCESS") || log.includes("BOOT")) {
                  colorClass = "text-indigo-400";
                } else if (log.includes("NO") || log.includes("DEACTIVATED")) {
                  colorClass = "text-slate-400";
                }
                return (
                  <div key={i} className={`${colorClass} truncate`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BIOMECHANICS METRICS PROGRESS BARS */}
        <div id="joint_confidence_section" className="lg:pt-4 pt-0 lg:border-t border-t-0 border-slate-800/60">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3.5 font-semibold font-mono">
            Joint Confidence
          </h3>

          {!isHandDetected || !gestureInfo ? (
            <div id="metrics_offline_placeholder" className="py-6 text-center bg-slate-950/40 rounded-xl border border-slate-900">
              <span className="text-2xl block select-none filter opacity-50 mb-1">✋</span>
              <p className="text-[10px] text-slate-500 max-w-[180px] mx-auto leading-normal">
                Harap tempatkan tangan di depan kamera untuk melihat telemetri koordinat jari.
              </p>
            </div>
          ) : (
            <div id="metrics_active_telemetry" className="space-y-3.5">
              
              {/* INDEX */}
              <div id="metric_index">
                <div className="flex justify-between text-[10px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5 text-indigo-400" />
                    Index Finger
                  </span>
                  <span className={gestureInfo.details.indexExtended ? "text-emerald-400 font-bold" : "text-slate-500"}>
                    {gestureInfo.details.indexExtended ? "99% (Lurus)" : `${Math.round(Math.min(95, gestureInfo.details.indexRatio * 50))}%`}
                  </span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 ${
                      gestureInfo.details.indexExtended ? "bg-indigo-500" : "bg-slate-700"
                    }`} 
                    style={{ width: gestureInfo.details.indexExtended ? "99%" : `${Math.min(95, gestureInfo.details.indexRatio * 50)}%` }}
                  />
                </div>
              </div>

              {/* MIDDLE */}
              <div id="metric_middle">
                <div className="flex justify-between text-[10px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5 text-indigo-400" />
                    Middle Finger
                  </span>
                  <span className={gestureInfo.details.middleExtended ? "text-emerald-400 font-bold" : "text-slate-500"}>
                    {gestureInfo.details.middleExtended ? "98% (Lurus)" : `${Math.round(Math.min(95, gestureInfo.details.middleRatio * 50))}%`}
                  </span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 ${
                      gestureInfo.details.middleExtended ? "bg-indigo-500" : "bg-slate-700"
                    }`} 
                    style={{ width: gestureInfo.details.middleExtended ? "98%" : `${Math.min(95, gestureInfo.details.middleRatio * 50)}%` }}
                  />
                </div>
              </div>

              {/* RING */}
              <div id="metric_ring">
                <div className="flex justify-between text-[10px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5 text-indigo-400" />
                    Ring Finger
                  </span>
                  <span className={gestureInfo.details.ringCurled ? "text-emerald-400 font-bold" : "text-rose-500"}>
                    {gestureInfo.details.ringCurled ? "95% (Lipat)" : `${Math.round(Math.min(95, (1 / Math.max(0.01, gestureInfo.details.ringRatio)) * 40))}%`}
                  </span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 ${
                      gestureInfo.details.ringCurled ? "bg-emerald-500/80" : "bg-rose-500/60"
                    }`} 
                    style={{ width: gestureInfo.details.ringCurled ? "95%" : `${Math.min(95, (1 / Math.max(0.01, gestureInfo.details.ringRatio)) * 40)}%` }}
                  />
                </div>
              </div>

              {/* PINKY */}
              <div id="metric_pinky">
                <div className="flex justify-between text-[10px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5 text-indigo-400" />
                    Pinky Finger
                  </span>
                  <span className={gestureInfo.details.pinkyCurled ? "text-emerald-400 font-bold" : "text-rose-500"}>
                    {gestureInfo.details.pinkyCurled ? "94% (Lipat)" : `${Math.round(Math.min(95, (1 / Math.max(0.01, gestureInfo.details.pinkyRatio)) * 40))}%`}
                  </span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 ${
                      gestureInfo.details.pinkyCurled ? "bg-emerald-500/80" : "bg-rose-500/60"
                    }`} 
                    style={{ width: gestureInfo.details.pinkyCurled ? "94%" : `${Math.min(95, (1 / Math.max(0.01, gestureInfo.details.pinkyRatio)) * 40)}%` }}
                  />
                </div>
              </div>

              {/* V-SHAPE SEPARATION */}
              <div id="metric_v_separation">
                <div className="flex justify-between text-[10px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5 text-indigo-400" />
                    V-Shape Spread
                  </span>
                  <span className={gestureInfo.details.vSeparated ? "text-amber-400 font-bold" : "text-slate-500"}>
                    {gestureInfo.details.vSeparated ? "99% (Sempurna)" : "Kurang Lebar"}
                  </span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 ${
                      gestureInfo.details.vSeparated ? "bg-amber-400" : "bg-slate-700"
                    }`} 
                    style={{ width: gestureInfo.details.vSeparated ? "99%" : "30%" }}
                  />
                </div>
              </div>

            </div>
          )}
        </div>

      </aside>

    </div>
  );
}
