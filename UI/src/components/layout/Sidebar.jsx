import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home, BookOpen, FileText, GraduationCap, Users, LogOut,
  UserCircle, FolderOpen, UserPlus
} from 'lucide-react';
import { ROLES } from '../../data/mockData';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const isEditingDept = (user.department || '').toLowerCase() === 'editing';

  // Build nav dynamically based on role + department
  let items = [];
  if (user.role === ROLES.NEW_JOINER) {
    items = [
      { to: '/training', label: 'Dashboard', icon: Home },
      // Spellbook only for Editing dept new joiners
      ...(isEditingDept ? [{ to: '/training/sme-kit', label: 'Spellbook — SME Kit', icon: BookOpen }] : []),
      { to: '/training/assessments', label: 'Assessments', icon: FileText },
      { to: '/training/courses', label: 'Courses', icon: GraduationCap },
    ];
  } else if (user.role === ROLES.EMPLOYEE) {
    items = [
      { to: '/upskilling', label: 'Dashboard', icon: Home },
      { to: '/upskilling/courses', label: 'My Courses', icon: GraduationCap },
      { to: '/upskilling/profile', label: 'My Profile', icon: UserCircle },
    ];
  } else if (user.role === ROLES.MANAGER) {
    items = [
      { to: '/manager?tab=learners', label: 'Learners', icon: Users },
      { to: '/manager?tab=bank', label: 'Assessment Bank', icon: FileText },
      // SME Kit only for Editing dept managers
      ...(isEditingDept ? [{ to: '/manager?tab=smekit', label: 'Spellbook — SME Kit', icon: BookOpen }] : []),
      { to: '/manager?tab=team', label: 'Manage Team', icon: UserPlus },
    ];
  } else if (user.role === ROLES.ADMIN) {
    items = [
      { to: '/admin', label: 'Overview', icon: Home },
      { to: '/admin/users', label: 'Users', icon: Users },
    ];
  }

  const roleBadge = {
    [ROLES.NEW_JOINER]: { label: 'New Joiner', color: 'bg-emerald-100 text-emerald-700' },
    [ROLES.EMPLOYEE]: { label: 'Employee', color: 'bg-indigo-100 text-indigo-700' },
    [ROLES.MANAGER]: { label: 'Manager', color: 'bg-amber-100 text-amber-700' },
    [ROLES.ADMIN]: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  }[user.role];

  const managerName = user.manager_name;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-7 h-7 text-indigo-600" />
          <span className="font-bold text-lg text-gray-900">AI-powered Learning Space</span>
        </div>
        <p className="text-xs text-gray-400">Upskill &middot; Reskill &middot; Train</p>
      </div>

      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Avatar with role-specific gradient */}
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md shrink-0 ${
            user.role === ROLES.ADMIN ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200' :
            user.role === ROLES.MANAGER ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200' :
            user.role === ROLES.EMPLOYEE ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200' :
            'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200'
          }`}>
            {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
            <span className={`inline-flex items-center gap-1 mt-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold ${roleBadge.color}`}>
              {roleBadge.label}
            </span>
          </div>
        </div>
        {/* Department & Manager info */}
        {(user.department || managerName) && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            {user.department && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <FolderOpen className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{user.department}</span>
              </p>
            )}
            {managerName && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">Manager: {managerName}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item, idx) => {
          const hasQueryParams = item.to.includes('?');
          return (
          <NavLink
            key={idx}
            to={item.to}
            end={!hasQueryParams && (item.to === '/training' || item.to === '/upskilling' || item.to === '/admin')}
            className={({ isActive }) => {
              // For query-param links, check if current URL search matches
              let active = isActive;
              if (hasQueryParams) {
                const [path, query] = item.to.split('?');
                const params = new URLSearchParams(query);
                const currentParams = new URLSearchParams(window.location.search);
                active = window.location.pathname === path && params.get('tab') === currentParams.get('tab');
              }
              return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`;
            }}
          >
            <item.icon className="w-4.5 h-4.5" />
            {item.label}
          </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100 space-y-1">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}