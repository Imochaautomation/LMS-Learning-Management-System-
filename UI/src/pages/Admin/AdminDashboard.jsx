import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Users, UserPlus, Shield, BookOpen } from 'lucide-react';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get('/admin/users').then(setUsers).catch(() => setUsers([
      { id: 99, name: 'Admin', role: 'admin', department: 'Management' },
      { id: 4, name: 'Neha Gupta', role: 'manager', department: 'Editing' },
      { id: 7, name: 'Ravi Kumar', role: 'manager', department: 'QA' },
      { id: 1, name: 'Priya Sharma', role: 'new_joiner', department: 'Editing' },
      { id: 5, name: 'Rohit Verma', role: 'new_joiner', department: 'Editing' },
      { id: 2, name: 'Arjun Nair', role: 'employee', department: 'Editing' },
      { id: 3, name: 'Sameer Patel', role: 'employee', department: 'Editing' },
      { id: 6, name: 'Meera Joshi', role: 'employee', department: 'Editing' },
    ]));
  }, []);

  const counts = {
    total: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    manager: users.filter((u) => u.role === 'manager').length,
    new_joiner: users.filter((u) => u.role === 'new_joiner').length,
    employee: users.filter((u) => u.role === 'employee').length,
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Admin Panel</h1>
        <p className="text-gray-300 text-sm">Manage users and roles.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: counts.total, icon: Users, color: '', iconStyle: { background: 'rgba(240,90,40,0.1)', color: '#F05A28' } },
          { label: 'Managers', value: counts.manager, icon: Shield, color: 'bg-amber-50 text-amber-600' },
          { label: 'New Joiners', value: counts.new_joiner, icon: UserPlus, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Employees', value: counts.employee, icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${s.color}`} style={s.iconStyle || {}}><s.icon className="w-5 h-5" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/admin/users" className="flex items-center gap-4 p-4 rounded-xl hover:opacity-90 transition-colors" style={{ background: 'rgba(240,90,40,0.08)' }}>
            <div className="p-3 rounded-xl" style={{ background: '#F05A28' }}><UserPlus className="w-5 h-5 text-white" /></div>
            <div>
              <p className="font-semibold text-gray-900">Create Account</p>
              <p className="text-sm text-gray-500">Add admin or manager accounts</p>
            </div>
          </Link>
          <Link to="/admin/users" className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="p-3 bg-gray-700 rounded-xl"><Users className="w-5 h-5 text-white" /></div>
            <div>
              <p className="font-semibold text-gray-900">Manage Users</p>
              <p className="text-sm text-gray-500">View, edit, or remove user accounts</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}