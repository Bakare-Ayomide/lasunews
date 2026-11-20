import { useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiRequest, setAdminSession } from '../lib/api.ts';
import type { AdminUser } from '../types.ts';

interface AdminLoginPageProps {
  onLoginSuccess: (admin: AdminUser) => void;
  onNavigate: (path: string) => void;
}

export function AdminLoginPage({ onLoginSuccess, onNavigate }: AdminLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ admin: AdminUser; sessionToken?: string; csrfToken: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      setAdminSession(res.sessionToken ?? null, res.csrfToken);
      onLoginSuccess(res.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center px-4 py-12 bg-[#FAF9F6]">
      <div className="w-full max-w-md border border-stone-200 bg-white rounded-md p-8 space-y-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#525866] hover:text-[#0B2545] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Public Site
          </button>
          <div className="pt-2 space-y-3">
            <img
              src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png"
              alt="Lagos State University"
              className="h-11 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#14181F]">
                Editorial Admin Portal
              </h1>
              <p className="text-xs text-[#525866]">
                Lagos State University Campus Broadcasting Desk
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-[#14181F] mb-1.5">
              Official Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lasu.edu.ng"
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6] focus:border-[#0B2545] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-[#14181F] mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter administrator password"
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md bg-[#FAF9F6] focus:border-[#0B2545] focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 text-xs text-red-900 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0B2545] rounded-md hover:bg-[#13315C] disabled:opacity-60 transition-colors cursor-pointer min-h-[44px]"
          >
            {loading ? 'Verifying Credentials...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="pt-4 border-t border-stone-200 text-xs text-[#525866] space-y-1.5">
          <p className="font-semibold text-[#14181F]">Initial Seeded Administrator</p>
          <p className="font-mono">Email: admin@lasu.edu.ng</p>
          <p className="font-mono">Password: LasuBroadcast2026!</p>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@lasu.edu.ng');
              setPassword('LasuBroadcast2026!');
            }}
            className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer pt-1"
          >
            Fill default credentials
          </button>
        </div>
      </div>
    </div>
  );
}
