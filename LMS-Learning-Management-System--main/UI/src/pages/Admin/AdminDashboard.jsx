import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Users, UserPlus, Shield, BookOpen, X, Building2 } from 'lucide-react';

const DEPT_COLORS = [
  { bg: 'bg-indigo-50',  badge: '#6366f1', text: 'text-indigo-700'  },
  { bg: 'bg-amber-50',   badge: '#f59e0b', text: 'text-amber-700'   },
  { bg: 'bg-emerald-50', badge: '#10b981', text: 'text-emerald-700' },
  { bg: 'bg-rose-50',    badge: '#f43f5e', text: 'text-rose-700'    },
  { bg: 'bg-cyan-50',    badge: '#06b6d4', text: 'text-cyan-700'    },
  { bg: 'bg-purple-50',  badge: '#a855f7', text: 'text-purple-700'  },
  { bg: 'bg-orange-50',  badge: '#f97316', text: 'text-orange-700'  },
  { bg: 'bg-teal-50',    badge: '#14b8a6', text: 'text-teal-700'    },
];

const ROLE_LABEL = { manager: 'Manager', employee: 'Employee', new_joiner: 'New Joiner', admin: 'Admin' };
const ROLE_BADGE  = {
  manager:    'bg-amber-100 text-amber-700',
  employee:   'bg-indigo-100 text-indigo-700',
  new_joiner: 'bg-emerald-100 text-emerald-700',
  admin:      'bg-red-100 text-red-700',
};

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);

  useEffect(() => {
    api.get('/admin/users').then(setUsers).catch(() => setUsers([
      { id: 99, name: 'Admin',        role: 'admin',      department: 'Management' },
      { id: 4,  name: 'Neha Gupta',   role: 'manager',    department: 'Editing' },
      { id: 7,  name: 'Ravi Kumar',   role: 'manager',    department: 'QA' },
      { id: 1,  name: 'Priya Sharma', role: 'new_joiner', department: 'Editing', manager_id: 4 },
      { id: 5,  name: 'Rohit Verma',  role: 'new_joiner', department: 'Editing', manager_id: 4 },
      { id: 2,  name: 'Arjun Nair',   role: 'employee',   department: 'Editing', manager_id: 4 },
      { id: 3,  name: 'Sameer Patel', role: 'employee',   department: 'Editing', manager_id: 4 },
      { id: 6,  name: 'Meera Joshi',  role: 'employee',   department: 'Editing', manager_id: 4 },
    ]));
  }, []);

  const counts = {
    admin:      users.filter((u) => u.role === 'admin').length,
    manager:    users.filter((u) => u.role === 'manager').length,
    new_joiner: users.filter((u) => u.role === 'new_joiner').length,
    employee:   users.filter((u) => u.role === 'employee').length,
  };

  const ALL_DEPARTMENTS = [
    'Channel Sales', 'Content', 'Customer Success', 'Engineering', 'Finance',
    'Human Resources', 'IT Services', 'Marketing', 'Marketing (Business Development)',
    'Pre-Sales & Solutioning', 'Product', 'Product Marketing', 'Sales',
  ];

  // Build department map from users; seed every known department so tiles always show
  const deptMap = {};
  ALL_DEPARTMENTS.forEach((d) => { deptMap[d] = { managers: [], members: [] }; });
  users.forEach((u) => {
    if (!u.department || u.role === 'admin') return;
    if (!deptMap[u.department]) deptMap[u.department] = { managers: [], members: [] };
    if (u.role === 'manager') deptMap[u.department].managers.push(u);
    else deptMap[u.department].members.push(u);
  });
  const departments = Object.keys(deptMap).sort();

  const initials = (name) =>
    (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const deptDetail = selectedDept ? deptMap[selectedDept] : null;
  const managerTeams = deptDetail
    ? deptDetail.managers.map((mgr) => ({
        manager: mgr,
        team: deptDetail.members.filter((m) => m.manager_id === mgr.id),
      }))
    : [];
  const unassigned = deptDetail
    ? deptDetail.members.filter(
        (m) => !deptDetail.managers.some((mgr) => mgr.id === m.manager_id)
      )
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Admin Panel</h1>
        <p className="text-gray-300 text-sm">Manage users and roles.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Admins',      value: counts.admin,      icon: Shield,   color: 'bg-red-50 text-red-600'         },
          { label: 'Managers',    value: counts.manager,    icon: Users,    color: 'bg-amber-50 text-amber-600'     },
          { label: 'Employees',   value: counts.employee,   icon: BookOpen, color: 'bg-blue-50 text-blue-600'       },
          { label: 'New Joiners', value: counts.new_joiner, icon: UserPlus, color: 'bg-emerald-50 text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/admin/users"
            className="flex items-center gap-4 p-4 rounded-xl hover:opacity-90 transition-colors"
            style={{ background: 'rgba(240,90,40,0.08)' }}>
            <div className="p-3 rounded-xl" style={{ background: '#F05A28' }}>
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Create Account</p>
              <p className="text-sm text-gray-500">Add admin or manager accounts</p>
            </div>
          </Link>
          <Link to="/admin/users"
            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="p-3 bg-gray-700 rounded-xl">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Manage Users</p>
              <p className="text-sm text-gray-500">View, edit, or remove user accounts</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Departments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Departments</h2>
          <span className="ml-auto text-xs text-gray-400">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {departments.map((dept, idx) => {
            const c = DEPT_COLORS[idx % DEPT_COLORS.length];
            const info = deptMap[dept];
            const isSelected = selectedDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(isSelected ? null : dept)}
                className={`relative text-left rounded-xl border-2 p-4 transition-all ${c.bg}`}
                style={
                  isSelected
                    ? { borderColor: c.badge, boxShadow: `0 0 0 3px ${c.badge}22` }
                    : { borderColor: 'transparent' }
                }
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: c.badge + '22' }}>
                  <Building2 className="w-4 h-4" style={{ color: c.badge }} />
                </div>
                <p className={`text-sm font-semibold leading-tight ${c.text} mb-1`}>{dept}</p>
                <p className="text-xs text-gray-500">
                  {info.managers.length} manager{info.managers.length !== 1 ? 's' : ''} · {info.members.length} member{info.members.length !== 1 ? 's' : ''}
                </p>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: c.badge }}>
                    <X className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Expanded dept panel */}
        {selectedDept && deptDetail && (
          <div className="mt-4 border border-gray-100 rounded-xl bg-gray-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">{selectedDept} — Team Structure</h3>
              <button
                onClick={() => setSelectedDept(null)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>

            {managerTeams.length === 0 && unassigned.length === 0 && (
              <p className="text-sm text-gray-400">No users in this department yet.</p>
            )}

            <div className="space-y-4">
              {managerTeams.map(({ manager, team }) => (
                <div key={manager.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Manager row */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
                    style={{ background: 'rgba(245,158,11,0.06)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                      {initials(manager.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{manager.name}</p>
                      {manager.designation && (
                        <p className="text-xs text-gray-500 truncate">{manager.designation}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      Manager
                    </span>
                  </div>

                  {/* Team members */}
                  {team.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {team.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-2.5 pl-8">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ background: member.role === 'employee' ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'linear-gradient(135deg,#10b981,#0d9488)' }}>
                            {initials(member.name)}
                          </div>
                          <p className="text-sm text-gray-700 flex-1 truncate">{member.name}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[member.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABEL[member.role] || member.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-8 py-2.5 text-xs text-gray-400">No team members assigned</p>
                  )}
                </div>
              ))}

              {/* Unassigned members */}
              {unassigned.length > 0 && (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unassigned</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {unassigned.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg,#94a3b8,#64748b)' }}>
                          {initials(member.name)}
                        </div>
                        <p className="text-sm text-gray-700 flex-1 truncate">{member.name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[member.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABEL[member.role] || member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

