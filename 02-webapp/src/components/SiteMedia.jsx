import React from "react";
import media from "../content/media.json";

export { media };

export function SiteImage({ slot, image, className, priority = false, decorative = false }) {
  const item = media.images[image || media.slots[slot]];
  if (!item) throw new Error(`Unknown ALP media slot: ${slot || image}`);
  return <img className={className} src={media.basePath + item.file} alt={decorative ? "" : item.alt}
    loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
    decoding="async" style={{ objectPosition: item.position }} />;
}
