"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { IndexedImage } from "@/lib/live/projection";

export const mediaUrl = (image: IndexedImage) =>
  `/api/media?page=${encodeURIComponent(image.pageId)}&file=${encodeURIComponent(image.file)}`;

/** A portfolio image from Notion, fetched through a fresh signed link. */
export function WorkImage({ image, alt, emptyLabel = "Work not captured yet" }: { image?: IndexedImage; alt: string; emptyLabel?: string }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed)
    return (
      <div className="artwork art-missing" role="img" aria-label="Portfolio media unavailable">
        <ImageOff size={25} />
        <span>{image ? "Image did not load" : emptyLabel}</span>
      </div>
    );
  return (
    <div className="artwork art-photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Notion URLs change hourly, so they bypass the image optimizer */}
      <img src={mediaUrl(image)} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}
