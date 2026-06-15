import { useState, useEffect } from 'react';
import api, { API_HOST } from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Download, BookOpen, ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';

const TEAL = '#0d9488';

const fileTypeIcon = (ft) => {
  if (ft === 'youtube') return '▶';
  if (ft === 'video') return '🎬';
  return '📄';
};

export default function SmeKit() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/training/assignments/mine')
      .then(setAssignments)
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: TEAL }} />
      </div>
    );
  }

  const totalFiles = assignments.reduce((s, a) => s + (a.kit?.files?.length || 0), 0);

  return (
    <div className="space-y-6">
      <BackButton to="/training" label="Back to Dashboard" />

      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
        <h1 className="text-2xl font-bold mb-1">📚 SME Training Kit</h1>
        <p className="text-teal-100 text-sm">Study these materials before taking your AI quizzes.</p>
        {assignments.length > 0 && (
          <p className="text-teal-200 text-xs mt-2">{assignments.length} kit{assignments.length > 1 ? 's' : ''} · {totalFiles} file{totalFiles !== 1 ? 's' : ''} assigned</p>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">No kits assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Your manager will assign SME Kit resources to you. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const kit = a.kit;
            if (!kit) return null;
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
                {/* Kit header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
                    📚
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{kit.name}</span>
                      {kit.sub_department && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">{kit.sub_department}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {kit.files?.length || 0} file{kit.files?.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {kit.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{kit.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">Assigned {a.assigned_at?.split('T')[0]}</p>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {/* Files */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-2">
                    {(!kit.files || kit.files.length === 0) ? (
                      <p className="text-sm text-gray-400 py-2">No files in this kit yet.</p>
                    ) : (
                      kit.files.map((f) => (
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
                          <div className="shrink-0 ml-2">
                            {f.youtube_url ? (
                              <a
                                href={f.youtube_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-red-500 hover:bg-red-600">
                                <ExternalLink className="w-3.5 h-3.5" /> Watch
                              </a>
                            ) : f.file_path ? (
                              <a
                                href={`${API_HOST}/uploads/${f.file_path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                                style={{ color: TEAL, borderColor: TEAL }}>
                                <Download className="w-3.5 h-3.5" /> Download
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">No file</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
