import { useEffect, useRef, useState } from "react";
import { X, QrCode } from "lucide-react";

interface Props {
  onDetected: (value: string) => void;
  onClose: () => void;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
  static getSupportedFormats(): Promise<string[]>;
}

export default function QRScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      setError("QR scanning is not supported in this browser. Please type the Equipment ID manually.");
      return;
    }

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    let stopped = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              onDetected(results[0].rawValue.trim().toUpperCase());
              return; // stop scanning after first hit
            }
          } catch {
            // frame not ready yet, keep scanning
          }
          rafRef.current = requestAnimationFrame(scan);
        };

        videoRef.current!.addEventListener("playing", () => {
          rafRef.current = requestAnimationFrame(scan);
        });
      })
      .catch(() => {
        if (!stopped) setError("Camera access denied. Please type the Equipment ID manually.");
      });

    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 safe-area-top">
        <div className="flex items-center gap-2">
          <QrCode size={20} className="text-cat-yellow" />
          <span className="font-semibold">Scan Equipment QR Code</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X size={18} />
        </button>
      </div>

      {/* Camera / error */}
      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <div className="px-8 text-center space-y-3">
            <QrCode size={48} className="text-white/20 mx-auto" />
            <p className="text-white/60 text-sm">{error}</p>
            <button onClick={onClose} className="btn-primary px-6 py-2.5 text-sm">
              Enter ID manually
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Viewfinder overlay */}
            <div className="relative z-10 w-64 h-64">
              <div className="absolute inset-0 border-2 border-white/20 rounded-2xl" />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cat-yellow rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cat-yellow rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cat-yellow rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cat-yellow rounded-br-xl" />
              {/* Scan line */}
              <div className="absolute inset-x-4 h-0.5 bg-cat-yellow/70 animate-scan-line" />
            </div>
          </>
        )}
      </div>

      {!error && (
        <p className="text-center text-white/40 text-xs pb-8 px-4">
          Point the camera at the equipment QR code
        </p>
      )}
    </div>
  );
}
