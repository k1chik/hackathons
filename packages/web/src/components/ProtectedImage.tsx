import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

const WORKER_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/api$/, "");

interface Props {
  photoUrl: string; // e.g. /api/photos/tenant/equip/ts.jpg
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ProtectedImage({ photoUrl, alt, className, style }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const fullUrl = photoUrl.startsWith("http") ? photoUrl : `${WORKER_BASE}${photoUrl}`;
    apiFetch(fullUrl)
      .then((res) => res.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl]);

  if (!src) return null;
  return <img src={src} alt={alt} className={className} style={style} />;
}
