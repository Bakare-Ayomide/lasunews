import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Share2, Check, Megaphone, ArrowRight, MessageSquare } from 'lucide-react';
import { apiRequest, formatDate, formatDateTime, estimateReadTime, isRichHtml, sanitizeHtmlForRender } from '../lib/api.ts';
import { ArticleMedia } from '../components/ArticleMedia.tsx';
import { AdSlot } from '../components/AdSlot.tsx';
import type { Advertisement, Article, CommentItem, PublicUser } from '../types.ts';

interface ArticleDetailPageProps {
  slug: string;
  currentUser: PublicUser | null;
  onNavigate: (path: string) => void;
}

export function ArticleDetailPage({ slug, currentUser, onNavigate }: ArticleDetailPageProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [related, setRelated] = useState<Article[]>([]);
  const [sidebarAds, setSidebarAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Comment form state
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    const fetchArticle = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<{
          article: Article;
          comments: CommentItem[];
          related: Article[];
          sidebarAds: Advertisement[];
        }>(`/api/public/articles/${encodeURIComponent(slug)}`);
        if (!active) return;
        setArticle(data.article);
        setComments(data.comments || []);
        setRelated(data.related || []);
        setSidebarAds(data.sidebarAds || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Article could not be found.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchArticle();
    return () => {
      active = false;
    };
  }, [slug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCommentFeedback(null);
    setCommentSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; status: string }>(
        `/api/public/articles/${encodeURIComponent(slug)}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({
            author_name: currentUser ? currentUser.full_name : authorName,
            author_email: currentUser ? currentUser.email : authorEmail,
            content: commentBody,
          }),
        }
      );
      setCommentFeedback({ type: 'success', text: res.message });
      setCommentBody('');
      if (res.status === 'approved') {
        const refreshed = await apiRequest<{ comments: CommentItem[] }>(
          `/api/public/articles/${encodeURIComponent(slug)}`
        );
        setComments(refreshed.comments || []);
      }
    } catch (err) {
      setCommentFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to post comment.',
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
        <div className="h-8 w-40 bg-stone-200 animate-pulse" />
        <div className="h-14 w-full bg-stone-200 animate-pulse" />
        <div className="h-80 w-full bg-stone-200 animate-pulse" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
        <h1 className="text-3xl font-serif font-bold text-[#14181F]">Dispatch Unavailable</h1>
        <p className="text-sm text-[#525866]">{error || 'This broadcast does not exist or is currently in draft.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('/news')}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to News Archive
        </button>
      </div>
    );
  }

  const rawContent = article.content || '';
  const richHtmlMode = isRichHtml(rawContent);
  const sanitizedRichHtml = richHtmlMode ? sanitizeHtmlForRender(rawContent) : '';
  const paragraphs = richHtmlMode
    ? []
    : rawContent
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

  const shareUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const shareText = encodeURIComponent(article.title);

  return (
    <article className="bg-white border-b border-stone-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => onNavigate('/news')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#525866] hover:text-[#0B2545] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campus News
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main 8-col Reading Column */}
          <div className="lg:col-span-8">
            <header className="space-y-4 pb-8 border-b border-stone-300">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866]">
                <button
                  type="button"
                  onClick={() => onNavigate(`/news?category=${encodeURIComponent(article.category_slug)}`)}
                  className="font-bold uppercase tracking-wider text-white px-2.5 py-0.5 cursor-pointer"
                  style={{ backgroundColor: article.category_color || '#0B2545' }}
                >
                  {article.category_name}
                </button>
                {article.is_announcement === 1 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                    <Megaphone className="w-3.5 h-3.5" />
                    {article.announcement_priority === 'urgent' ? 'Urgent Announcement' : 'Official Announcement'}
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span>{formatDate(article.published_at || article.created_at)}</span>
                <span aria-hidden="true">·</span>
                <span>{estimateReadTime(article.content)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{article.views} reads</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#14181F] leading-[1.15]">
                {article.title}
              </h1>

              <p className="text-lg text-[#525866] leading-relaxed font-normal">{article.excerpt}</p>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm font-medium text-[#14181F]">
                  By <span className="font-semibold">{article.author_name}</span> · LASU Editorial Desk
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-300 text-[#14181F] hover:bg-stone-50 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Share2 className="w-3.5 h-3.5" />}
                    {copied ? 'Link Copied' : 'Copy Link'}
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold border border-stone-300 text-[#14181F] hover:bg-stone-50"
                  >
                    Share on X
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold border border-stone-300 text-[#14181F] hover:bg-stone-50"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </header>

            {article.featured_image && (
              <figure className="my-8">
                <div className="aspect-[16/9] overflow-hidden border border-stone-300 bg-[#EBE6DF]">
                  <ArticleMedia
                    src={article.featured_image}
                    alt={article.title}
                    fallbackLabel={article.title}
                  />
                </div>
                <figcaption className="mt-2 text-xs text-[#525866] italic">
                  LASU Campus Broadcast Archive — {article.category_name}
                </figcaption>
              </figure>
            )}

            {richHtmlMode ? (
              <div
                className="article-prose py-6 text-base sm:text-[17px] text-[#14181F] leading-[1.8]"
                dangerouslySetInnerHTML={{ __html: sanitizedRichHtml }}
              />
            ) : (
              <div className="py-6 space-y-6 text-base sm:text-[17px] text-[#14181F] leading-[1.8]">
                {paragraphs.map((para, idx) => (
                  <p
                    key={idx}
                    className={
                      idx === 0
                        ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:text-[#0B2545] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none'
                        : ''
                    }
                  >
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Comments & Moderation Section */}
            <section className="mt-10 pt-8 border-t border-stone-300 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-[#14181F] flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#0B2545]" />
                  Campus Discussion ({comments.length})
                </h2>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={() => onNavigate('/account')}
                    className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
                  >
                    Sign in to Reader Account →
                  </button>
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className="border border-stone-300 bg-[#FAF9F6] p-5 space-y-4">
                {currentUser ? (
                  <p className="text-xs font-medium text-[#14181F]">
                    Commenting as <strong>{currentUser.full_name}</strong> ({currentUser.email})
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="c-name" className="block text-xs font-semibold mb-1">
                        Your Name
                      </label>
                      <input
                        id="c-name"
                        type="text"
                        required
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-2 text-sm border border-stone-300 bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="c-email" className="block text-xs font-semibold mb-1">
                        Email Address
                      </label>
                      <input
                        id="c-email"
                        type="email"
                        required
                        value={authorEmail}
                        onChange={(e) => setAuthorEmail(e.target.value)}
                        placeholder="name@lasu.edu.ng"
                        className="w-full px-3 py-2 text-sm border border-stone-300 bg-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="c-body" className="block text-xs font-semibold mb-1">
                    Comment
                  </label>
                  <textarea
                    id="c-body"
                    rows={3}
                    required
                    minLength={3}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Share a constructive response (subject to editorial moderation)..."
                    className="w-full px-3 py-2 text-sm border border-stone-300 bg-white"
                  />
                </div>

                {commentFeedback && (
                  <div
                    className={`p-3 text-xs border ${
                      commentFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-red-50 text-red-900 border-red-200'
                    }`}
                  >
                    {commentFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={commentSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] cursor-pointer"
                >
                  {commentSubmitting ? 'Submitting...' : 'Post Comment'}
                </button>
              </form>

              {comments.length === 0 ? (
                <p className="text-sm text-[#525866]">
                  No approved comments yet. Be the first member of the LASU community to respond.
                </p>
              ) : (
                <div className="divide-y divide-stone-200 border border-stone-200 bg-white">
                  {comments.map((c) => (
                    <div key={c.id} className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#14181F]">{c.author_name}</span>
                        {c.department && (
                          <>
                            <span className="text-[#525866]">·</span>
                            <span className="text-[#525866]">{c.department}</span>
                          </>
                        )}
                        <span className="text-[#525866]">·</span>
                        <span className="font-mono text-[#525866]">{formatDateTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-[#14181F] leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right 4-col Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <AdSlot ads={sidebarAds} placement="sidebar_box" />

            {related.length > 0 && (
              <div className="border border-stone-300 bg-[#FAF9F6] p-5 space-y-4">
                <h3 className="text-base font-serif font-bold text-[#14181F] border-b border-stone-300 pb-2">
                  Related Campus Stories
                </h3>
                <div className="divide-y divide-stone-200">
                  {related.map((item) => (
                    <article key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: item.category_color || '#0B2545' }}
                      >
                        {item.category_name}
                      </span>
                      <h4 className="text-sm font-serif font-bold text-[#14181F] leading-snug">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/article/${item.slug}`)}
                          className="text-left hover:text-[#0B2545] cursor-pointer"
                        >
                          {item.title}
                        </button>
                      </h4>
                      <button
                        type="button"
                        onClick={() => onNavigate(`/article/${item.slug}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
                      >
                        Read <ArrowRight className="w-3 h-3" />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </article>
  );
}
