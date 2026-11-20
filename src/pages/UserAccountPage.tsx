import { useEffect, useState, type FormEvent } from 'react';
import { User, LogOut, ArrowLeft, MessageSquare } from 'lucide-react';
import { apiRequest, formatDateTime, setUserToken } from '../lib/api.ts';
import type { CommentItem, PublicUser } from '../types.ts';

interface UserAccountPageProps {
  user: PublicUser | null;
  onUserChange: (user: PublicUser | null) => void;
  onNavigate: (path: string) => void;
}

export function UserAccountPage({ user, onUserChange, onNavigate }: UserAccountPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myComments, setMyComments] = useState<CommentItem[]>([]);

  useEffect(() => {
    if (!user) {
      setMyComments([]);
      return;
    }
    apiRequest<{ comments: CommentItem[] }>('/api/users/me')
      .then((res) => setMyComments(res.comments || []))
      .catch(() => setMyComments([]));
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await apiRequest<{ userToken?: string; user: PublicUser }>('/api/users/register', {
          method: 'POST',
          body: JSON.stringify({ full_name: fullName, email, department, password }),
        });
        if (res.userToken) setUserToken(res.userToken);
        onUserChange(res.user);
      } else {
        const res = await apiRequest<{ userToken?: string; user: PublicUser }>('/api/users/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (res.userToken) setUserToken(res.userToken);
        onUserChange(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiRequest('/api/users/logout', { method: 'POST' }).catch(() => {});
    setUserToken(null);
    onUserChange(null);
  };

  if (user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0B2545] text-white flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#14181F]">{user.full_name}</h1>
              <p className="text-xs text-[#525866]">
                {user.email} {user.department ? `· ${user.department}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/news')}
              className="px-4 py-2 text-xs font-semibold border border-stone-300 bg-white text-[#14181F] hover:bg-stone-50 cursor-pointer"
            >
              Browse News
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white border border-stone-200">
          <div className="px-6 py-4 border-b border-stone-200 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#0B2545]" />
            <h2 className="text-lg font-serif font-bold text-[#14181F]">My Submitted Comments</h2>
          </div>
          {myComments.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#525866]">
              You have not posted any article comments yet. Open any published story to join the campus discussion.
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {myComments.map((c) => (
                <div key={c.id} className="p-5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => c.article_slug && onNavigate(`/article/${c.article_slug}`)}
                      className="font-semibold text-[#0B2545] hover:underline cursor-pointer text-left"
                    >
                      {c.article_title}
                    </button>
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
                  <p className="text-sm text-[#14181F]">{c.content}</p>
                  <p className="text-xs font-mono text-[#525866]">{formatDateTime(c.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="border border-stone-200 bg-white p-8 space-y-6">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#525866] hover:text-[#0B2545] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to LASU News
        </button>

        <div>
          <h1 className="text-2xl font-serif font-bold text-[#14181F]">
            LASU Reader Account
          </h1>
          <p className="text-xs text-[#525866] mt-1">
            Sign in or register as a student, lecturer, or alumnus to comment on campus news.
          </p>
        </div>

        <div className="grid grid-cols-2 border border-stone-200 bg-[#FAF9F6] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold cursor-pointer ${
              mode === 'login' ? 'bg-[#0B2545] text-white' : 'text-[#525866]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold cursor-pointer ${
              mode === 'register' ? 'bg-[#0B2545] text-white' : 'text-[#525866]'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="u-name" className="block text-xs font-semibold mb-1">
                  Full Name
                </label>
                <input
                  id="u-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Tunde Bakare"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
                />
              </div>
              <div>
                <label htmlFor="u-dept" className="block text-xs font-semibold mb-1">
                  Faculty / Department (optional)
                </label>
                <input
                  id="u-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Faculty of Science / Mass Communication"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="u-email" className="block text-xs font-semibold mb-1">
              Email Address
            </label>
            <input
              id="u-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@lasu.edu.ng"
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
            />
          </div>

          <div>
            <label htmlFor="u-pass" className="block text-xs font-semibold mb-1">
              Password
            </label>
            <input
              id="u-pass"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 bg-[#FAF9F6]"
            />
          </div>

          {error && (
            <div className="p-3 text-xs text-red-900 bg-red-50 border border-red-200">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] cursor-pointer"
          >
            {loading ? 'Processing...' : mode === 'register' ? 'Register Reader Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
