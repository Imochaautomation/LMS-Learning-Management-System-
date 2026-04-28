import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home, BookOpen, FileText, GraduationCap, Users, LogOut,
  UserCircle, FolderOpen, UserPlus, ChevronRight
} from 'lucide-react';

const NAVY = '#1E1040';
const ORANGE = '#F05A28';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const isContentManager = user.role === 'manager' && (user.department || '') === 'Content';
  const isContentNewJoiner = user.role === 'new_joiner' && (user.manager_department || '') === 'Content';

  let items = [];
  if (user.role === 'new_joiner') {
    items = [
      { to: '/training', label: 'Dashboard', icon: Home },
      ...(isContentNewJoiner ? [{ to: '/training/sme-kit', label: 'Spellbook — SME Kit', icon: BookOpen }] : []),
      { to: '/training/assessments', label: 'Assessments', icon: FileText },
      { to: '/training/courses', label: 'Courses', icon: GraduationCap },
    ];
  } else if (user.role === 'employee') {
    items = [
      { to: '/upskilling', label: 'Dashboard', icon: Home },
      { to: '/upskilling/courses', label: 'My Courses', icon: GraduationCap },
      { to: '/upskilling/profile', label: 'My Profile', icon: UserCircle },
    ];
  } else if (user.role === 'manager') {
    items = [
      { to: '/manager?tab=learners', label: 'Learners', icon: Users },
      { to: '/manager?tab=bank', label: 'Assessment Bank', icon: FileText },
      ...(isContentManager ? [{ to: '/manager?tab=smekit', label: 'Spellbook — SME Kit', icon: BookOpen }] : []),
      { to: '/manager?tab=team', label: 'Manage Team', icon: UserPlus },
    ];
  } else if (user.role === 'admin') {
    items = [
      { to: '/admin', label: 'Overview', icon: Home },
      { to: '/admin/users', label: 'Users', icon: Users },
    ];
  }

  const roleBadge = {
    new_joiner: { label: 'New Joiner', bg: 'rgba(240,90,40,0.18)', color: '#FCA06A', border: 'rgba(240,90,40,0.35)' },
    employee:   { label: 'Employee',   bg: 'rgba(99,102,241,0.18)', color: '#A5B4FC', border: 'rgba(99,102,241,0.35)' },
    manager:    { label: 'Manager',    bg: 'rgba(245,158,11,0.18)', color: '#FCD34D', border: 'rgba(245,158,11,0.35)' },
    admin:      { label: 'Admin',      bg: 'rgba(239,68,68,0.18)',  color: '#FCA5A5', border: 'rgba(239,68,68,0.35)' },
  }[user.role];

  const avatarGradient = {
    admin:      'linear-gradient(135deg,#ef4444,#e11d48)',
    manager:    `linear-gradient(135deg,${ORANGE},#c2410c)`,
    employee:   'linear-gradient(135deg,#6366f1,#7c3aed)',
    new_joiner: 'linear-gradient(135deg,#10b981,#0d9488)',
  }[user.role] || `linear-gradient(135deg,${ORANGE},#c2410c)`;

  const managerName = user.manager_name;

  return (
    <aside className="w-64 flex flex-col h-screen sticky top-0 overflow-hidden" style={{ background: NAVY }}>

      {/* Logo header */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src="/logoimocha.png" alt="iMocha" className="h-8 w-auto mb-3" style={{ filter: 'brightness(0) invert(1)' }} />
        <p className="text-xs font-medium tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
          AI Learning Space
        </p>
      </div>

      {/* User card */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-lg"
            style={{ background: avatarGradient }}>
            {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
            <span className="inline-flex items-center mt-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: roleBadge.bg, color: roleBadge.color, border: `1px solid ${roleBadge.border}` }}>
              {roleBadge.label}
            </span>
          </div>
        </div>

        {(user.department || managerName) && (
          <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {user.department && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <FolderOpen className="w-3 h-3 shrink-0" />
                <span className="truncate">{user.department}</span>
              </p>
            )}
            {managerName && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">Manager: {managerName}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          const hasQueryParams = item.to.includes('?');
          return (
            <NavLink
              key={idx}
              to={item.to}
              end={!hasQueryParams && (item.to === '/training' || item.to === '/upskilling' || item.to === '/admin')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group"
              style={({ isActive }) => {
                let active = isActive;
                if (hasQueryParams) {
                  const [path, query] = item.to.split('?');
                  const params = new URLSearchParams(query);
                  const currentParams = new URLSearchParams(window.location.search);
                  active = window.location.pathname === path && params.get('tab') === currentParams.get('tab');
                }
                return active
                  ? { background: ORANGE, color: '#fff', boxShadow: `0 2px 12px rgba(240,90,40,0.35)` }
                  : { color: 'rgba(255,255,255,0.6)' };
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
