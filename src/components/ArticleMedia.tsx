import { useState } from 'react';
import { Newspaper } from 'lucide-react';

interface ArticleMediaProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ArticleMedia({ src, alt, className = 'w-full h-full object-cover', fallbackLabel }: ArticleMediaProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="w-full h-full bg-[#EBE6DF] flex flex-col items-center justify-center p-6 text-center select-none"
        role="img"
        aria-label={alt}
      >
        <Newspaper className="w-7 h-7 text-[#0B2545]/45 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-[#525866] max-w-[22ch] line-clamp-2">
          {fallbackLabel || 'LASU Campus Broadcast'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
