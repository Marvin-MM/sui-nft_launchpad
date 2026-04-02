/**
 * WalrusImage.tsx
 *
 * Drop-in img replacement that handles walrus:// URIs.
 * Converts walrus://<blobId> → HTTPS aggregator URL for the img src.
 *
 * WHY DIRECT img src (not fetch+blob URL):
 *  <img> tags load cross-origin without CORS restrictions.
 *  Browsers also perform MIME sniffing so missing Content-Type is fine.
 *  Using fetch() fails because the Walrus aggregator doesn't send
 *  Access-Control-Allow-Origin headers for programmatic requests.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { useWalrusImage } from '../hooks/useWalrusImage';

interface WalrusImageProps {
  /** May be walrus://<blobId>, https://..., blob:..., or null */
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** Ignored — kept for API compatibility */
  mimeType?: string;
  /** Fallback src if the primary load fails */
  fallbackSrc?: string;
  /** Slot rendered while the image is loading */
  loadingPlaceholder?: React.ReactNode;
}

export default function WalrusImage({
  src,
  alt = 'NFT Image',
  className = '',
  fallbackSrc,
  loadingPlaceholder,
}: WalrusImageProps) {
  const { src: resolvedSrc } = useWalrusImage(src);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset loading/error state if the source URL changes, and check cache
  useEffect(() => {
    setLoaded(false);
    setError(false);
    
    // If the image is immediately complete from cache, bypass the onload event
    if (imgRef.current && imgRef.current.complete) {
      // In some cases, complete is true but naturalWidth is 0 if it's broken.
      // Eagerly set loaded to true so the UI updates natively.
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true);
      }
    }
  }, [resolvedSrc]);

  // If there's no URL at all, show placeholder
  if (!resolvedSrc) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-white/5 ${className}`}>
        <ImageIcon className="w-8 h-8 text-white/20" />
        <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">NO IMAGE</p>
      </div>
    );
  }

  if (error) {
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          className={className}
          loading="lazy"
        />
      );
    }
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-white/5 ${className}`}>
        <ImageIcon className="w-8 h-8 text-white/20" />
        <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">LOAD FAILED</p>
      </div>
    );
  }

  return (
    <>
      {/* Absolute overlay loader so the img underneath can progressively render */}
      {!loaded && !loadingPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Loader2 className="w-5 h-5 animate-spin text-white/40 drop-shadow-md" />
        </div>
      )}
      {!loaded && loadingPlaceholder && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {loadingPlaceholder}
        </div>
      )}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        // Strict hiding while downloading: prevents the user from confusing
        // native progressive JPEG streaming with an "already rendered" state.
        className={`${className} ${!loaded ? 'opacity-0' : 'opacity-100'} transition-all duration-700`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setError(true);
        }}
        // crossOrigin NOT set — img tags load Walrus blobs fine without CORS
      />
    </>
  );
}
