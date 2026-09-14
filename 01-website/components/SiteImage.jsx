import media from '../content/media.json';
export default function SiteImage({ id, slot, className = '', priority = false, decorative = false }) {
  const item = media.images[id || media.slots[slot]];
  return <img src={media.basePath + item.file} alt={decorative ? '' : item.alt} className={className}
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"
    style={{ objectPosition: item.position }} />;
}
