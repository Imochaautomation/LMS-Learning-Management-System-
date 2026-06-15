import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { ToastContainer, useToast } from '../../components/shared/Toast';
import {
  BookOpen, Plus, Upload, Youtube, Trash2, ChevronDown, ChevronRight,
  Users, FileText, Link2, X, Check, Loader2, ExternalLink, UserCheck,
} from 'lucide-react';

const ORANGE = '#F05A28';
const TEAL = '#0d9488';

export default function SmeKitManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toasts, removeToast, toast } = useToast();

  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [expandedKit, setExpandedKit] = useState(null);

  // Create kit modal
  const [showCreateKit, setShowCreateKit] = useState(false);
  const [newKit, setNewKit] = useState({ name: '', description: '', sub_department: '' });
  const [creating, setCreating] = useState(false);

  // Add file modal
  const [fileModal, setFileModal] = useState(null); // { kitId } or null
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTranscript, setUploadTranscript] = useState('');
  const [uploading, setUploading] = useState(false);

  // Add YouTube modal
  const [ytModal, setYtModal] = useState(null); // { kitId } or null
  const [ytName, setYtName] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytTranscript, setYtTranscript] = useState('');
  const [addingYt, setAddingYt] = useState(false);

  // Assign modal
  const [assignModal, setAssignModal] = useState(null); // { kit }
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Delete confirm
  const [deleteModal, setDeleteModal] = useState(null); // { type: 'kit'|'file', kitId, fileId, name }

  const fileInputRef = useRef();

  useEffect(() => {
    Promise.all([
      api.get('/training/kits').then(setKits).catch(() => setKits([])),
      api.get('/admin/users')
        .then((all) => setTeamMembers(all.filter((u) => u.manager_id === user?.id && u.role === 'new_joiner')))
        .catch(() => setTeamMembers([])),
    ]).finally(() => setLoading(false));
  }, [user]);

  const loadKits = () => api.get('/training/kits').then(setKits).catch(() => {});

  // ── Create Kit ─────────────────────────────────────────────────────────────
  const handleCreateKit = async () => {
    if (!newKit.name.trim()) { toast.warning('Kit name is required.'); return; }
    setCreating(true);
    try {
      const kit = await api.post('/training/kits', {
        name: newKit.name.trim(),
        description: newKit.description.trim() || null,
        sub_department: newKit.sub_department.trim() || null,
      });
      setKits((p) => [kit, ...p]);
      setNewKit({ name: '', description: '', sub_department: '' });
      setShowCreateKit(false);
      toast.success(`Kit "${kit.name}" created!`);
    } catch (e) {
      toast.error(`Failed to create kit: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  // ── Upload document ─────────────────────────────────────────────────────────
  const handleUploadFile = async () => {
    if (!uploadFile) { toast.warning('Please select a file.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      if (uploadTranscript.trim()) fd.append('transcript', uploadTranscript.trim());
      await api.upload(`/training/kits/${fileModal.kitId}/files`, fd);
      await loadKits();
      setFileModal(null);
      setUploadFile(null);
      setUploadTranscript('');
      toast.success('File uploaded!');
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  // ── Add YouTube link ────────────────────────────────────────────────────────
  const handleAddYoutube = async () => {
    if (!ytName.trim() || !ytUrl.trim()) { toast.warning('Name and URL are required.'); return; }
    if (!/^https?:\/\/.+/.test(ytUrl.trim())) { toast.warning('URL must start with https://'); return; }
    setAddingYt(true);
    try {
      const fd = new FormData();
      fd.append('name', ytName.trim());
      fd.append('youtube_url', ytUrl.trim());
      if (ytTranscript.trim()) fd.append('transcript', ytTranscript.trim());
      await api.upload(`/training/kits/${ytModal.kitId}/youtube`, fd);
      await loadKits();
      setYtModal(null);
      setYtName(''); setYtUrl(''); setYtTranscript('');
      toast.success('YouTube link added!');
    } catch (e) {
      toast.error(`Failed to add YouTube link: ${e.message}`);
    } finally {
      setAddingYt(false);
    }
  };

  // ── Assign kit ──────────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignUserId) { toast.warning('Select a new joiner.'); return; }
    setAssigning(true);
    try {
      await api.post('/training/kits/assign', {
        sme_kit_id: assignModal.kit.id,
        user_id: parseInt(assignUserId),
      });
      toast.success(`Kit assigned!`);
      setAssignModal(null);
      setAssignUserId('');
    } catch (e) {
      const msg = e.message?.includes('409') ? 'Kit already assigned to this learner.' : `Failed: ${e.message}`;
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      if (deleteModal.type === 'kit') {
        await api.del(`/training/kits/${deleteModal.kitId}`);
        setKits((p) => p.filter((k) => k.id !== deleteModal.kitId));
        if (expandedKit === deleteModal.kitId) setExpandedKit(null);
        toast.success(`Kit "${deleteModal.name}" deleted.`);
      } else if (deleteModal.type === 'file') {
        await api.del(`/training/kits/${deleteModal.kitId}/files/${deleteModal.fileId}`);
        await loadKits();
        toast.success(`"${deleteModal.name}" removed from kit.`);
      }
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    }
    setDeleteModal(null);
  };

  const fileTypeIcon = (ft) => {
    if (ft === 'youtube') return '▶';
    if (ft === 'video') return '🎬';
    return '📄';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ORANGE }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #0f766e)` }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">📚 SME Kit Manager</h1>
            <p className="text-teal-100 text-sm">
              Create named training kits with documents &amp; videos, then assign them to new joiners.
            </p>
          </div>
          <button
            onClick={() => setShowCreateKit(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-sm font-semibold rounded-xl shadow hover:shadow-md transition-all"
            style={{ color: TEAL }}>
            <Plus className="w-4 h-4" /> New Kit
          </button>
        </div>
      </div>

      {/* Create Kit Panel */}
      {showCreateKit && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Create New SME Kit</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Kit Name *</label>
              <input
                value={newKit.name}
                onChange={(e) => setNewKit((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Editing Onboarding Kit"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Department</label>
              <input
                value={newKit.sub_department}
                onChange={(e) => setNewKit((p) => ({ ...p, sub_department: e.target.value }))}
                placeholder="e.g. Editing Team"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                value={newKit.description}
                onChange={(e) => setNewKit((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional short description"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateKit}
              disabled={creating || !newKit.name.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ background: TEAL }}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create Kit
            </button>
            <button
              onClick={() => { setShowCreateKit(false); setNewKit({ name: '', description: '', sub_department: '' }); }}
              className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kit list */}
      {kits.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No SME Kits yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first kit to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {kits.map((kit) => {
            const isOpen = expandedKit === kit.id;
            return (
              <div key={kit.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
                {/* Kit header row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedKit(isOpen ? null : kit.id)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
                    📚
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{kit.name}</span>
                      {kit.sub_department && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                          {kit.sub_department}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {kit.file_count} {kit.file_count === 1 ? 'file' : 'files'}
                      </span>
                    </div>
                    {kit.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{kit.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setAssignModal({ kit }); setAssignUserId(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors"
                      style={{ color: TEAL, borderColor: TEAL }}
                      title="Assign to new joiner">
                      <UserCheck className="w-3.5 h-3.5" /> Assign
                    </button>
                    <button
                      onClick={() => setDeleteModal({ type: 'kit', kitId: kit.id, name: kit.name })}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded: files + add buttons */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
                    {/* Add buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => { setFileModal({ kitId: kit.id }); setUploadFile(null); setUploadTranscript(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                        style={{ background: ORANGE }}>
                        <Upload className="w-3.5 h-3.5" /> Upload Document
                      </button>
                      <button
                        onClick={() => { setYtModal({ kitId: kit.id }); setYtName(''); setYtUrl(''); setYtTranscript(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-red-500 hover:bg-red-600">
                        <Youtube className="w-3.5 h-3.5" /> Add YouTube
                      </button>
                    </div>

                    {/* File list */}
                    {kit.files.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No files in this kit yet. Upload a document or add a YouTube link.</p>
                    ) : (
                      <div className="space-y-2">
                        {kit.files.map((f) => (
                          <div key={f.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-lg shrink-0">{fileTypeIcon(f.file_type)}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{f.file_type}</span>
                                  {f.transcript && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">transcript ✓</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {f.youtube_url && (
                                <a href={f.youtube_url} target="_blank" rel="noreferrer"
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Open YouTube">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => setDeleteModal({ type: 'file', kitId: kit.id, fileId: f.id, name: f.name })}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      {fileModal && (
        <Modal title="Upload Document" onClose={() => setFileModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">File *</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="w-full text-sm"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,.webm"
              />
              <p className="text-xs text-gray-400 mt-1">PDF, Word, PowerPoint, text files or video</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Transcript / Summary <span className="text-gray-400">(optional — helps AI generate better questions)</span>
              </label>
              <textarea
                value={uploadTranscript}
                onChange={(e) => setUploadTranscript(e.target.value)}
                rows={4}
                placeholder="Paste transcript or key content here..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleUploadFile}
              disabled={uploading || !uploadFile}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ background: ORANGE }}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
            <button onClick={() => setFileModal(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
          </div>
        </Modal>
      )}

      {/* YouTube Modal */}
      {ytModal && (
        <Modal title="Add YouTube Link" onClose={() => setYtModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input
                value={ytName}
                onChange={(e) => setYtName(e.target.value)}
                placeholder="e.g. Intro to Content Editing"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">YouTube URL *</label>
              <input
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Transcript <span className="text-gray-400">(optional — greatly improves question quality)</span>
              </label>
              <textarea
                value={ytTranscript}
                onChange={(e) => setYtTranscript(e.target.value)}
                rows={4}
                placeholder="Paste video transcript here..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddYoutube}
              disabled={addingYt || !ytName.trim() || !ytUrl.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50">
              {addingYt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
              Add
            </button>
            <button onClick={() => setYtModal(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <Modal title={`Assign "${assignModal.kit.name}"`} onClose={() => setAssignModal(null)}>
          <p className="text-sm text-gray-500 mb-3">Select a new joiner from your team to assign this kit to.</p>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No new joiners in your team yet.</p>
          ) : (
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="">— Select new joiner —</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAssign}
              disabled={assigning || !assignUserId}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ background: TEAL }}>
              {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Assign Kit
            </button>
            <button onClick={() => setAssignModal(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <Modal title="Confirm Delete" onClose={() => setDeleteModal(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete <strong>{deleteModal.name}</strong>?
            {deleteModal.type === 'kit' && ' This will also remove all files inside this kit.'}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
            <button onClick={confirmDelete} className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
