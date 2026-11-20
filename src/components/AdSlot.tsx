import { ExternalLink } from 'lucide-react';
import type { Advertisement } from '../types.ts';

interface AdSlotProps {
  ads: Advertisement[];
  placement: 'top_banner' | 'sidebar_box' | 'inline_banner';
  onNavigateAdmin?: () => void;
}

export function AdSlot({ ads, placement, onNavigateAdmin }: AdSlotProps) {
  const matching = ads.filter((a) => a.placement === placement && a.status === 'active');

  if (matching.length === 0) {
    if (placement === 'sidebar_box') {
      return (
        <div className="border border-dashed border-stone-300 bg-white p-5 text-center space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#525866]">
            Campus Advertisement Space
          </p>
          <p className="text-xs text-[#525866] leading-relaxed">
            No active sidebar campaign. University departments &amp; sponsors can publish banners from the Admin Dashboard.
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

  const ad = matching[0];
  const clickUrl = `/api/public/ads/${ad.id}/click`;

  if (placement === 'sidebar_box') {
    return (
      <div className="border border-stone-200 bg-white overflow-hidden">
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
  }

  return (
    <div className="border border-stone-200 bg-white overflow-hidden">
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
}
