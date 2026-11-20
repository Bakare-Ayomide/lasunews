import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Advertisement } from '../types.ts';

interface AdSlotProps {
  ads: Advertisement[];
  placement: 'top_banner' | 'sidebar_box' | 'inline_banner';
  onNavigateAdmin?: () => void;
}

function getExpiresAtMs(ad: Advertisement): number | null {
  if (typeof ad.expires_at_ms === 'number' && Number.isFinite(ad.expires_at_ms)) {
    return ad.expires_at_ms;
  }
  if (ad.expires_at) {
    const parsed = Date.parse(ad.expires_at.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function AdSlot({ ads, placement, onNavigateAdmin }: AdSlotProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const hasTimedAds = ads.some((a) => a.placement === placement && a.status === 'active' && getExpiresAtMs(a) !== null);

  useEffect(() => {
    if (!hasTimedAds) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasTimedAds]);

  const matching = ads
    .filter((a) => {
      if (a.placement !== placement || a.status !== 'active') return false;
      const expMs = getExpiresAtMs(a);
      return expMs === null || expMs > nowMs;
    })
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  if (matching.length === 0) {
    if (placement === 'sidebar_box') {
      return (
        <div className="border border-dashed border-stone-300 bg-white p-5 text-center space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#525866]">
            Campus Advertisement Space
          </p>
          <p className="text-xs text-[#525866] leading-relaxed">
            {onNavigateAdmin
              ? 'No active sidebar campaign. Publish banners from the Admin Dashboard.'
              : 'Sponsored campus notices & departmental campaigns appear here.'}
          </p>
          {onNavigateAdmin && (
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
            >
              Manage Ads
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  if (placement === 'sidebar_box') {
    return (
      <div className="space-y-4">
        {matching.map((ad) => {
          const clickUrl = `/api/public/ads/${ad.id}/click`;
          return (
            <div key={ad.id} className="border border-stone-200 bg-white overflow-hidden">
              <div className="px-3 py-1.5 bg-[#F3F4F6] border-b border-stone-200 flex items-center justify-between text-[11px] text-[#525866]">
                <span className="font-semibold uppercase tracking-wider">Sponsored Notice</span>
                <span>{ad.advertiser_name}</span>
              </div>
              <a
                href={ad.target_url ? clickUrl : '#'}
                target={ad.target_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="block group"
              >
                {ad.image_url ? (
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <div className="p-6 bg-[#0B2545] text-white space-y-2">
                    <p className="font-serif text-lg font-bold leading-snug">{ad.title}</p>
                    <p className="text-xs text-stone-300 inline-flex items-center gap-1">
                      Learn more <ExternalLink className="w-3 h-3" />
                    </p>
                  </div>
                )}
                <div className="p-3 bg-white border-t border-stone-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#14181F] group-hover:text-[#0B2545] truncate">
                    {ad.title}
                  </span>
                  {ad.target_url && <ExternalLink className="w-3.5 h-3.5 text-[#525866] shrink-0" />}
                </div>
              </a>
            </div>
          );
        })}
      </div>
    );
  }

  const containerClass =
    placement === 'top_banner' && matching.length > 1
      ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
      : 'space-y-4';

  return (
    <div className={containerClass}>
      {matching.map((ad) => {
        const clickUrl = `/api/public/ads/${ad.id}/click`;
        return (
          <div key={ad.id} className="border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-1 bg-[#F3F4F6] border-b border-stone-200 flex items-center justify-between text-[11px] text-[#525866]">
              <span className="font-semibold uppercase tracking-wider">Campus Advertisement</span>
              <span>{ad.advertiser_name}</span>
            </div>
            <a
              href={ad.target_url ? clickUrl : '#'}
              target={ad.target_url ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="block"
            >
              {ad.image_url ? (
                <img
                  src={ad.image_url}
                  alt={ad.title}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-36 object-cover"
                />
              ) : (
                <div className="px-6 py-4 bg-[#0B2545] text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#E5C158]">{ad.advertiser_name}</p>
                    <p className="text-lg font-serif font-bold">{ad.title}</p>
                  </div>
                  {ad.target_url && (
                    <span className="px-4 py-2 text-xs font-semibold bg-[#B8860B] text-white inline-flex items-center gap-1.5">
                      Visit Link <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              )}
            </a>
          </div>
        );
      })}
    </div>
  );
}
