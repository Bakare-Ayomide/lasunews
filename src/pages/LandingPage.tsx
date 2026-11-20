import { useEffect, useState, type FormEvent } from 'react';
import {
  Search,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  TrendingUp,
  Send,
  CheckCircle2,
  Newspaper,
  MapPin,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { apiRequest, formatDate, estimateReadTime } from '../lib/api.ts';
import { ArticleMedia } from '../components/ArticleMedia.tsx';
import { AdSlot } from '../components/AdSlot.tsx';
import type { AdminUser, Article, HomeData, PublicUser } from '../types.ts';

interface LandingPageProps {
  homeData: HomeData | null;
  loading: boolean;
  error: string | null;
  currentUser: PublicUser | null;
  currentAdmin?: AdminUser | null;
  onNavigate: (path: string) => void;
  onRetry: () => void;
}

export function LandingPage({
  homeData,
  loading,
  error,
  currentUser,
  currentAdmin,
  onNavigate,
  onRetry,
}: LandingPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [breakingIndex, setBreakingIndex] = useState(0);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>('all');
  const [filteredArticles, setFilteredArticles] = useState<Article[] | null>(null);
  const [filtering, setFiltering] = useState(false);

  // Contact form
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const breakingItems = homeData?.breaking || [];

  useEffect(() => {
    if (breakingItems.length <= 1) return;
    const timer = setInterval(() => {
      setBreakingIndex((prev) => (prev + 1) % breakingItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [breakingItems.length]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    onNavigate(q ? `/news?q=${encodeURIComponent(q)}` : '/news');
  };

  const handleCategoryFilter = async (slug: string) => {
    setActiveCategorySlug(slug);
    if (slug === 'all') {
      setFilteredArticles(null);
      return;
    }
    setFiltering(true);
    try {
      const data = await apiRequest<{ articles: Article[] }>(
        `/api/public/articles?category=${encodeURIComponent(slug)}&limit=6`
      );
      setFilteredArticles(data.articles);
    } catch {
      setFilteredArticles([]);
    } finally {
      setFiltering(false);
    }
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setContactFeedback(null);
    setContactSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify({
          sender_name: senderName,
          sender_email: senderEmail,
          subject,
          message,
        }),
      });
      setContactFeedback({ type: 'success', text: res.message });
      setSenderName('');
      setSenderEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setContactFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send message.',
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  const featuredLead = homeData?.featured[0] || homeData?.latest[0] || null;
  const featuredGridItems = (homeData?.featured.slice(1, 5).length ? homeData.featured.slice(1, 5) : homeData?.latest.slice(1, 5)) || [];
  const displayArticles = filteredArticles !== null ? filteredArticles : homeData?.latest || [];
  const announcements = homeData?.announcements || [];
  const trending = homeData?.trending || [];
  const categories = homeData?.categories || [];
  const categorySections = homeData?.categorySections || [];
  const ads = homeData?.ads || [];

  const activeBreaking = breakingItems.length > 0 ? breakingItems[breakingIndex % breakingItems.length] : null;

  return (
    <div className="bg-[#FAF9F6]">
      {/* Masthead Band (MIT News Style) */}
      <section className="bg-white border-b border-stone-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              <img
                src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png"
                alt="Lagos State University"
                className="h-12 sm:h-14 w-auto object-contain shrink-0"
              />
              <div className="sm:border-l sm:border-stone-300 sm:pl-5">
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#14181F] tracking-tight leading-none">
                  LASU News
                </h1>
                <p className="mt-1.5 text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-[#525866]">
                  On Campus and Around Lagos State University
                </p>
              </div>
            </div>

            {/* Boxed Masthead Utility Bar */}
            <div className="flex flex-col sm:flex-row items-stretch border border-stone-300 divide-y sm:divide-y-0 sm:divide-x divide-stone-300 bg-white relative">
              <button
                type="button"
                onClick={() => onNavigate('/account')}
                className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#14181F] hover:bg-[#FAF9F6] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#B91C1C]" />
                {currentUser ? currentUser.full_name : 'Reader Account'}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBrowseOpen((o) => !o)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#14181F] hover:bg-[#FAF9F6] inline-flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>Browse Desks</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {browseOpen && (
                  <div className="absolute left-0 top-full mt-1 w-60 bg-white border border-stone-300 shadow-lg z-30 py-1">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setBrowseOpen(false);
                          onNavigate(`/news?category=${encodeURIComponent(cat.slug)}`);
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-medium text-[#14181F] hover:bg-[#FAF9F6] flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 inline-block shrink-0"
                            style={{ backgroundColor: cat.color_hex || '#0B2545' }}
                          />
                          {cat.name}
                        </span>
                        <span className="font-mono text-[#525866] tabular-nums">{cat.published_count ?? 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSearchSubmit} className="flex items-stretch min-w-[220px]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH NEWS"
                  aria-label="Search LASU News"
                  className="w-full px-3.5 py-2 text-xs font-medium uppercase tracking-wider text-[#14181F] placeholder:text-[#525866] bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 text-[#14181F] hover:text-[#0B2545] cursor-pointer"
                  aria-label="Submit search"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Breaking-News Ticker Strip */}
        <div className="border-t border-stone-300 bg-[#0B2545] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-stretch justify-between gap-4 min-h-[40px]">
            <div className="flex items-center gap-3 min-w-0 flex-1 py-2">
              <span className="bg-[#B91C1C] text-white text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 shrink-0">
                Breaking
              </span>
              {activeBreaking ? (
                <button
                  type="button"
                  onClick={() => onNavigate(`/article/${activeBreaking.slug}`)}
                  className="text-xs sm:text-sm font-medium text-white hover:underline truncate text-left cursor-pointer"
                >
                  <span className="text-[#E5C158] font-semibold mr-2">[{activeBreaking.category_name}]</span>
                  {activeBreaking.title}
                </button>
              ) : (
                <span className="text-xs text-stone-300 truncate">
                  LASU News Desk: No active breaking dispatches right now — browse official university desks below.
                </span>
              )}
            </div>

            {breakingItems.length > 1 && (
              <div className="flex items-center border-l border-white/15 pl-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setBreakingIndex((prev) => (prev - 1 + breakingItems.length) % breakingItems.length)}
                  className="p-1.5 text-stone-300 hover:text-white cursor-pointer"
                  aria-label="Previous breaking headline"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono tabular-nums px-1 text-stone-300">
                  {(breakingIndex % breakingItems.length) + 1}/{breakingItems.length}
                </span>
                <button
                  type="button"
                  onClick={() => setBreakingIndex((prev) => (prev + 1) % breakingItems.length)}
                  className="p-1.5 text-stone-300 hover:text-white cursor-pointer"
                  aria-label="Next breaking headline"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Hero Split-Box Banner (Exact Screenshot Composition) */}
      <section className="bg-white border-b border-stone-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 border border-stone-300 overflow-hidden items-stretch">
            {/* Left 7-col Photo */}
            <div className="lg:col-span-7 min-h-[280px] sm:min-h-[380px] bg-[#EBE6DF]">
              {featuredLead && featuredLead.featured_image ? (
                <button
                  type="button"
                  onClick={() => onNavigate(`/article/${featuredLead.slug}`)}
                  className="w-full h-full block cursor-pointer"
                >
                  <ArticleMedia
                    src={featuredLead.featured_image}
                    alt={featuredLead.title}
                    className="w-full h-full object-cover"
                    fallbackLabel={featuredLead.title}
                  />
                </button>
              ) : (
                <img
                  src="/src/assets/images/lasu_campus_hero_1795130905033.jpg"
                  alt="Lagos State University Senate Building"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Right 5-col Dark Charcoal/Navy Editorial Block */}
            <div className="lg:col-span-5 bg-[#1D2430] text-white p-7 sm:p-10 flex flex-col justify-between gap-6 border-t lg:border-t-0 lg:border-l border-stone-700">
              {featuredLead ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="font-bold uppercase tracking-wider px-2 py-0.5 text-white"
                      style={{ backgroundColor: featuredLead.category_color || '#B8860B' }}
                    >
                      {featuredLead.category_name}
                    </span>
                    <span className="text-stone-300">
                      {formatDate(featuredLead.published_at || featuredLead.created_at)}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white leading-[1.18]">
                    {featuredLead.title}
                  </h2>

                  <p className="text-sm sm:text-base text-stone-200 leading-relaxed">
                    {featuredLead.excerpt}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <span className="inline-block bg-[#B8860B] text-white text-[11px] font-bold uppercase tracking-widest px-2.5 py-1">
                    Official Newsroom
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white leading-[1.18]">
                    Verified Campus Journalism &amp; University Broadcasts
                  </h2>
                  <p className="text-sm sm:text-base text-stone-200 leading-relaxed">
                    No news dispatches have been published to the database yet. University editors can
                    sign in to publish featured headlines, breaking news, and category reports.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
                {featuredLead ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(`/article/${featuredLead.slug}`)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#E5C158] hover:underline cursor-pointer"
                  >
                    Read Full Story
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : currentAdmin ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#B8860B] text-white hover:bg-[#9E7208] cursor-pointer"
                  >
                    Publish First Broadcast
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate('/news')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#B8860B] text-white hover:bg-[#9E7208] cursor-pointer"
                  >
                    Browse News Archive
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <span className="text-xs font-mono text-stone-300 tabular-nums">
                  {homeData ? `${homeData.stats.total_published} Published` : '0 Published'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error State Banner if API failed */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-red-900">Unable to load news feed: {error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-800 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Today's Featured News: Vertical Rail + 2x2 Boxed Horizontal Grid (Exact MIT News Pattern) */}
      <section className="bg-white border-b border-stone-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col lg:flex-row">
            {/* Vertical Margin Rail */}
            <div className="lg:w-12 lg:border-r border-stone-300 lg:pr-4 pb-4 lg:pb-0 flex lg:items-start lg:justify-center shrink-0">
              <h2 className="text-sm font-sans font-semibold tracking-wider text-[#525866] lg:vertical-rail-label whitespace-nowrap">
                Today&apos;s Featured News
              </h2>
            </div>

            {/* 2x2 Boxed Horizontal Story Cards */}
            <div className="flex-1 lg:pl-8">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 border border-stone-200 bg-[#FAF9F6] animate-pulse" />
                  ))}
                </div>
              ) : featuredGridItems.length === 0 ? (
                <div className="border border-stone-200 bg-[#FAF9F6] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-serif font-bold text-[#14181F]">
                      Featured Story Slots Ready
                    </h3>
                    <p className="text-sm text-[#525866]">
                      Featured campus stories selected by the editorial desk will appear in this 2×2 broadsheet grid.
                    </p>
                  </div>
                  {currentAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigate('/admin')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open Editor
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredGridItems.map((art) => (
                    <article
                      key={art.id}
                      className="grid grid-cols-12 border border-stone-200 bg-white hover:border-stone-400 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onNavigate(`/article/${art.slug}`)}
                        className="col-span-5 aspect-[4/3] bg-[#EBE6DF] overflow-hidden cursor-pointer"
                      >
                        <ArticleMedia src={art.featured_image} alt={art.title} fallbackLabel={art.category_name} />
                      </button>
                      <div className="col-span-7 p-4 flex flex-col justify-between gap-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span
                              className="font-bold uppercase tracking-wider"
                              style={{ color: art.category_color || '#0B2545' }}
                            >
                              {art.category_name}
                            </span>
                            <span className="text-[#525866]">·</span>
                            <span className="text-[#525866]">{formatDate(art.published_at || art.created_at)}</span>
                          </div>
                          <h3 className="text-base font-serif font-bold text-[#14181F] leading-snug line-clamp-2">
                            <button
                              type="button"
                              onClick={() => onNavigate(`/article/${art.slug}`)}
                              className="text-left hover:text-[#0B2545] cursor-pointer"
                            >
                              {art.title}
                            </button>
                          </h3>
                          <p className="text-xs text-[#525866] line-clamp-2 leading-relaxed">{art.excerpt}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Top Leaderboard Ad Slots */}
      {ads.some((a) => a.placement === 'top_banner' && a.status === 'active' && !a.is_expired) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <AdSlot ads={ads} placement="top_banner" />
        </div>
      )}

      {/* Colorful Category-Based News Columns & Rows */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-b border-stone-300">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#B91C1C]">
              Campus Editorial Desks
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-serif font-bold text-[#14181F]">
              News by Category
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/news')}
            className="text-xs font-semibold uppercase tracking-wider text-[#0B2545] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            View All Categories
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categorySections.map(({ category, articles }) => {
            const deskColor = category.color_hex || '#0B2545';
            return (
              <div key={category.id} className="border border-stone-300 bg-white flex flex-col">
                {/* Colorful Category Column Header */}
                <div
                  className="px-5 py-3 flex items-center justify-between text-white"
                  style={{ backgroundColor: deskColor }}
                >
                  <h3 className="text-sm font-sans font-bold uppercase tracking-wider text-white">
                    {category.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/news?category=${encodeURIComponent(category.slug)}`)}
                    className="text-[11px] font-semibold text-white/90 hover:text-white hover:underline cursor-pointer"
                  >
                    More →
                  </button>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  {articles.length === 0 ? (
                    <div className="py-6 text-center space-y-1">
                      <p className="text-xs font-medium text-[#525866]">
                        No stories published in {category.name} yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-200">
                      {articles.map((art, idx) => (
                        <article key={art.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                          {idx === 0 && art.featured_image && (
                            <button
                              type="button"
                              onClick={() => onNavigate(`/article/${art.slug}`)}
                              className="w-full aspect-[16/9] mb-2 overflow-hidden bg-[#EBE6DF] block cursor-pointer"
                            >
                              <ArticleMedia src={art.featured_image} alt={art.title} />
                            </button>
                          )}
                          <h4 className="text-sm font-serif font-bold text-[#14181F] leading-snug">
                            <button
                              type="button"
                              onClick={() => onNavigate(`/article/${art.slug}`)}
                              className="text-left hover:underline cursor-pointer"
                            >
                              {art.title}
                            </button>
                          </h4>
                          <p className="text-xs text-[#525866] line-clamp-2">{art.excerpt}</p>
                          <p className="text-[11px] font-mono text-[#525866] tabular-nums">
                            {formatDate(art.published_at || art.created_at)} · {art.views} reads
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Latest Wire + Trending + Announcements + Sidebar Ad Box */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-b border-stone-300">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left 8 Columns: Filterable Latest Broadcasts + Inline Ad */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0B2545]">
                  Live Wire
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-serif font-bold text-[#14181F]">
                  Latest Campus Dispatches
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/news')}
                className="text-xs font-semibold uppercase tracking-wider text-[#0B2545] hover:underline cursor-pointer"
              >
                Full Archive →
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-stone-300" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategorySlug === 'all'}
                onClick={() => handleCategoryFilter('all')}
                className={`px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategorySlug === 'all'
                    ? 'bg-[#0B2545] text-white'
                    : 'bg-white border border-stone-200 text-[#525866] hover:text-[#14181F]'
                }`}
              >
                All Desks
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategorySlug === cat.slug}
                  onClick={() => handleCategoryFilter(cat.slug)}
                  className={`px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategorySlug === cat.slug
                      ? 'text-white'
                      : 'bg-white border border-stone-200 text-[#525866] hover:text-[#14181F]'
                  }`}
                  style={activeCategorySlug === cat.slug ? { backgroundColor: cat.color_hex || '#0B2545' } : undefined}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {loading || filtering ? (
              <div className="space-y-4">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="h-32 border border-stone-200 bg-white animate-pulse" />
                ))}
              </div>
            ) : displayArticles.length === 0 ? (
              <div className="border border-stone-300 bg-white p-10 text-center space-y-3">
                <Newspaper className="w-8 h-8 text-[#0B2545]/50 mx-auto" strokeWidth={1.5} />
                <h3 className="text-lg font-serif font-bold text-[#14181F]">
                  No published broadcasts in this feed yet
                </h3>
                <p className="text-sm text-[#525866] max-w-md mx-auto">
                  Publish articles from the Administrator Dashboard and they will appear here immediately.
                </p>
              </div>
            ) : (
              <div className="border border-stone-300 bg-white divide-y divide-stone-200">
                {displayArticles.map((article) => (
                  <article
                    key={article.id}
                    className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center hover:bg-[#FAF9F6] transition-colors"
                  >
                    <div className="sm:col-span-4 aspect-[4/3] overflow-hidden border border-stone-200 bg-[#EBE6DF]">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/article/${article.slug}`)}
                        className="w-full h-full block cursor-pointer"
                      >
                        <ArticleMedia
                          src={article.featured_image}
                          alt={article.title}
                          fallbackLabel={article.category_name}
                        />
                      </button>
                    </div>
                    <div className="sm:col-span-8 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866]">
                        <span
                          className="font-bold uppercase tracking-wider"
                          style={{ color: article.category_color || '#0B2545' }}
                        >
                          {article.category_name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(article.published_at || article.created_at)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{estimateReadTime(article.excerpt)}</span>
                      </div>
                      <h3 className="text-xl font-serif font-bold text-[#14181F] leading-snug">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/article/${article.slug}`)}
                          className="text-left hover:text-[#0B2545] cursor-pointer"
                        >
                          {article.title}
                        </button>
                      </h3>
                      <p className="text-sm text-[#525866] line-clamp-2 leading-relaxed">{article.excerpt}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Inline Advertisement Banner */}
            <AdSlot ads={ads} placement="inline_banner" />
          </div>

          {/* Right 4 Columns: Announcements Box, Trending Box, Sidebar Ad Box */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Official Announcements Box */}
            <div className="border border-stone-300 bg-white">
              <div className="px-5 py-3 bg-[#B91C1C] text-white flex items-center justify-between">
                <h3 className="text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Official Announcements
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('/announcements')}
                  className="text-[11px] font-semibold hover:underline cursor-pointer"
                >
                  All →
                </button>
              </div>
              <div className="p-5">
                {announcements.length === 0 ? (
                  <p className="text-xs text-[#525866]">
                    No active Senate or Registrar announcements published yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-200">
                    {announcements.slice(0, 4).map((item) => (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                        <div className="text-[11px] text-[#525866]">
                          <span className={item.announcement_priority === 'urgent' ? 'font-bold text-[#B91C1C]' : 'font-semibold text-[#0B2545]'}>
                            {item.announcement_priority === 'urgent' ? 'Urgent Circular' : 'Notice'}
                          </span>
                          <span className="mx-1.5">·</span>
                          <span>{formatDate(item.published_at || item.created_at)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/article/${item.slug}`)}
                          className="text-sm font-serif font-bold text-[#14181F] hover:text-[#B91C1C] text-left cursor-pointer leading-snug"
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Trending Stories Box */}
            <div className="border border-stone-300 bg-white">
              <div className="px-5 py-3 bg-[#0B2545] text-white flex items-center justify-between">
                <h3 className="text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#E5C158]" />
                  Most Read on Campus
                </h3>
              </div>
              <div className="p-5">
                {trending.length === 0 ? (
                  <p className="text-xs text-[#525866]">
                    Most-read campus stories will populate here automatically as students read published articles.
                  </p>
                ) : (
                  <ol className="divide-y divide-stone-200">
                    {trending.map((item, idx) => (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/article/${item.slug}`)}
                          className="w-full text-left flex items-start gap-3 cursor-pointer group"
                        >
                          <span className="font-mono text-sm font-bold text-[#B8860B] tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <p className="text-sm font-serif font-bold text-[#14181F] group-hover:text-[#0B2545] leading-snug">
                              {item.title}
                            </p>
                            <p className="text-[11px] font-mono text-[#525866] tabular-nums mt-0.5">
                              {item.category_name} · {item.views} reads
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Sidebar Advertisement Box */}
            <AdSlot
              ads={ads}
              placement="sidebar_box"
              onNavigateAdmin={currentAdmin ? () => onNavigate('/admin') : undefined}
            />
          </aside>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-white border-b border-stone-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#0F766E]">
                About the Directorate
              </p>
              <h2 className="text-3xl font-serif font-bold text-[#14181F] leading-tight">
                Lagos State University Campus News &amp; Broadcasting Center
              </h2>
              <p className="text-base text-[#525866] leading-relaxed">
                Unifying institutional reporting across Ojo Main Campus, Epe Engineering Campus, and
                Ikeja College of Medicine with verified dispatches, academic circulars, student
                discussions, and university bulletins.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-stone-200">
                <div>
                  <p className="text-xs text-[#525866]">Articles</p>
                  <p className="text-xl font-serif font-bold tabular-nums">{homeData?.stats.total_published ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[#525866]">Bulletins</p>
                  <p className="text-xl font-serif font-bold tabular-nums">{homeData?.stats.total_announcements ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[#525866]">Comments</p>
                  <p className="text-xl font-serif font-bold tabular-nums">{homeData?.stats.approved_comments ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[#525866]">Total Reads</p>
                  <p className="text-xl font-serif font-bold tabular-nums">{homeData?.stats.total_views ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="aspect-[4/3] overflow-hidden border border-stone-300 bg-[#EBE6DF]">
                <img
                  src="/src/assets/images/lasu_broadcast_newsroom_1795130903742.jpg"
                  alt="LASU Campus Broadcasting Newsroom"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[4/3] overflow-hidden border border-stone-300 bg-[#EBE6DF]">
                <img
                  src="/src/assets/images/lasu_library_quad_1795130904939.jpg"
                  alt="Lagos State University Library Courtyard"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
              Press &amp; Inquiries
            </p>
            <h2 className="text-3xl font-serif font-bold text-[#14181F] leading-tight">
              Contact the Campus Newsroom
            </h2>
            <p className="text-sm text-[#525866] leading-relaxed">
              Submit faculty press releases, student union event notices, or advertisement inquiries
              directly to the Directorate of Information &amp; Public Relations.
            </p>
            <div className="space-y-3 pt-2 text-sm text-[#14181F]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#0B2545] mt-1 shrink-0" />
                <span>Senate Building Annex, Lagos State University, Km 15 Badagry Expressway, Ojo, Lagos</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#0B2545] shrink-0" />
                <span>broadcast@lasu.edu.ng</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#0B2545] shrink-0" />
                <span className="font-mono">+234 (0) 1 454 8199</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={handleContactSubmit}
              className="border border-stone-300 bg-white p-6 sm:p-8 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g., Adewale Ogunleye"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-semibold mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="name@lasu.edu.ng"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-semibold mb-1.5">
                  Subject / Department
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Faculty event announcement or press inquiry"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-semibold mb-1.5">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide full details, dates, and contact information..."
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
                />
              </div>

              {contactFeedback && (
                <div
                  className={`p-3 text-xs flex items-center gap-2 border ${
                    contactFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-red-50 text-red-900 border-red-200'
                  }`}
                >
                  {contactFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{contactFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={contactSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] cursor-pointer min-h-[44px]"
              >
                <Send className="w-4 h-4" />
                {contactSubmitting ? 'Sending Dispatch...' : 'Submit to Newsroom'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
