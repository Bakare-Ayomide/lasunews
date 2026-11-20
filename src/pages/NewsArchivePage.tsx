import { useEffect, useState, type FormEvent } from 'react';
import { Search, ArrowRight, Newspaper, Megaphone } from 'lucide-react';
import { apiRequest, formatDate, estimateReadTime } from '../lib/api.ts';
import { ArticleMedia } from '../components/ArticleMedia.tsx';
import type { AdminUser, Article, Category } from '../types.ts';

interface NewsArchivePageProps {
  categories: Category[];
  initialQuery?: string;
  initialCategory?: string;
  onlyAnnouncements?: boolean;
  currentAdmin?: AdminUser | null;
  onNavigate: (path: string) => void;
}

export function NewsArchivePage({
  categories,
  initialQuery = '',
  initialCategory = 'all',
  onlyAnnouncements = false,
  currentAdmin,
  onNavigate,
}: NewsArchivePageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'all');
  const [sort, setSort] = useState<'latest' | 'trending'>('latest');
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    setCategory(initialCategory || 'all');
    setPage(1);
  }, [initialQuery, initialCategory, onlyAnnouncements]);

  useEffect(() => {
    let active = true;
    const fetchArchive = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (category && category !== 'all') params.set('category', category);
        if (onlyAnnouncements) params.set('type', 'announcement');
        params.set('sort', sort);
        params.set('page', String(page));
        params.set('limit', '9');

        const data = await apiRequest<{
          articles: Article[];
          pagination: { total: number; total_pages: number };
        }>(`/api/public/articles?${params.toString()}`);

        if (!active) return;
        setArticles(data.articles);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load articles.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchArchive();
    return () => {
      active = false;
    };
  }, [query, category, sort, page, onlyAnnouncements]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="border-b border-stone-200 pb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#B8860B]">
          {onlyAnnouncements ? 'Official University Bulletins' : 'Lagos State University News Archive'}
        </p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#14181F]">
            {onlyAnnouncements ? 'Campus Announcements & Circulars' : 'Campus News & Dispatches'}
          </h1>
          <p className="text-xs font-mono text-[#525866] tabular-nums">
            {total} {total === 1 ? 'story' : 'stories'} found
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="border border-stone-200 bg-white rounded-md p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <form onSubmit={handleSearch} className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-[#525866] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by headline, keyword, or faculty..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6] focus:border-[#0B2545] focus:outline-none"
            />
          </form>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6] text-[#14181F] focus:border-[#0B2545] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Sort articles"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'latest' | 'trending');
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6] text-[#14181F] focus:border-[#0B2545] focus:outline-none"
            >
              <option value="latest">Latest First</option>
              <option value="trending">Most Read</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-md p-4 text-sm text-red-900">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="h-80 rounded-md border border-stone-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="border border-stone-200 bg-white rounded-md p-12 text-center space-y-3">
          {onlyAnnouncements ? (
            <Megaphone className="w-8 h-8 text-[#0B2545]/50 mx-auto" strokeWidth={1.5} />
          ) : (
            <Newspaper className="w-8 h-8 text-[#0B2545]/50 mx-auto" strokeWidth={1.5} />
          )}
          <h2 className="text-xl font-serif font-bold text-[#14181F]">
            No matching broadcasts found
          </h2>
          <p className="text-sm text-[#525866] max-w-md mx-auto leading-relaxed">
            {query || category !== 'all'
              ? 'No published stories match your current search or category filter. Try clearing the filters.'
              : 'No articles have been published to the database yet. Administrators can publish new campus news from the dashboard.'}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {(query || category !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setPage(1);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#0B2545] border border-stone-300 rounded-md hover:bg-stone-50 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            {currentAdmin && (currentAdmin.role === 'editor' || currentAdmin.role === 'super_admin') && (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
              >
                Admin Portal
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles.map((article) => (
              <article
                key={article.id}
                className="border border-stone-200 bg-white rounded-md overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(`/article/${article.slug}`)}
                  className="aspect-[4/3] w-full overflow-hidden bg-[#EBE6DF] block cursor-pointer"
                >
                  <ArticleMedia
                    src={article.featured_image}
                    alt={article.title}
                    className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    fallbackLabel={article.category_name}
                  />
                </button>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866]">
                      <span className="font-semibold text-[#0B2545]">{article.category_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(article.published_at || article.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{estimateReadTime(article.excerpt)}</span>
                    </div>
                    <h2 className="text-xl font-serif font-bold text-[#14181F] leading-snug">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/article/${article.slug}`)}
                        className="text-left hover:text-[#0B2545] transition-colors cursor-pointer"
                      >
                        {article.title}
                      </button>
                    </h2>
                    <p className="text-sm text-[#525866] line-clamp-3 leading-relaxed">{article.excerpt}</p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-[#525866]">
                    <span>{article.author_name}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/article/${article.slug}`)}
                      className="font-semibold text-[#0B2545] inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      Read
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-stone-200">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 text-xs font-semibold border border-stone-300 rounded-md bg-white text-[#14181F] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-mono text-[#525866] tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 text-xs font-semibold border border-stone-300 rounded-md bg-white text-[#14181F] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
