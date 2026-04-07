import { useState, useEffect, useRef } from 'react';
import api, { API_HOST } from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Download, Upload, Plus, CheckCircle2, Clock, ExternalLink, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const statusLabel = { pending: 'Pending', downloaded: 'Downloaded', submitted: 'Submitted', reviewed: 'Reviewed' };
const statusColor = {
  pending: 'bg-gray-100 text-gray-600', downloaded: 'bg-blue-50 text-blue-700',
  submitted: 'bg-amber-50 text-amber-700', reviewed: 'bg-emerald-50 text-emerald-700',
};

export default function UpskillAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/assessments/my').then(setAssessments).catch(() => {});
  }, []);

  const handleDownload = async (a) => {
    if (a.status === 'pending') {
      await api.patch(`/assessments/${a.id}/status?status=downloaded`).catch(() => {});
      setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'downloaded' } : x));
    }
    // Download the original assessment file from the bank
    if (a.assessment_file_path) {
      window.open(`${API_HOST}${a.assessment_file_path}`, '_blank');
    }
  };

  const handleUpload = async (a) => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload(`/assessments/${a.id}/submit`, fd);
      setAssessments((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'submitted' } : x));
      fileRef.current.value = '';
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const pending = assessments.filter((a) => a.status !== 'reviewed' && a.status !== 'submitted');
  const completed = assessments.filter((a) => a.status === 'reviewed' || a.status === 'submitted');

  return (
    <div className="space-y-6">
      <BackButton to="/upskilling" label="Back to Dashboard" />
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Assessments</h1>
        <p className="text-sm text-gray-500 mt-1">AI-generated assessments based on your profile and goals.</p>
      </div>

      {assessments.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No assessments assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Your trainer or manager will assign assessments based on your profile.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending</h2>
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{a.assessment_name}</p>
                      <p className="text-xs text-gray-400">Assigned by {a.assigner_name} · {new Date(a.assigned_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                    {expanded === a.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {expanded === a.id && (
                  <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                    {a.note && <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">Note: {a.note}</p>}
                    <button onClick={() => handleDownload(a)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                      <Download className="w-4 h-4" /> Download Assessment
                    </button>
                    {(a.status === 'downloaded' || a.status === 'pending') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Upload Completed Work</label>
                        <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.pdf"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700" />
                        <button disabled={uploading} onClick={() => handleUpload(a)}
                          className="mt-2 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Completed / Submitted</h2>
          <div className="space-y-3">
            {completed.map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{a.assessment_name}</p>
                    <p className="text-xs text-gray-400">Assigned by {a.assigner_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.submission_path && (
                    <a href={`${API_HOST}${a.submission_path}`} target="_blank"
                      className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View Submission
                    </a>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
