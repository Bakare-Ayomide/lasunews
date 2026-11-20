import type { AdminUser, Category } from '../types.ts';

interface SiteFooterProps {
  categories: Category[];
  currentAdmin?: AdminUser | null;
  onNavigate: (path: string) => void;
}

export function SiteFooter({ categories, currentAdmin, onNavigate }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0B2545] text-stone-200 border-t border-[#13315C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/15">
          <div className="md:col-span-5 space-y-4">
            <div className="inline-block bg-white px-3 py-1.5 rounded-sm">
              <img
                src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png"
                alt="Lagos State University"
                className="h-9 w-auto object-contain"
              />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white tracking-tight">
              LASU Campus Broadcast
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed max-w-md">
              The official digital newsroom and campus broadcasting bulletin of Lagos State University.
              Delivering verified institutional dispatches, academic notices, and student journalism across
              Ojo, Epe, and Ikeja campuses.
            </p>
            <p className="text-xs text-stone-400">
              Km 15, Badagry Expressway, Ojo, PMB 0001, Lagos, Nigeria
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-widest text-[#E5C158]">
              Sections
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  Home Front Page
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/news')}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  News Archive
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/announcements')}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  Official Announcements
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/#about')}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  About Directorate
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/#contact')}
                  className="text-stone-300 hover:text-white transition-colors cursor-pointer"
                >
                  Press Desk Contact
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-widest text-[#E5C158]">
              Campus Desks
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onNavigate(`/news?category=${encodeURIComponent(cat.slug)}`)}
                  className="text-left text-stone-300 hover:text-white transition-colors truncate cursor-pointer"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-400">
          <p>© {year} Lagos State University — Directorate of Information &amp; Campus Broadcasting.</p>
          {currentAdmin && (currentAdmin.role === 'editor' || currentAdmin.role === 'super_admin') && (
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Admin Portal
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
