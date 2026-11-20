import { useCallback, useEffect, useState } from 'react';
import { apiRequest, clearAdminSession, setAdminSession, setUserToken } from './lib/api.ts';
import { SiteHeader } from './components/SiteHeader.tsx';
import { SiteFooter } from './components/SiteFooter.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { NewsArchivePage } from './pages/NewsArchivePage.tsx';
import { ArticleDetailPage } from './pages/ArticleDetailPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { UserAccountPage } from './pages/UserAccountPage.tsx';
import type { AdminUser, HomeData, PublicUser } from './types.ts';

export default function App() {
  const [locationUrl, setLocationUrl] = useState(
    () => window.location.pathname + window.location.search + window.location.hash
  );
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadHomeData = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      const data = await apiRequest<HomeData>('/api/public/home');
      setHomeData(data);
    } catch (err) {
      setHomeError(err instanceof Error ? err.message : 'Unable to load campus news.');
    } finally {
      setHomeLoading(false);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await apiRequest<{
        authenticated: boolean;
        admin: AdminUser;
        sessionToken?: string;
        csrfToken: string;
      }>('/api/auth/me');
      if (res.authenticated && res.admin) {
        setCurrentAdmin(res.admin);
        setAdminSession(res.sessionToken ?? null, res.csrfToken);
      }
    } catch {
      setCurrentAdmin(null);
      clearAdminSession();
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const checkUserSession = useCallback(async () => {
    try {
      const res = await apiRequest<{ authenticated: boolean; userToken?: string; user: PublicUser }>(
        '/api/users/me'
      );
      if (res.authenticated && res.user) {
        setCurrentUser(res.user);
        if (res.userToken) setUserToken(res.userToken);
      }
    } catch {
      setCurrentUser(null);
      setUserToken(null);
    }
  }, []);

  useEffect(() => {
    loadHomeData();
    checkSession();
    checkUserSession();
  }, [loadHomeData, checkSession, checkUserSession]);

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(window.location.pathname + window.location.search + window.location.hash);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    const [pathnameAndSearch, hash] = path.split('#');
    const target = pathnameAndSearch || '/';
    window.history.pushState({}, '', path);
    setLocationUrl(path);

    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else if (!target.startsWith('/admin')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout error
    }
    setCurrentAdmin(null);
    clearAdminSession();
    navigate('/admin/login');
  };

  const [pathOnly, searchPart = ''] = locationUrl.split('#')[0].split('?');
  const searchParams = new URLSearchParams(searchPart);

  if (pathOnly.startsWith('/admin') && pathOnly !== '/admin/login') {
    if (!authChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] text-sm text-[#525866]">
          Verifying editorial session...
        </div>
      );
    }
    if (!currentAdmin) {
      return (
        <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
          <SiteHeader currentPath="/admin/login" onNavigate={navigate} currentAdmin={null} />
          <main className="flex-1">
            <AdminLoginPage
              onLoginSuccess={(adminUser) => {
                setCurrentAdmin(adminUser);
                navigate('/admin');
              }}
              onNavigate={navigate}
            />
          </main>
          <SiteFooter categories={homeData?.categories || []} onNavigate={navigate} />
        </div>
      );
    }
    return (
      <AdminDashboardPage
        admin={currentAdmin}
        onLogout={handleLogout}
        onNavigate={navigate}
        onDataMutated={loadHomeData}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      <SiteHeader currentPath={pathOnly} onNavigate={navigate} currentAdmin={currentAdmin} />

      <main className="flex-1">
        {pathOnly === '/admin/login' ? (
          <AdminLoginPage
            onLoginSuccess={(adminUser) => {
              setCurrentAdmin(adminUser);
              navigate('/admin');
            }}
            onNavigate={navigate}
          />
        ) : pathOnly === '/account' ? (
          <UserAccountPage
            user={currentUser}
            currentAdmin={currentAdmin}
            onUserChange={setCurrentUser}
            onAdminChange={setCurrentAdmin}
            onNavigate={navigate}
          />
        ) : pathOnly.startsWith('/article/') ? (
          <ArticleDetailPage
            slug={decodeURIComponent(pathOnly.replace('/article/', ''))}
            currentUser={currentUser}
            onNavigate={navigate}
          />
        ) : pathOnly === '/news' ? (
          <NewsArchivePage
            categories={homeData?.categories || []}
            initialQuery={searchParams.get('q') || ''}
            initialCategory={searchParams.get('category') || 'all'}
            onlyAnnouncements={false}
            currentAdmin={currentAdmin}
            onNavigate={navigate}
          />
        ) : pathOnly === '/announcements' ? (
          <NewsArchivePage
            categories={homeData?.categories || []}
            initialQuery={searchParams.get('q') || ''}
            initialCategory={searchParams.get('category') || 'all'}
            onlyAnnouncements={true}
            currentAdmin={currentAdmin}
            onNavigate={navigate}
          />
        ) : (
          <LandingPage
            homeData={homeData}
            loading={homeLoading}
            error={homeError}
            currentUser={currentUser}
            currentAdmin={currentAdmin}
            onNavigate={navigate}
            onRetry={loadHomeData}
          />
        )}
      </main>

      <SiteFooter categories={homeData?.categories || []} currentAdmin={currentAdmin} onNavigate={navigate} />
    </div>
  );
}
