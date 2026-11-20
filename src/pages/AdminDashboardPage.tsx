import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  MessageSquare,
  Megaphone,
  UserCheck,
  Users,
  Activity,
  Inbox,
  BarChart3,
  Globe,
  RefreshCw,
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  LogOut,
  ExternalLink,
  X,
  Check,
  Menu,
} from 'lucide-react';
import { apiRequest, formatDateTime, formatDate } from '../lib/api.ts';
import { ArticleMedia } from '../components/ArticleMedia.tsx';
import type {
  ActivityLog,
  AdminAnalyticsData,
  AdminOverviewData,
  AdminUser,
  Advertisement,
  Article,
  ArticlePerformanceItem,
  Category,
  CommentItem,
  ContactMessage,
  ExternalHeadlineItem,
  ExternalSourcesResponse,
  PublicUser,
} from '../types.ts';

type AdminTab =
  | 'overview'
  | 'articles'
  | 'analytics'
  | 'sources'
  | 'categories'
  | 'comments'
  | 'ads'
  | 'users'
  | 'admins'
  | 'activity'
  | 'messages';

interface AdminDashboardPageProps {
  admin: AdminUser;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onDataMutated: () => void;
}

export function AdminDashboardPage({
  admin,
  onLogout,
  onNavigate,
  onDataMutated,
}: AdminDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Overview
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Articles
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleStatusFilter, setArticleStatusFilter] = useState('all');
  const [articleCategoryFilter, setArticleCategoryFilter] = useState('all');
  const [articleTypeFilter, setArticleTypeFilter] = useState('all');

  // Article Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('published');
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsBreaking, setFormIsBreaking] = useState(false);
  const [formIsAnnouncement, setFormIsAnnouncement] = useState(false);
  const [formPriority, setFormPriority] = useState<'normal' | 'urgent'>('normal');
  const [formImage, setFormImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('#0B2545');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  // News Analytics & Performance
  const [analyticsData, setAnalyticsData] = useState<AdminAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState('all');
  const [analyticsSort, setAnalyticsSort] = useState<'views_desc' | 'views_asc' | 'comments_desc' | 'newest'>('views_desc');

  // Multi-Source News Wire
  const [sourcesData, setSourcesData] = useState<ExternalSourcesResponse | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selectedSourceKey, setSelectedSourceKey] = useState('all');
  const [sourceSearch, setSourceSearch] = useState('');
  const [customFeedUrl, setCustomFeedUrl] = useState('');
  const [quickPublishingId, setQuickPublishingId] = useState<string | null>(null);

  // Comments Moderation
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentFilter, setCommentFilter] = useState('all');

  // Advertisements
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [adTitle, setAdTitle] = useState('');
  const [adAdvertiser, setAdAdvertiser] = useState('');
  const [adTargetUrl, setAdTargetUrl] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adPlacement, setAdPlacement] = useState<'top_banner' | 'sidebar_box' | 'inline_banner'>('sidebar_box');
  const [adStatus, setAdStatus] = useState<'active' | 'paused'>('active');
  const [savingAd, setSavingAd] = useState(false);

  // Public Users (Full CRUD)
  const [usersList, setUsersList] = useState<PublicUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [editingReader, setEditingReader] = useState<PublicUser | null>(null);
  const [readerName, setReaderName] = useState('');
  const [readerEmail, setReaderEmail] = useState('');
  const [readerDept, setReaderDept] = useState('');
  const [readerPassword, setReaderPassword] = useState('');
  const [readerActive, setReaderActive] = useState(true);
  const [savingReader, setSavingReader] = useState(false);

  // Admins
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'editor' | 'super_admin'>('editor');
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminRole, setEditAdminRole] = useState<'editor' | 'super_admin'>('editor');
  const [editAdminActive, setEditAdminActive] = useState(true);
  const [editAdminPassword, setEditAdminPassword] = useState('');

  // Activity & Messages
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const data = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setOverview(data);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load dashboard overview.');
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const data = await apiRequest<{ categories: Category[] }>('/api/admin/categories');
      setCategories(data.categories || []);
      if (data.categories?.length > 0 && formCategoryId === 0) {
        setFormCategoryId(data.categories[0].id);
      }
    } catch (err) {
      // Fallback to public categories endpoint so the category dropdown is never empty
      try {
        const pub = await apiRequest<{ categories: Category[] }>('/api/public/categories');
        setCategories(pub.categories || []);
        if (pub.categories?.length > 0 && formCategoryId === 0) {
          setFormCategoryId(pub.categories[0].id);
        }
      } catch {
        showFeedback('error', err instanceof Error ? err.message : 'Failed to load categories.');
      }
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadArticles = async () => {
    setArticlesLoading(true);
    try {
      const params = new URLSearchParams();
      if (articleSearch.trim()) params.set('q', articleSearch.trim());
      if (articleStatusFilter !== 'all') params.set('status', articleStatusFilter);
      if (articleCategoryFilter !== 'all') params.set('category_id', articleCategoryFilter);
      if (articleTypeFilter !== 'all') params.set('type', articleTypeFilter);
      const data = await apiRequest<{ articles: Article[] }>(`/api/admin/articles?${params.toString()}`);
      setArticles(data.articles);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load articles.');
    } finally {
      setArticlesLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const data = await apiRequest<{ comments: CommentItem[] }>(
        `/api/admin/comments?status=${encodeURIComponent(commentFilter)}`
      );
      setComments(data.comments);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load comments.');
    }
  };

  const loadAds = async () => {
    try {
      const data = await apiRequest<{ ads: Advertisement[] }>('/api/admin/ads');
      setAds(data.ads);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load advertisements.');
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await apiRequest<AdminAnalyticsData>('/api/admin/analytics');
      setAnalyticsData(data);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load news analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadSources = async (opts?: { source?: string; q?: string; customUrl?: string }) => {
    setSourcesLoading(true);
    try {
      const params = new URLSearchParams();
      const src = opts?.source ?? selectedSourceKey;
      const q = opts?.q ?? sourceSearch;
      const custom = opts?.customUrl ?? customFeedUrl;
      if (src && src !== 'all') params.set('source', src);
      if (q.trim()) params.set('q', q.trim());
      if (custom.trim()) params.set('custom_url', custom.trim());
      const data = await apiRequest<ExternalSourcesResponse>(`/api/admin/sources?${params.toString()}`);
      setSourcesData(data);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to fetch multi-source headlines.');
    } finally {
      setSourcesLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.set('q', userSearch.trim());
      if (userStatusFilter !== 'all') params.set('status', userStatusFilter);
      const qs = params.toString();
      const data = await apiRequest<{ users: PublicUser[] }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
      setUsersList(data.users);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load user accounts.');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const data = await apiRequest<{ admins: AdminUser[] }>('/api/admin/admins');
      setAdminsList(data.admins);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load administrators.');
    }
  };

  const loadActivity = async () => {
    try {
      const data = await apiRequest<{ logs: ActivityLog[] }>('/api/admin/activity');
      setLogs(data.logs);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load activity log.');
    }
  };

  const loadMessages = async () => {
    try {
      const data = await apiRequest<{ messages: ContactMessage[] }>('/api/admin/messages');
      setMessages(data.messages);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to load inquiries.');
    }
  };

  useEffect(() => {
    loadOverview();
    loadCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === formCategoryId)) {
      setFormCategoryId(categories[0].id);
    }
  }, [categories, formCategoryId]);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'articles') loadArticles();
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'sources' && !sourcesData) loadSources();
    if (activeTab === 'categories') loadCategories();
    if (activeTab === 'comments') loadComments();
    if (activeTab === 'ads') loadAds();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'admins') loadAdmins();
    if (activeTab === 'activity') loadActivity();
    if (activeTab === 'messages') loadMessages();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'articles') loadArticles();
  }, [articleSearch, articleStatusFilter, articleCategoryFilter, articleTypeFilter]);

  useEffect(() => {
    if (activeTab === 'comments') loadComments();
  }, [commentFilter]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
  }, [userSearch, userStatusFilter]);

  const openCreateEditor = (asAnnouncement = false) => {
    if (categories.length === 0) {
      void loadCategories();
    }
    setEditingArticle(null);
    setFormTitle('');
    setFormExcerpt('');
    setFormContent('');
    setFormCategoryId(
      asAnnouncement
        ? categories.find((c) => c.slug === 'announcements')?.id || categories[0]?.id || 1
        : categories[0]?.id || 1
    );
    setFormStatus('published');
    setFormIsFeatured(false);
    setFormIsBreaking(false);
    setFormIsAnnouncement(asAnnouncement);
    setFormPriority('normal');
    setFormImage('');
    setEditorOpen(true);
  };

  const openEditEditor = (article: Article) => {
    if (categories.length === 0) {
      void loadCategories();
    }
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormExcerpt(article.excerpt);
    setFormContent(article.content || '');
    setFormCategoryId(article.category_id);
    setFormStatus(article.status || 'draft');
    setFormIsFeatured(article.is_featured === 1);
    setFormIsBreaking(article.is_breaking === 1);
    setFormIsAnnouncement(article.is_announcement === 1);
    setFormPriority(article.announcement_priority || 'normal');
    setFormImage(article.featured_image || '');
    setEditorOpen(true);
  };

  const openEditFromAnalytics = async (item: ArticlePerformanceItem) => {
    const existing = articles.find((a) => a.id === item.id);
    if (existing) {
      openEditEditor(existing);
      return;
    }
    try {
      const data = await apiRequest<{ articles: Article[] }>('/api/admin/articles');
      setArticles(data.articles);
      const found = data.articles.find((a) => a.id === item.id);
      if (found) {
        openEditEditor(found);
      } else {
        showFeedback('error', 'Article record not found.');
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to open article editor.');
    }
  };

  const importSourceToEditor = (item: ExternalHeadlineItem) => {
    if (categories.length === 0) {
      void loadCategories();
    }
    const matchedCat =
      categories.find((c) => c.slug === item.suggested_category_slug) ||
      categories.find((c) => c.slug === 'university-news') ||
      categories[0];

    const summaryText =
      item.summary && item.summary.trim().length >= 10
        ? item.summary.trim().slice(0, 480)
        : `${item.title.trim()} — Reported via ${item.source_name}.`.slice(0, 480);

    const bodyText =
      item.content && item.content.trim().length >= 20
        ? `${item.content.trim()}\n\nSource Dispatch: ${item.source_name}${item.url ? ` (${item.url})` : ''}`
        : `${summaryText}\n\nFull coverage syndicated via ${item.source_name}: ${item.url}`;

    setEditingArticle(null);
    setFormTitle(item.title.slice(0, 215));
    setFormExcerpt(summaryText);
    setFormContent(bodyText);
    setFormCategoryId(matchedCat?.id || 1);
    setFormStatus('published');
    setFormIsFeatured(false);
    setFormIsBreaking(false);
    setFormIsAnnouncement(false);
    setFormPriority('normal');
    setFormImage(item.image_url || '');
    setEditorOpen(true);
  };

  const handleQuickPublishSource = async (item: ExternalHeadlineItem) => {
    setQuickPublishingId(item.id);
    try {
      let availableCategories = categories;
      if (availableCategories.length === 0) {
        const catRes = await apiRequest<{ categories: Category[] }>('/api/admin/categories');
        availableCategories = catRes.categories;
        setCategories(availableCategories);
      }

      const matchedCat =
        availableCategories.find((c) => c.slug === item.suggested_category_slug) ||
        availableCategories.find((c) => c.slug === 'university-news') ||
        availableCategories[0];

      if (!matchedCat) {
        throw new Error('No news categories are available.');
      }

      const title = item.title.trim().slice(0, 215);
      const excerpt = (
        item.summary && item.summary.trim().length >= 10
          ? item.summary.trim()
          : `${title} — Dispatched via ${item.source_name}.`
      ).slice(0, 480);
      const rawBody =
        item.content && item.content.trim().length >= 20
          ? item.content.trim()
          : `${excerpt}\n\nRead original coverage from ${item.source_name}.`;
      const content = `${rawBody}\n\nSource Attribution: ${item.source_name}${item.url ? ` (${item.url})` : ''}`;

      await apiRequest('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: title.length >= 5 ? title : `${title} Update`,
          excerpt: excerpt.length >= 10 ? excerpt : `${excerpt} Campus broadcast update.`,
          content: content.length >= 20 ? content : `${content} Published to LASU Campus Broadcast.`,
          featured_image: item.image_url || '',
          category_id: matchedCat.id,
          status: 'published',
          is_featured: false,
          is_breaking: false,
          is_announcement: false,
          announcement_priority: 'normal',
        }),
      });

      showFeedback('success', `Published "${title}" into ${matchedCat.name}.`);
      await Promise.all([loadOverview(), loadCategories()]);
      if (analyticsData) {
        void loadAnalytics();
      }
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Quick publish failed.');
    } finally {
      setQuickPublishingId(null);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, target: 'article' | 'ad') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await apiRequest<{ url: string }>('/api/admin/upload', {
        method: 'POST',
        body,
      });
      if (target === 'article') {
        setFormImage(res.url);
      } else {
        setAdImageUrl(res.url);
      }
      showFeedback('success', 'Image uploaded successfully.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSaveArticle = async (e: FormEvent) => {
    e.preventDefault();
    setSavingArticle(true);
    try {
      const payload = {
        title: formTitle,
        excerpt: formExcerpt,
        content: formContent,
        featured_image: formImage,
        category_id: formCategoryId,
        status: formStatus,
        is_featured: formIsFeatured,
        is_breaking: formIsBreaking,
        is_announcement: formIsAnnouncement,
        announcement_priority: formPriority,
      };

      if (editingArticle) {
        await apiRequest(`/api/admin/articles/${editingArticle.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showFeedback('success', 'Article updated successfully.');
      } else {
        await apiRequest('/api/admin/articles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showFeedback('success', formStatus === 'published' ? 'Broadcast published.' : 'Draft saved.');
      }

      setEditorOpen(false);
      await Promise.all([loadArticles(), loadOverview(), loadCategories()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save article.');
    } finally {
      setSavingArticle(false);
    }
  };

  const handleDeleteArticle = async (article: Article) => {
    try {
      await apiRequest(`/api/admin/articles/${article.id}`, { method: 'DELETE' });
      showFeedback('success', `Deleted "${article.title}".`);
      await Promise.all([loadArticles(), loadOverview(), loadCategories()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to delete article.');
    }
  };

  const handleQuickStatusToggle = async (article: Article) => {
    const nextStatus = article.status === 'published' ? 'draft' : 'published';
    try {
      await apiRequest(`/api/admin/articles/${article.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: article.title,
          excerpt: article.excerpt,
          content: article.content || article.excerpt,
          featured_image: article.featured_image,
          category_id: article.category_id,
          status: nextStatus,
          is_featured: article.is_featured === 1,
          is_breaking: article.is_breaking === 1,
          is_announcement: article.is_announcement === 1,
          announcement_priority: article.announcement_priority,
        }),
      });
      showFeedback('success', `Article marked as ${nextStatus}.`);
      await Promise.all([loadArticles(), loadOverview()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    setSavingCat(true);
    try {
      if (editingCat) {
        await apiRequest(`/api/admin/categories/${editingCat.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: catName, description: catDesc, color_hex: catColor }),
        });
        showFeedback('success', 'Category updated.');
      } else {
        await apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name: catName, description: catDesc, color_hex: catColor }),
        });
        showFeedback('success', 'Category created.');
      }
      setCatName('');
      setCatDesc('');
      setCatColor('#0B2545');
      setEditingCat(null);
      await loadCategories();
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save category.');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await apiRequest(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
      showFeedback('success', `Removed category "${cat.name}".`);
      await loadCategories();
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Cannot delete category.');
    }
  };

  const handleModerateComment = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`/api/admin/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showFeedback('success', `Comment ${status}.`);
      await Promise.all([loadComments(), loadOverview()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Moderation failed.');
    }
  };

  const handleDeleteComment = async (id: number) => {
    try {
      await apiRequest(`/api/admin/comments/${id}`, { method: 'DELETE' });
      showFeedback('success', 'Comment deleted.');
      await Promise.all([loadComments(), loadOverview()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleSaveAd = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAd(true);
    try {
      const payload = {
        title: adTitle,
        advertiser_name: adAdvertiser,
        image_url: adImageUrl,
        target_url: adTargetUrl,
        placement: adPlacement,
        status: adStatus,
      };
      if (editingAd) {
        await apiRequest(`/api/admin/ads/${editingAd.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showFeedback('success', 'Advertisement updated.');
      } else {
        await apiRequest('/api/admin/ads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showFeedback('success', 'Advertisement created.');
      }
      setEditingAd(null);
      setAdTitle('');
      setAdAdvertiser('');
      setAdTargetUrl('');
      setAdImageUrl('');
      setAdPlacement('sidebar_box');
      setAdStatus('active');
      await Promise.all([loadAds(), loadOverview()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save advertisement.');
    } finally {
      setSavingAd(false);
    }
  };

  const handleDeleteAd = async (ad: Advertisement) => {
    try {
      await apiRequest(`/api/admin/ads/${ad.id}`, { method: 'DELETE' });
      showFeedback('success', `Removed ad "${ad.title}".`);
      await Promise.all([loadAds(), loadOverview()]);
      onDataMutated();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to delete advertisement.');
    }
  };

  const resetReaderForm = () => {
    setEditingReader(null);
    setReaderName('');
    setReaderEmail('');
    setReaderDept('');
    setReaderPassword('');
    setReaderActive(true);
  };

  const startEditReader = (user: PublicUser) => {
    setEditingReader(user);
    setReaderName(user.full_name);
    setReaderEmail(user.email);
    setReaderDept(user.department || '');
    setReaderPassword('');
    setReaderActive(Boolean(user.is_active));
  };

  const handleSaveReader = async (e: FormEvent) => {
    e.preventDefault();
    setSavingReader(true);
    try {
      if (editingReader) {
        await apiRequest(`/api/admin/users/${editingReader.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: readerName,
            email: readerEmail,
            department: readerDept,
            password: readerPassword || undefined,
            is_active: readerActive,
          }),
        });
        showFeedback('success', `Updated reader account ${readerEmail}.`);
      } else {
        await apiRequest('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: readerName,
            email: readerEmail,
            department: readerDept,
            password: readerPassword,
            is_active: readerActive,
          }),
        });
        showFeedback('success', `Created reader account ${readerEmail}.`);
      }
      resetReaderForm();
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to save reader account.');
    } finally {
      setSavingReader(false);
    }
  };

  const handleToggleUserActive = async (user: PublicUser) => {
    try {
      await apiRequest(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: user.is_active ? 0 : 1 }),
      });
      showFeedback('success', `Updated reader account ${user.email}.`);
      await loadUsers();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to update user.');
    }
  };

  const handleDeleteUser = async (user: PublicUser) => {
    try {
      await apiRequest(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (editingReader?.id === user.id) {
        resetReaderForm();
      }
      showFeedback('success', `Removed user ${user.email}.`);
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to delete user.');
    }
  };

  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      await apiRequest('/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword,
          role: newAdminRole,
        }),
      });
      showFeedback('success', `Administrator account created for ${newAdminEmail}.`);
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminRole('editor');
      await loadAdmins();
      await loadOverview();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to create administrator.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleUpdateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSavingAdmin(true);
    try {
      await apiRequest(`/api/admin/admins/${editingAdmin.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: editAdminName,
          role: editAdminRole,
          is_active: editAdminActive,
          password: editAdminPassword || undefined,
        }),
      });
      showFeedback('success', `Updated ${editingAdmin.email}.`);
      setEditingAdmin(null);
      setEditAdminPassword('');
      await loadAdmins();
      await loadOverview();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update administrator.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (target: AdminUser) => {
    try {
      await apiRequest(`/api/admin/admins/${target.id}`, { method: 'DELETE' });
      showFeedback('success', `Removed administrator ${target.email}.`);
      await loadAdmins();
      await loadOverview();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to delete administrator.');
    }
  };

  const handleToggleMessageRead = async (msg: ContactMessage) => {
    try {
      await apiRequest(`/api/admin/messages/${msg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: msg.is_read ? 0 : 1 }),
      });
      await loadMessages();
      await loadOverview();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update message.');
    }
  };

  const filteredAnalyticsArticles = useMemo(() => {
    if (!analyticsData) return [];
    const q = analyticsSearch.trim().toLowerCase();
    const list = analyticsData.articlePerformance.filter((item) => {
      if (analyticsCategoryFilter !== 'all' && String(item.category_id) !== analyticsCategoryFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.title} ${item.author_name} ${item.category_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (analyticsSort === 'views_asc') return a.views - b.views;
      if (analyticsSort === 'comments_desc') return b.total_comments - a.total_comments || b.views - a.views;
      if (analyticsSort === 'newest') {
        return String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at));
      }
      return b.views - a.views;
    });
  }, [analyticsData, analyticsSearch, analyticsCategoryFilter, analyticsSort]);

  const navLinks: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'articles', label: 'News & Bulletins', icon: FileText },
    { id: 'analytics', label: 'Performance & Stats', icon: BarChart3 },
    { id: 'sources', label: 'News Wire & Sources', icon: Globe },
    { id: 'categories', label: 'Categories', icon: FolderKanban },
    { id: 'comments', label: 'Comments & Moderation', icon: MessageSquare, badge: overview?.stats.pending_comments },
    { id: 'ads', label: 'Advertisements', icon: Megaphone },
    { id: 'users', label: 'Reader Accounts', icon: UserCheck },
    { id: 'admins', label: 'Administrators', icon: Users },
    { id: 'activity', label: 'Publishing Activity', icon: Activity },
    { id: 'messages', label: 'Press Inquiries', icon: Inbox, badge: overview?.stats.unread_messages },
  ];

  const tabTitle = navLinks.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-[#0B2545] text-stone-200 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/15">
            <div className="bg-white px-2.5 py-1 rounded">
              <img
                src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png"
                alt="LASU Editorial"
                className="h-7 w-auto object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-stone-300 hover:text-white cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-1" aria-label="Admin Navigation">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-stone-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="font-mono text-xs bg-[#B91C1C] text-white px-1.5 py-0.5 rounded tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/15 space-y-3">
          <div className="px-2">
            <p className="text-xs font-semibold text-white truncate">{admin.full_name}</p>
            <p className="text-xs text-stone-400 truncate">{admin.email}</p>
            <p className="text-[11px] text-[#E5C158] mt-0.5 uppercase tracking-wider">
              {admin.role === 'super_admin' ? 'Super Admin' : 'Editor'}
            </p>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-200 hover:bg-white/10 rounded-md cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Public Portal
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-200 hover:bg-white/10 rounded-md cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-stone-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md border border-stone-200 text-[#14181F] cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm text-[#525866] truncate">
              <span>LASU Broadcast Admin</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#14181F]">{tabTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openCreateEditor(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] border border-stone-300 rounded-md hover:bg-stone-50 whitespace-nowrap cursor-pointer"
            >
              Post Announcement
            </button>
            <button
              type="button"
              onClick={() => openCreateEditor(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Article
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {feedback && (
            <div
              className={`p-3.5 rounded-md text-xs font-medium flex items-center justify-between gap-3 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              <span>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-current opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { label: 'Published', value: overview?.stats.published_articles ?? 0 },
                  { label: 'Drafts', value: overview?.stats.draft_articles ?? 0 },
                  { label: 'Breaking', value: overview?.stats.breaking_articles ?? 0 },
                  { label: 'Pending Comments', value: overview?.stats.pending_comments ?? 0 },
                  { label: 'Active Ads', value: overview?.stats.active_ads ?? 0 },
                  { label: 'Reader Accounts', value: overview?.stats.total_users ?? 0 },
                  { label: 'Total Reads', value: overview?.stats.total_views ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white border border-stone-200 rounded-md p-4">
                    <p className="text-xs text-[#525866]">{stat.label}</p>
                    <p className="mt-1.5 text-2xl font-serif font-bold text-[#14181F] tabular-nums">
                      {overviewLoading ? '—' : stat.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-stone-200 rounded-md">
                  <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                    <h2 className="text-base font-serif font-bold text-[#14181F]">Recent News &amp; Drafts</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('articles')}
                      className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
                    >
                      Manage All
                    </button>
                  </div>

                  {!overview || overview.recentArticles.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <p className="text-sm font-medium text-[#14181F]">No articles in database</p>
                      <p className="text-xs text-[#525866]">
                        Create your first campus dispatch or official announcement to populate the public portal.
                      </p>
                      <button
                        type="button"
                        onClick={() => openCreateEditor(false)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                      >
                        Compose First Article
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-stone-200 text-[#525866] bg-[#FAF9F6]">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold">Headline</th>
                            <th className="py-2.5 px-4 font-semibold">Category</th>
                            <th className="py-2.5 px-4 font-semibold">Status</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Reads</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {overview.recentArticles.map((art) => (
                            <tr key={art.id} className="hover:bg-[#FAF9F6]">
                              <td className="py-3 px-4 font-medium text-[#14181F] max-w-[260px] truncate">
                                {art.title}
                              </td>
                              <td className="py-3 px-4 text-[#525866]">{art.category_name}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`font-semibold ${
                                    art.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {art.status === 'published' ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525866]">
                                {art.views}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-stone-200 rounded-md">
                  <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                    <h2 className="text-base font-serif font-bold text-[#14181F]">Recent Activity</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('activity')}
                      className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
                    >
                      View Log
                    </button>
                  </div>
                  {!overview || overview.recentActivity.length === 0 ? (
                    <div className="p-6 text-xs text-[#525866]">No activity recorded yet.</div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {overview.recentActivity.slice(0, 7).map((log) => (
                        <li key={log.id} className="px-5 py-3 text-xs space-y-1">
                          <p className="text-[#14181F] font-medium">{log.details}</p>
                          <p className="text-[#525866] font-mono tabular-nums">
                            {log.admin_name} · {formatDateTime(log.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ARTICLES TAB */}
          {activeTab === 'articles' && (
            <div className="space-y-4">
              <div className="bg-white border border-stone-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5 relative">
                  <Search className="w-4 h-4 text-[#525866] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Search articles by title or text..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6] focus:border-[#0B2545] focus:outline-none"
                  />
                </div>
                <div className="lg:col-span-2">
                  <select
                    aria-label="Filter by status"
                    value={articleStatusFilter}
                    onChange={(e) => setArticleStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts</option>
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <select
                    aria-label="Filter by category"
                    value={articleCategoryFilter}
                    onChange={(e) => setArticleCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <select
                    aria-label="Filter by type"
                    value={articleTypeFilter}
                    onChange={(e) => setArticleTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                  >
                    <option value="all">All Types</option>
                    <option value="breaking">Breaking Ticker</option>
                    <option value="featured">Featured Only</option>
                    <option value="announcement">Announcements</option>
                    <option value="news">Standard News</option>
                  </select>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
                {articlesLoading ? (
                  <div className="p-8 text-center text-xs text-[#525866]">Loading newsroom records...</div>
                ) : articles.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-sm font-semibold text-[#14181F]">No articles match your filters</p>
                    <p className="text-xs text-[#525866]">
                      Compose a new campus broadcast or reset your filter controls.
                    </p>
                    <button
                      type="button"
                      onClick={() => openCreateEditor(false)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                    >
                      Create New Article
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Article</th>
                          <th className="py-3 px-4 font-semibold">Category</th>
                          <th className="py-3 px-4 font-semibold">Placement</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Reads</th>
                          <th className="py-3 px-4 font-semibold">Date</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {articles.map((art) => (
                          <tr key={art.id} className="hover:bg-[#FAF9F6]">
                            <td className="py-3 px-4 max-w-[300px]">
                              <p className="font-semibold text-[#14181F] truncate">{art.title}</p>
                              <p className="text-[#525866] truncate">{art.author_name}</p>
                            </td>
                            <td className="py-3 px-4 text-[#525866] whitespace-nowrap">{art.category_name}</td>
                            <td className="py-3 px-4 text-[#525866] whitespace-nowrap">
                              {[
                                art.is_breaking === 1 ? 'Breaking' : null,
                                art.is_featured === 1 ? 'Featured' : null,
                                art.is_announcement === 1
                                  ? art.announcement_priority === 'urgent'
                                    ? 'Urgent Notice'
                                    : 'Announcement'
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Standard'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleQuickStatusToggle(art)}
                                className={`font-semibold hover:underline cursor-pointer ${
                                  art.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {art.status === 'published' ? 'Published' : 'Draft'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525866]">
                              {art.views}
                            </td>
                            <td className="py-3 px-4 text-[#525866] whitespace-nowrap font-mono tabular-nums">
                              {formatDate(art.published_at || art.created_at)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditEditor(art)}
                                  className="p-1.5 text-[#0B2545] hover:bg-stone-100 rounded cursor-pointer"
                                  title="Edit article"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteArticle(art)}
                                  className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                  title="Delete article"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PERFORMANCE & ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-serif font-bold text-[#14181F]">
                    Newsroom Performance &amp; Readership Analytics
                  </h2>
                  <p className="text-xs text-[#525866]">
                    Live SQLite engagement metrics across all published dispatches, drafts, desks, comments, and sponsors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadAnalytics}
                  disabled={analyticsLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-white border border-stone-300 rounded-md hover:bg-stone-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  Refresh Metrics
                </button>
              </div>

              {analyticsLoading && !analyticsData ? (
                <div className="bg-white border border-stone-200 rounded-md p-8 text-center text-xs text-[#525866]">
                  Compiling newsroom performance statistics...
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      {
                        label: 'Published / Total',
                        value: `${analyticsData.summary.published_articles} / ${analyticsData.summary.total_articles}`,
                        sub: `${analyticsData.summary.draft_articles} drafts`,
                      },
                      {
                        label: 'Total Readership',
                        value: analyticsData.summary.total_views.toLocaleString(),
                        sub: `${analyticsData.summary.featured_articles} featured · ${analyticsData.summary.breaking_articles} breaking`,
                      },
                      {
                        label: 'Avg Reads / Story',
                        value: Math.round(analyticsData.summary.avg_views_published || 0).toLocaleString(),
                        sub: `${analyticsData.summary.announcement_articles} active circulars`,
                      },
                      {
                        label: 'Top Story Views',
                        value: analyticsData.summary.top_article_views.toLocaleString(),
                        sub: 'Highest performing dispatch',
                      },
                      {
                        label: 'Reader Comments',
                        value: `${analyticsData.summary.approved_comments} / ${analyticsData.summary.total_comments}`,
                        sub: `${analyticsData.summary.pending_comments} awaiting review`,
                      },
                      {
                        label: 'Sponsor CTR',
                        value:
                          analyticsData.summary.total_impressions > 0
                            ? `${((analyticsData.summary.total_clicks / analyticsData.summary.total_impressions) * 100).toFixed(2)}%`
                            : '0.00%',
                        sub: `${analyticsData.summary.total_clicks.toLocaleString()} clicks / ${analyticsData.summary.total_impressions.toLocaleString()} impr.`,
                      },
                    ].map((card) => (
                      <div key={card.label} className="bg-white border border-stone-200 rounded-md p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#525866]">
                          {card.label}
                        </p>
                        <p className="mt-1.5 text-xl font-bold text-[#14181F] tabular-nums">{card.value}</p>
                        <p className="mt-1 text-[11px] text-[#525866]">{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Category Breakdown */}
                  <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                      <h3 className="text-base font-serif font-bold text-[#14181F]">
                        Category Desk Performance
                      </h3>
                      <span className="text-xs font-mono text-[#525866]">
                        {analyticsData.categoryBreakdown.length} desks
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                          <tr>
                            <th className="py-3 px-4 font-semibold">Desk</th>
                            <th className="py-3 px-4 font-semibold text-right">Published</th>
                            <th className="py-3 px-4 font-semibold text-right">Total</th>
                            <th className="py-3 px-4 font-semibold text-right">Total Views</th>
                            <th className="py-3 px-4 font-semibold text-right">Avg Views</th>
                            <th className="py-3 px-4 font-semibold text-right">Comments</th>
                            <th className="py-3 px-4 font-semibold w-44">Readership Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {analyticsData.categoryBreakdown.map((cat) => {
                            const share =
                              analyticsData.summary.total_views > 0
                                ? Math.round((cat.total_views / analyticsData.summary.total_views) * 100)
                                : 0;
                            return (
                              <tr key={cat.id} className="hover:bg-[#FAF9F6]">
                                <td className="py-3 px-4 font-semibold text-[#14181F]">
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 inline-block shrink-0"
                                      style={{ backgroundColor: cat.color_hex || '#0B2545' }}
                                    />
                                    {cat.name}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums">
                                  {cat.published_articles}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525866]">
                                  {cat.total_articles}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                                  {cat.total_views.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525866]">
                                  {cat.avg_views}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525866]">
                                  {cat.comment_count}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${Math.max(share, cat.total_views > 0 ? 4 : 0)}%`,
                                          backgroundColor: cat.color_hex || '#0B2545',
                                        }}
                                      />
                                    </div>
                                    <span className="font-mono tabular-nums text-[11px] text-[#525866] w-9 text-right">
                                      {share}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Full Article Performance Table */}
                  <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-serif font-bold text-[#14181F]">
                          All Articles Performance Leaderboard
                        </h3>
                        <p className="text-xs text-[#525866]">
                          Showing {filteredAnalyticsArticles.length} of {analyticsData.articlePerformance.length} stories
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#525866] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="search"
                            value={analyticsSearch}
                            onChange={(e) => setAnalyticsSearch(e.target.value)}
                            placeholder="Filter stories..."
                            className="pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                          />
                        </div>
                        <select
                          aria-label="Filter analytics by category"
                          value={analyticsCategoryFilter}
                          onChange={(e) => setAnalyticsCategoryFilter(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                        >
                          <option value="all">All Desks</option>
                          {categories.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Sort article performance"
                          value={analyticsSort}
                          onChange={(e) =>
                            setAnalyticsSort(
                              e.target.value as 'views_desc' | 'views_asc' | 'comments_desc' | 'newest'
                            )
                          }
                          className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                        >
                          <option value="views_desc">Most Read</option>
                          <option value="views_asc">Least Read</option>
                          <option value="comments_desc">Most Commented</option>
                          <option value="newest">Newest First</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                          <tr>
                            <th className="py-3 px-4 font-semibold">#</th>
                            <th className="py-3 px-4 font-semibold">Headline &amp; Author</th>
                            <th className="py-3 px-4 font-semibold">Desk</th>
                            <th className="py-3 px-4 font-semibold">Status</th>
                            <th className="py-3 px-4 font-semibold">Placement</th>
                            <th className="py-3 px-4 font-semibold text-right">Views</th>
                            <th className="py-3 px-4 font-semibold text-right">Comments</th>
                            <th className="py-3 px-4 font-semibold">Date</th>
                            <th className="py-3 px-4 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredAnalyticsArticles.map((art, idx) => {
                            const maxViews = Math.max(1, analyticsData.summary.top_article_views || 1);
                            const barPct = Math.round((art.views / maxViews) * 100);
                            const flags = [
                              art.is_breaking ? 'Breaking' : null,
                              art.is_featured ? 'Featured' : null,
                              art.is_announcement ? (art.announcement_priority === 'urgent' ? 'Urgent' : 'Notice') : null,
                            ]
                              .filter(Boolean)
                              .join(' · ');

                            return (
                              <tr key={art.id} className="hover:bg-[#FAF9F6]">
                                <td className="py-3 px-4 font-mono tabular-nums text-[#525866]">{idx + 1}</td>
                                <td className="py-3 px-4 max-w-[280px]">
                                  <p className="font-semibold text-[#14181F] truncate">{art.title}</p>
                                  <p className="text-[11px] text-[#525866] truncate">{art.author_name}</p>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 text-[#525866]">
                                    <span
                                      className="w-2 h-2 inline-block shrink-0"
                                      style={{ backgroundColor: art.category_color || '#0B2545' }}
                                    />
                                    {art.category_name}
                                  </span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span
                                    className={`font-semibold ${
                                      art.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                                    }`}
                                  >
                                    {art.status === 'published' ? 'Published' : 'Draft'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-[#525866]">
                                  {flags || 'Standard'}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-2">
                                    <div className="w-14 h-1.5 bg-stone-100 rounded-full overflow-hidden hidden sm:block">
                                      <div
                                        className="h-full bg-[#0B2545]"
                                        style={{ width: `${Math.max(barPct, art.views > 0 ? 6 : 0)}%` }}
                                      />
                                    </div>
                                    <span className="font-mono font-semibold tabular-nums text-[#14181F]">
                                      {art.views.toLocaleString()}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525866]">
                                  {art.approved_comments}/{art.total_comments}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[#525866]">
                                  {formatDate(art.published_at || art.created_at)}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditFromAnalytics(art)}
                                      className="p-1.5 text-[#0B2545] hover:bg-stone-100 rounded cursor-pointer"
                                      title="Edit article"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {art.status === 'published' && (
                                      <button
                                        type="button"
                                        onClick={() => onNavigate(`/article/${art.slug}`)}
                                        className="p-1.5 text-[#525866] hover:bg-stone-100 rounded cursor-pointer"
                                        title="Open live article"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* MULTI-SOURCE NEWS WIRE TAB */}
          {activeTab === 'sources' && (
            <div className="space-y-5">
              <div className="bg-white border border-stone-200 rounded-md p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-serif font-bold text-[#14181F]">
                      Multi-Source News Wire &amp; Live Headlines
                    </h2>
                    <p className="text-xs text-[#525866]">
                      Monitor live dispatches from LASU Official Newsroom, Nigerian national dailies, BBC Africa, or any custom RSS/Atom feed URL.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSources()}
                    disabled={sourcesLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sourcesLoading ? 'animate-spin' : ''}`} />
                    {sourcesLoading ? 'Fetching Wire...' : 'Refresh Live Wire'}
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadSources();
                  }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3"
                >
                  <div className="md:col-span-3">
                    <select
                      aria-label="Select news source"
                      value={selectedSourceKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSourceKey(val);
                        void loadSources({ source: val });
                      }}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                    >
                      <option value="all">All Live Sources</option>
                      {(sourcesData?.availableSources || [
                        { key: 'lasu', name: 'LASU Official Newsroom' },
                        { key: 'punch', name: 'Punch Nigeria' },
                        { key: 'vanguard', name: 'Vanguard Nigeria' },
                        { key: 'channels', name: 'Channels TV' },
                        { key: 'premiumtimes', name: 'Premium Times' },
                        { key: 'dailypost', name: 'Daily Post Nigeria' },
                        { key: 'bbcafrica', name: 'BBC Africa' },
                      ]).map((src) => (
                        <option key={src.key} value={src.key}>
                          {src.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-4 relative">
                    <Search className="w-3.5 h-3.5 text-[#525866] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      placeholder="Filter headlines by keyword..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="url"
                      value={customFeedUrl}
                      onChange={(e) => setCustomFeedUrl(e.target.value)}
                      placeholder="Optional custom RSS/Atom feed URL..."
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={sourcesLoading}
                      className="w-full px-3 py-2 text-xs font-semibold text-[#0B2545] border border-stone-300 rounded-md hover:bg-stone-50 cursor-pointer"
                    >
                      Fetch Feed
                    </button>
                  </div>
                </form>

                {sourcesData?.sourceStatuses && sourcesData.sourceStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sourcesData.sourceStatuses.map((st) => (
                      <span
                        key={st.key}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border rounded ${
                          st.ok
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                        title={st.error || `${st.count} items`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${st.ok ? 'bg-emerald-600' : 'bg-amber-600'}`}
                        />
                        {st.name}: <span className="font-mono tabular-nums">{st.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {sourcesLoading && !sourcesData ? (
                <div className="bg-white border border-stone-200 rounded-md p-10 text-center text-xs text-[#525866]">
                  Connecting to live news feeds...
                </div>
              ) : !sourcesData || sourcesData.items.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-md p-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#14181F]">No external headlines matched</p>
                  <p className="text-xs text-[#525866]">
                    Try selecting All Live Sources, clearing your search filter, or entering a valid RSS feed URL.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sourcesData.items.map((item) => (
                    <article
                      key={item.id}
                      className="bg-white border border-stone-200 rounded-md p-4 flex flex-col justify-between gap-4"
                    >
                      <div className="flex gap-3.5">
                        {item.image_url && (
                          <div className="w-24 h-20 rounded overflow-hidden border border-stone-200 shrink-0 bg-stone-100">
                            <img
                              src={item.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="px-2 py-0.5 font-semibold bg-[#0B2545] text-white rounded-sm">
                              {item.source_name}
                            </span>
                            <span className="font-mono text-[#525866]">
                              {formatDate(item.published_at)}
                            </span>
                            <span className="text-[#525866] uppercase tracking-wider">
                              · {item.suggested_category_slug.replace('-', ' ')}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#14181F] leading-snug line-clamp-2">
                            {item.title}
                          </h3>
                          {item.summary && (
                            <p className="text-xs text-[#525866] line-clamp-2 leading-relaxed">
                              {item.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#525866] hover:text-[#0B2545]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Original Source
                        </a>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => importSourceToEditor(item)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#0B2545] border border-stone-300 rounded hover:bg-stone-50 cursor-pointer"
                          >
                            Import to Editor
                          </button>
                          <button
                            type="button"
                            disabled={quickPublishingId === item.id}
                            onClick={() => handleQuickPublishSource(item)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2545] rounded hover:bg-[#13315C] disabled:opacity-60 cursor-pointer"
                          >
                            {quickPublishingId === item.id ? 'Publishing...' : 'Quick Publish'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleSaveCategory}
                  className="bg-white border border-stone-200 rounded-md p-6 space-y-4"
                >
                  <h2 className="text-lg font-serif font-bold text-[#14181F]">
                    {editingCat ? `Edit "${editingCat.name}"` : 'Add News Category'}
                  </h2>
                  <div>
                    <label htmlFor="cat-name" className="block text-xs font-semibold text-[#14181F] mb-1">
                      Category Name
                    </label>
                    <input
                      id="cat-name"
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g., Research & Innovation"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div>
                    <label htmlFor="cat-color" className="block text-xs font-semibold text-[#14181F] mb-1">
                      Desk Accent Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="cat-color"
                        type="color"
                        value={catColor}
                        onChange={(e) => setCatColor(e.target.value)}
                        className="w-12 h-9 border border-stone-300 rounded cursor-pointer"
                      />
                      <span className="font-mono text-xs text-[#525866]">{catColor}</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cat-desc" className="block text-xs font-semibold text-[#14181F] mb-1">
                      Desk Description
                    </label>
                    <textarea
                      id="cat-desc"
                      rows={3}
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Brief editorial scope for this desk..."
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingCat}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                    >
                      {savingCat ? 'Saving...' : editingCat ? 'Update Category' : 'Create Category'}
                    </button>
                    {editingCat && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(null);
                          setCatName('');
                          setCatDesc('');
                          setCatColor('#0B2545');
                        }}
                        className="px-3 py-2 text-xs font-semibold text-[#525866] border border-stone-300 rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-md overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold text-right">Total</th>
                      <th className="py-3 px-4 font-semibold text-right">Published</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-[#FAF9F6]">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 inline-block shrink-0"
                              style={{ backgroundColor: cat.color_hex || '#0B2545' }}
                            />
                            <p className="font-semibold text-[#14181F]">{cat.name}</p>
                          </div>
                          <p className="text-[#525866] line-clamp-1 mt-0.5">{cat.description}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {cat.article_count ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {cat.published_count ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCat(cat);
                              setCatName(cat.name);
                              setCatDesc(cat.description);
                              setCatColor(cat.color_hex || '#0B2545');
                            }}
                            className="p-1.5 text-[#0B2545] hover:bg-stone-100 rounded cursor-pointer"
                            title="Edit category"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer ml-1"
                            title="Delete category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COMMENTS & MODERATION TAB */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="bg-white border border-stone-200 rounded-md p-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-serif font-bold text-[#14181F]">Reader Comments Moderation</h2>
                <div className="flex items-center gap-1.5">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCommentFilter(st)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded capitalize cursor-pointer ${
                        commentFilter === st ? 'bg-[#0B2545] text-white' : 'bg-[#FAF9F6] border border-stone-200 text-[#525866]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
                {comments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#525866]">
                    No comments found for this moderation filter.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200">
                    {comments.map((c) => (
                      <div key={c.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-[#14181F]">{c.author_name}</span>
                            <span className="text-[#525866]">({c.author_email})</span>
                            <span className="text-[#525866]">·</span>
                            <span
                              className={`font-semibold uppercase ${
                                c.status === 'approved'
                                  ? 'text-emerald-700'
                                  : c.status === 'rejected'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#0B2545] font-medium">
                            On article: {c.article_title}
                          </p>
                          <p className="text-sm text-[#14181F] leading-relaxed">{c.content}</p>
                          <p className="text-xs font-mono text-[#525866]">{formatDateTime(c.created_at)}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {c.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleModerateComment(c.id, 'approved')}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {c.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleModerateComment(c.id, 'rejected')}
                              className="px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADVERTISEMENTS TAB */}
          {activeTab === 'ads' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleSaveAd}
                  className="bg-white border border-stone-200 rounded-md p-6 space-y-4"
                >
                  <h2 className="text-lg font-serif font-bold text-[#14181F]">
                    {editingAd ? `Edit "${editingAd.title}"` : 'Create Advertisement Campaign'}
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Campaign Headline</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      placeholder="e.g., LASU Postgraduate Admissions 2026"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Sponsor / Department</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={adAdvertiser}
                      onChange={(e) => setAdAdvertiser(e.target.value)}
                      placeholder="e.g., Postgraduate School / Corporate Sponsor"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Placement</label>
                      <select
                        value={adPlacement}
                        onChange={(e) =>
                          setAdPlacement(e.target.value as 'top_banner' | 'sidebar_box' | 'inline_banner')
                        }
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                      >
                        <option value="top_banner">Top Leaderboard Banner</option>
                        <option value="sidebar_box">Sidebar Box (300×250)</option>
                        <option value="inline_banner">Mid-Page Inline Banner</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Status</label>
                      <select
                        value={adStatus}
                        onChange={(e) => setAdStatus(e.target.value as 'active' | 'paused')}
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Destination URL (optional)</label>
                    <input
                      type="url"
                      value={adTargetUrl}
                      onChange={(e) => setAdTargetUrl(e.target.value)}
                      placeholder="https://lasu.edu.ng"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div className="border border-stone-200 rounded-md p-3 bg-[#FAF9F6] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Banner Image (optional)</span>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B2545] bg-white border border-stone-300 rounded cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingImage ? 'Uploading...' : 'Upload Banner'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) => handleImageUpload(e, 'ad')}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    {adImageUrl && (
                      <div className="flex items-center gap-3">
                        <img src={adImageUrl} alt="Ad preview" className="w-20 h-14 object-cover border border-stone-200" />
                        <button
                          type="button"
                          onClick={() => setAdImageUrl('')}
                          className="text-xs text-red-700 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingAd}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md cursor-pointer"
                    >
                      {savingAd ? 'Saving...' : editingAd ? 'Update Campaign' : 'Launch Campaign'}
                    </button>
                    {editingAd && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAd(null);
                          setAdTitle('');
                          setAdAdvertiser('');
                          setAdTargetUrl('');
                          setAdImageUrl('');
                        }}
                        className="px-3 py-2 text-xs font-semibold border border-stone-300 rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-md overflow-hidden">
                {ads.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#525866]">
                    No advertisement campaigns created yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Campaign</th>
                          <th className="py-3 px-4 font-semibold">Placement</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Impr.</th>
                          <th className="py-3 px-4 font-semibold text-right">Clicks</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {ads.map((ad) => (
                          <tr key={ad.id} className="hover:bg-[#FAF9F6]">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[#14181F]">{ad.title}</p>
                              <p className="text-[#525866]">{ad.advertiser_name}</p>
                            </td>
                            <td className="py-3 px-4 text-[#525866] font-mono">{ad.placement}</td>
                            <td className="py-3 px-4">
                              <span className={ad.status === 'active' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                                {ad.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{ad.impressions}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{ad.clicks}</td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAd(ad);
                                  setAdTitle(ad.title);
                                  setAdAdvertiser(ad.advertiser_name);
                                  setAdTargetUrl(ad.target_url);
                                  setAdImageUrl(ad.image_url);
                                  setAdPlacement(ad.placement);
                                  setAdStatus(ad.status);
                                }}
                                className="p-1.5 text-[#0B2545] hover:bg-stone-100 rounded cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAd(ad)}
                                className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* READER USER ACCOUNTS TAB (FULL CRUD) */}
          {activeTab === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <form
                  onSubmit={handleSaveReader}
                  className="bg-white border border-stone-200 rounded-md p-6 space-y-4"
                >
                  <h2 className="text-lg font-serif font-bold text-[#14181F]">
                    {editingReader ? `Edit ${editingReader.email}` : 'Create Reader Account'}
                  </h2>
                  <div>
                    <label htmlFor="reader-name" className="block text-xs font-semibold text-[#14181F] mb-1">
                      Full Name
                    </label>
                    <input
                      id="reader-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={readerName}
                      onChange={(e) => setReaderName(e.target.value)}
                      placeholder="e.g., Tunde Adeyemi"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div>
                    <label htmlFor="reader-email" className="block text-xs font-semibold text-[#14181F] mb-1">
                      Email Address
                    </label>
                    <input
                      id="reader-email"
                      type="email"
                      required
                      value={readerEmail}
                      onChange={(e) => setReaderEmail(e.target.value)}
                      placeholder="student@lasu.edu.ng"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div>
                    <label htmlFor="reader-dept" className="block text-xs font-semibold text-[#14181F] mb-1">
                      Department / Faculty
                    </label>
                    <input
                      id="reader-dept"
                      type="text"
                      value={readerDept}
                      onChange={(e) => setReaderDept(e.target.value)}
                      placeholder="e.g., Faculty of Law"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <div>
                    <label htmlFor="reader-pass" className="block text-xs font-semibold text-[#14181F] mb-1">
                      {editingReader ? 'New Password (leave blank to keep)' : 'Password (min 6 chars)'}
                    </label>
                    <input
                      id="reader-pass"
                      type="password"
                      required={!editingReader}
                      minLength={editingReader && !readerPassword ? undefined : 6}
                      value={readerPassword}
                      onChange={(e) => setReaderPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#14181F]">
                    <input
                      type="checkbox"
                      checked={readerActive}
                      onChange={(e) => setReaderActive(e.target.checked)}
                    />
                    Account Active
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingReader}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                    >
                      {savingReader
                        ? 'Saving...'
                        : editingReader
                          ? 'Update Reader'
                          : 'Create Reader'}
                    </button>
                    {editingReader && (
                      <button
                        type="button"
                        onClick={resetReaderForm}
                        className="px-3 py-2 text-xs font-semibold text-[#525866] border border-stone-300 rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="lg:col-span-8 bg-white border border-stone-200 rounded-md overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-serif font-bold text-[#14181F]">
                      Registered Reader Accounts
                    </h2>
                    <span className="font-mono text-xs text-[#525866] tabular-nums">
                      {usersList.length} account(s)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#525866] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search name, email, dept..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                      />
                    </div>
                    <select
                      aria-label="Filter users by status"
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
                      className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                {usersLoading ? (
                  <div className="p-8 text-center text-xs text-[#525866]">Loading reader accounts...</div>
                ) : usersList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#525866]">
                    No reader accounts match your search or none are registered yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Reader</th>
                          <th className="py-3 px-4 font-semibold">Department</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Comments</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {usersList.map((u) => (
                          <tr key={u.id} className="hover:bg-[#FAF9F6]">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[#14181F]">{u.full_name}</p>
                              <p className="text-[#525866]">{u.email}</p>
                            </td>
                            <td className="py-3 px-4 text-[#525866]">{u.department || '—'}</td>
                            <td className="py-3 px-4">
                              <span className={u.is_active ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                                {u.is_active ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{u.comment_count ?? 0}</td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditReader(u)}
                                  className="p-1.5 text-[#0B2545] hover:bg-stone-100 rounded cursor-pointer"
                                  title="Edit reader"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserActive(u)}
                                  className="px-2 py-1 border border-stone-300 rounded hover:bg-stone-50 cursor-pointer"
                                >
                                  {u.is_active ? 'Suspend' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADMINISTRATORS TAB */}
          {activeTab === 'admins' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                {admin.role !== 'super_admin' ? (
                  <div className="bg-white border border-stone-200 rounded-md p-6 text-xs text-[#525866]">
                    Only Super Administrators can create or modify administrator accounts.
                  </div>
                ) : editingAdmin ? (
                  <form
                    onSubmit={handleUpdateAdmin}
                    className="bg-white border border-stone-200 rounded-md p-6 space-y-4"
                  >
                    <h2 className="text-lg font-serif font-bold text-[#14181F]">
                      Update {editingAdmin.email}
                    </h2>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={editAdminName}
                        onChange={(e) => setEditAdminName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Role</label>
                      <select
                        value={editAdminRole}
                        onChange={(e) => setEditAdminRole(e.target.value as 'editor' | 'super_admin')}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      >
                        <option value="editor">Editor</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Reset Password (leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        value={editAdminPassword}
                        onChange={(e) => setEditAdminPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-[#14181F]">
                      <input
                        type="checkbox"
                        checked={editAdminActive}
                        onChange={(e) => setEditAdminActive(e.target.checked)}
                      />
                      Account Active
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingAdmin}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md cursor-pointer"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAdmin(null)}
                        className="px-3 py-2 text-xs font-semibold border border-stone-300 rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={handleCreateAdmin}
                    className="bg-white border border-stone-200 rounded-md p-6 space-y-4"
                  >
                    <h2 className="text-lg font-serif font-bold text-[#14181F]">
                      Add Editorial Administrator
                    </h2>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="e.g., Dr. Folake Adeyemi"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">University Email</label>
                      <input
                        type="email"
                        required
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="editor@lasu.edu.ng"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Role</label>
                      <select
                        value={newAdminRole}
                        onChange={(e) => setNewAdminRole(e.target.value as 'editor' | 'super_admin')}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                      >
                        <option value="editor">Editor</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={savingAdmin}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                    >
                      {savingAdmin ? 'Creating Account...' : 'Create Administrator'}
                    </button>
                  </form>
                )}
              </div>

              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-md overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Administrator</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Articles</th>
                      {admin.role === 'super_admin' && (
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {adminsList.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF9F6]">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#14181F]">{item.full_name}</p>
                          <p className="text-[#525866]">{item.email}</p>
                        </td>
                        <td className="py-3 px-4 text-[#525866]">
                          {item.role === 'super_admin' ? 'Super Admin' : 'Editor'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={item.is_active ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                            {item.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {item.article_count ?? 0}
                        </td>
                        {admin.role === 'super_admin' && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdmin(item);
                                setEditAdminName(item.full_name);
                                setEditAdminRole(item.role);
                                setEditAdminActive(item.is_active === 1);
                                setEditAdminPassword('');
                              }}
                              className="p-1.5 text-[#0B2545] hover:bg-stone-100 rounded cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {item.id !== admin.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAdmin(item)}
                                className="p-1.5 text-red-700 hover:bg-red-50 rounded cursor-pointer ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PUBLISHING ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200">
                <h2 className="text-base font-serif font-bold text-[#14181F]">Publishing Activity Log</h2>
              </div>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#525866]">No activity logs recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-stone-200 bg-[#FAF9F6] text-[#525866]">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-4 font-semibold">Administrator</th>
                        <th className="py-3 px-4 font-semibold">Action</th>
                        <th className="py-3 px-4 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#FAF9F6]">
                          <td className="py-3 px-4 font-mono tabular-nums text-[#525866] whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#14181F] whitespace-nowrap">
                            {log.admin_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#0B2545] whitespace-nowrap">{log.action}</td>
                          <td className="py-3 px-4 text-[#525866]">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PRESS INQUIRIES TAB */}
          {activeTab === 'messages' && (
            <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200">
                <h2 className="text-base font-serif font-bold text-[#14181F]">
                  Contact &amp; Press Desk Submissions
                </h2>
              </div>
              {messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#525866]">
                  No inquiries submitted from the public Contact form yet.
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[#14181F]">{msg.subject}</span>
                          <span className="text-[#525866]">·</span>
                          <span className={msg.is_read ? 'text-[#525866]' : 'font-semibold text-[#0B2545]'}>
                            {msg.is_read ? 'Read' : 'Unread'}
                          </span>
                        </div>
                        <p className="text-xs text-[#525866]">
                          From {msg.sender_name} ({msg.sender_email}) · {formatDateTime(msg.created_at)}
                        </p>
                        <p className="text-sm text-[#14181F] leading-relaxed pt-1">{msg.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleMessageRead(msg)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-300 rounded-md hover:bg-stone-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {msg.is_read ? 'Mark Unread' : 'Mark Read'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Article & Announcement Composer Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-md w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold text-[#14181F]">
                {editingArticle ? 'Edit Campus Broadcast' : 'Compose Campus Broadcast'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 text-[#525866] hover:text-[#14181F] cursor-pointer"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-6 space-y-5">
              <div>
                <label htmlFor="art-title" className="block text-xs font-semibold text-[#14181F] mb-1.5">
                  Headline
                </label>
                <input
                  id="art-title"
                  type="text"
                  required
                  minLength={5}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enter full broadcast headline..."
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="art-cat" className="block text-xs font-semibold text-[#14181F]">
                      News Category
                    </label>
                    {categories.length === 0 && (
                      <button
                        type="button"
                        onClick={loadCategories}
                        className="text-[11px] font-semibold text-[#0B2545] hover:underline cursor-pointer"
                      >
                        {categoriesLoading ? 'Loading...' : 'Reload categories'}
                      </button>
                    )}
                  </div>
                  <select
                    id="art-cat"
                    required
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                  >
                    {categories.length === 0 ? (
                      <option value={0}>Loading categories...</option>
                    ) : (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="art-status" className="block text-xs font-semibold text-[#14181F] mb-1.5">
                    Publication Status
                  </label>
                  <select
                    id="art-status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published')}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Save as Draft</option>
                  </select>
                </div>
              </div>

              <div className="border border-stone-200 rounded-md p-4 bg-[#FAF9F6] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#14181F]">Featured Image</p>
                    <p className="text-xs text-[#525866]">JPEG, PNG, WEBP or GIF up to 5MB</p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-white border border-stone-300 rounded-md hover:bg-stone-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => handleImageUpload(e, 'article')}
                      className="sr-only"
                    />
                  </label>
                </div>

                {formImage && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="w-28 h-20 rounded overflow-hidden border border-stone-200 shrink-0">
                      <ArticleMedia src={formImage} alt="Preview" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-mono text-[#525866] truncate">{formImage}</p>
                      <button
                        type="button"
                        onClick={() => setFormImage('')}
                        className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                      >
                        Remove image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="art-excerpt" className="block text-xs font-semibold text-[#14181F] mb-1.5">
                  Editorial Summary / Deck
                </label>
                <textarea
                  id="art-excerpt"
                  rows={2}
                  required
                  minLength={10}
                  value={formExcerpt}
                  onChange={(e) => setFormExcerpt(e.target.value)}
                  placeholder="Concise 1–2 sentence summary shown on news cards..."
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6]"
                />
              </div>

              <div>
                <label htmlFor="art-content" className="block text-xs font-semibold text-[#14181F] mb-1.5">
                  Full Broadcast Content
                </label>
                <textarea
                  id="art-content"
                  rows={8}
                  required
                  minLength={20}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Write the complete news dispatch. Separate paragraphs with a blank line..."
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-stone-200">
                <label className="flex items-center gap-2 text-xs font-medium text-[#14181F]">
                  <input
                    type="checkbox"
                    checked={formIsFeatured}
                    onChange={(e) => setFormIsFeatured(e.target.checked)}
                  />
                  Feature on Homepage
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-[#14181F]">
                  <input
                    type="checkbox"
                    checked={formIsBreaking}
                    onChange={(e) => setFormIsBreaking(e.target.checked)}
                  />
                  Breaking News Ticker
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-[#14181F]">
                  <input
                    type="checkbox"
                    checked={formIsAnnouncement}
                    onChange={(e) => setFormIsAnnouncement(e.target.checked)}
                  />
                  Official Announcement
                </label>
                {formIsAnnouncement && (
                  <select
                    aria-label="Announcement priority"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as 'normal' | 'urgent')}
                    className="px-3 py-1.5 text-xs border border-stone-300 rounded-md bg-[#FAF9F6]"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="urgent">Urgent Circular</option>
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-[#525866] border border-stone-300 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingArticle}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] cursor-pointer"
                >
                  {savingArticle
                    ? 'Saving...'
                    : editingArticle
                      ? 'Save Changes'
                      : formStatus === 'published'
                        ? 'Publish Broadcast'
                        : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
