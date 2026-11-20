export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  color_hex: string;
  published_count?: number;
  article_count?: number;
  created_at?: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  featured_image: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  category_color?: string;
  author_id?: number;
  author_name: string;
  status?: 'draft' | 'published';
  is_featured: number;
  is_breaking: number;
  is_announcement: number;
  announcement_priority: 'normal' | 'urgent';
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CommentItem {
  id: number;
  article_id: number;
  article_title?: string;
  article_slug?: string;
  user_id?: number | null;
  author_name: string;
  author_email?: string;
  department?: string;
  content: string;
  status?: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Advertisement {
  id: number;
  title: string;
  advertiser_name: string;
  image_url: string;
  target_url: string;
  placement: 'top_banner' | 'sidebar_box' | 'inline_banner';
  status: 'active' | 'paused';
  impressions: number;
  clicks: number;
  created_at: string;
}

export interface PublicUser {
  id: number;
  full_name: string;
  email: string;
  department: string;
  is_active: number;
  last_login?: string | null;
  created_at?: string;
  comment_count?: number;
}

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: 'super_admin' | 'editor';
  is_active?: number;
  last_login?: string | null;
  created_at?: string;
  article_count?: number;
}

export interface ActivityLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string;
  created_at: string;
  admin_name: string;
  admin_email?: string;
}

export interface ContactMessage {
  id: number;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface CategorySection {
  category: Category;
  articles: Article[];
}

export interface HomeData {
  featured: Article[];
  breaking: Article[];
  latest: Article[];
  trending: Article[];
  announcements: Article[];
  categories: Category[];
  categorySections: CategorySection[];
  ads: Advertisement[];
  stats: {
    total_published: number;
    total_announcements: number;
    total_views: number;
    total_categories: number;
    approved_comments: number;
  };
}

export interface AdminOverviewData {
  stats: {
    total_articles: number;
    published_articles: number;
    draft_articles: number;
    total_announcements: number;
    breaking_articles: number;
    featured_articles: number;
    total_views: number;
    total_categories: number;
    active_admins: number;
    total_users: number;
    pending_comments: number;
    active_ads: number;
    unread_messages: number;
  };
  recentActivity: ActivityLog[];
  recentArticles: Array<{
    id: number;
    title: string;
    slug: string;
    status: 'draft' | 'published';
    is_featured: number;
    is_breaking: number;
    is_announcement: number;
    views: number;
    published_at: string | null;
    updated_at: string;
    category_name: string;
    author_name: string;
  }>;
}

export interface ArticlePerformanceItem {
  id: number;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  views: number;
  is_featured: number;
  is_breaking: number;
  is_announcement: number;
  announcement_priority: 'normal' | 'urgent';
  published_at: string | null;
  created_at: string;
  category_id: number;
  category_name: string;
  category_color: string;
  author_name: string;
  total_comments: number;
  approved_comments: number;
}

export interface CategoryPerformanceItem {
  id: number;
  name: string;
  slug: string;
  color_hex: string;
  total_articles: number;
  published_articles: number;
  total_views: number;
  avg_views: number;
  comment_count: number;
}

export interface AdminAnalyticsData {
  summary: {
    total_articles: number;
    published_articles: number;
    draft_articles: number;
    featured_articles: number;
    breaking_articles: number;
    announcement_articles: number;
    total_views: number;
    avg_views_published: number;
    top_article_views: number;
    total_comments: number;
    approved_comments: number;
    pending_comments: number;
    rejected_comments: number;
    total_ads: number;
    total_impressions: number;
    total_clicks: number;
  };
  categoryBreakdown: CategoryPerformanceItem[];
  articlePerformance: ArticlePerformanceItem[];
}

export interface ExternalHeadlineItem {
  id: string;
  source_key: string;
  source_name: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  image_url: string;
  published_at: string;
  suggested_category_slug: string;
}

export interface ExternalSourcesResponse {
  items: ExternalHeadlineItem[];
  sourceStatuses: Array<{
    key: string;
    name: string;
    ok: boolean;
    count: number;
    error?: string;
  }>;
  availableSources: Array<{
    key: string;
    name: string;
    category: string;
  }>;
}
