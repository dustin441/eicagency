'use client';

import { useState } from 'react';
import { PlayCircle } from 'lucide-react';

type YouTubeFacadeProps = {
  videoId: string;
  title: string;
};

export default function YouTubeFacade({ videoId, title }: YouTubeFacadeProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-video w-full">
      {loaded ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label={`Play video: ${title}`}
          className="group absolute inset-0 h-full w-full"
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            width={480}
            height={360}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange text-white shadow-xl transition-transform group-hover:scale-105">
              <PlayCircle className="h-8 w-8" aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
