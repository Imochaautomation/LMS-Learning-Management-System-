import { useState, useEffect } from 'react';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { UserPlus, Trash2, X, Loader2, Search, Eye, EyeOff, AlertTriangle, RefreshCw, Copy, Pencil, Check } from 'lucide-react';

const roleBadge = {
  admin: 'bg-red-50 text-red-700',
  manager: 'bg-amber-50 text-amber-700',
  new_joiner: 'bg-emerald-50 text-emerald-700',
  employee: 'bg-indigo-50 text-indigo-700',
};

const roleLabel = {
  admin: 'Admin',
  manager: 'Manager',
  new_joiner: 'New Joiner',
  employee: 'Employee',
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [copied, setCopied] = useState(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: pwd }));
  };

  const loadUsers = () => {
    api.get('/admin/users').then(setUsers).catch(() => setUsers([]));
  };

  useEffect(() => { loadUsers(); }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (roleLabel[u.role] || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const pagedUsers = filteredUsers.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const rangeStart = filteredUsers.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(page * rowsPerPage, filteredUsers.length);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'manager', department: '' });
      setPage(1);
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePassword = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyCredentials = (u) => {
    const text = `Name: ${u.name}\nEmail: ${u.email}\nPassword: ${u.plain_password || '(hidden)'}\nRole: ${roleLabel[u.role]}\nDepartment: ${u.department || '-'}`;
    navigator.clipboard.writeText(text);
    setCopied(u.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const openEdit = (u) => {
    setEditForm({ id: u.id, name: u.name, email: u.email, password: '', role: u.role, department: u.department || '' });
    setEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const payload = { name: editForm.name, email: editForm.email, role: editForm.role, department: editForm.department };
      if (editForm.password) payload.password = editForm.password;
      await api.put(`/admin/users/${editForm.id}`, payload);
      setEditModal(null);
      loadUsers();
    } catch (err) {
      console.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteModal.id}`);
      setDeleteModal(null);
      loadUsers();
    } catch (err) {
      console.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <BackButton to="/admin" label="Back to Admin" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage admin & manager accounts.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Create User
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">New User</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password *</label>
              <div className="flex gap-2">
                <input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter or generate"
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                <button type="button" onClick={generatePassword}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-200 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Role *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Department</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                <option value="">Select Department</option>
                <option value="Content">Content</option>
                <option value="Customer Success">Customer Success</option>
                <option value="Engineering">Engineering</option>
                <option value="Finance">Finance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="IT Services">IT Services</option>
                <option value="Product Marketing">Product Marketing</option>
                <option value="Sales">Sales</option>
                <option value="Product">Product</option>
                <option value="Channel Sales">Channel Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="Marketing (Business Development)">Marketing (Business Development)</option>
                <option value="Pre-Sales & Solutioning">Pre-Sales & Solutioning</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create User
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input placeholder="Search by name, email, or role..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Password</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Department</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedUsers.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                      {u.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-medium text-gray-900">{u.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                <td className="px-5 py-3.5">
                  {u.plain_password ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-mono text-xs">
                        {visiblePasswords[u.id] ? u.plain_password : '••••••••'}
                      </span>
                      <button onClick={() => togglePassword(u.id)} className="p-1 text-gray-400 hover:text-indigo-600 rounded" title={visiblePasswords[u.id] ? 'Hide' : 'Show'}>
                        {visiblePasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-500">{u.department || '—'}</td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => copyCredentials(u)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Copy credentials">
                      {copied === u.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit user">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteModal({ id: u.id, name: u.name })} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete user">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No users found.</p>}
      </div>

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <div className="flex items-center justify-end gap-6 text-sm text-gray-600 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none pr-6"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <span className="text-gray-500 font-medium">{rangeStart}–{rangeEnd} of {filteredUsers.length}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Edit User</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Password (leave blank to keep)</label>
                <input value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="new_joiner">New Joiner</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="">Select Department</option>
                  <option value="Content">Content</option>
                  <option value="Customer Success">Customer Success</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Finance">Finance</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="IT Services">IT Services</option>
                  <option value="Product Marketing">Product Marketing</option>
                  <option value="Sales">Sales</option>
                  <option value="Product">Product</option>
                  <option value="Channel Sales">Channel Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Marketing (Business Development)">Marketing (Business Development)</option>
                  <option value="Pre-Sales & Solutioning">Pre-Sales & Solutioning</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(null)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={editSaving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete User</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong className="text-gray-900">{deleteModal.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
