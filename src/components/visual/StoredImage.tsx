"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getMediaAsset } from "@/lib/mediaStorage";

type StoredImageProps = {
  assetId?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  onMissing?: () => void;
};

export default function StoredImage({ assetId, alt, className, style, onMissing }: StoredImageProps) {
  const [image, setImage] = useState<{ assetId: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    getMediaAsset(assetId).then((asset) => {
      if (!active) return;
      if (!asset) {
        onMissing?.();
        return;
      }
      objectUrl = URL.createObjectURL(asset.blob);
      setImage({ assetId: asset.id, url: objectUrl });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, onMissing]);

  if (!assetId || image?.assetId !== assetId) return null;
  // Blob URLs are local user-generated assets and do not benefit from Next image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={alt} className={className} style={style} draggable={false} />;
}

export function BlobImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
