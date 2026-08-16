import React, { useState } from 'react';
import { ImageOff, ZoomIn, X } from 'lucide-react';

interface CameraTrapImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'wide' | 'auto';
  allowZoom?: boolean;
  caption?: string;
}

export const CameraTrapImage: React.FC<CameraTrapImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'video',
  allowZoom = false,
  caption
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const aspectClass = 
    aspectRatio === 'video' ? 'aspect-video' :
    aspectRatio === 'square' ? 'aspect-square' :
    aspectRatio === 'wide' ? 'aspect-[16/9]' : '';

  if (!src || error) {
    return (
      <div className={`bg-[#11141a] border border-[#232834] rounded flex flex-col items-center justify-center text-slate-500 text-[10px] p-2 select-none ${aspectClass} ${className}`}>
        <ImageOff className="w-4 h-4 text-slate-600 mb-1" />
        <span className="font-mono">Image unavailable</span>
      </div>
    );
  }

  return (
    <>
      <div className={`relative bg-[#11141a] border border-[#232834] rounded overflow-hidden group ${aspectClass} ${className}`}>
        {/* Subtle Skeleton while loading */}
        {!loaded && (
          <div className="absolute inset-0 bg-[#161a22] animate-pulse flex items-center justify-center">
            <span className="text-[9px] text-slate-600 font-mono">Loading capture...</span>
          </div>
        )}

        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {allowZoom && loaded && (
          <button
            onClick={() => setIsZoomed(true)}
            className="absolute bottom-1.5 right-1.5 p-1 bg-black/70 hover:bg-black text-slate-300 hover:text-white rounded text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center gap-1 font-mono"
            title="Inspect Full Capture"
          >
            <ZoomIn className="w-3 h-3" />
            <span className="hidden sm:inline">Inspect</span>
          </button>
        )}

        {caption && (
          <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1.5 py-0.5 text-[9px] font-mono text-slate-300 truncate">
            {caption}
          </div>
        )}
      </div>

      {/* Full Capture Inspector Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div 
            className="bg-[#141820] border border-[#2e3544] rounded max-w-4xl w-full p-3 space-y-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-[#232834] text-xs">
              <span className="font-semibold text-slate-200">{alt}</span>
              <button 
                onClick={() => setIsZoomed(false)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] flex items-center justify-center bg-[#0d1015] rounded overflow-hidden">
              <img src={src} alt={alt} className="max-h-[75vh] w-auto object-contain" />
            </div>
            {caption && (
              <div className="text-[11px] text-slate-400 font-mono pt-1">
                {caption}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
