import { useState, useEffect } from 'react';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Download, Search, FileText, BookOpen } from 'lucide-react';

const categoryIcon = { 'Style Guide': '📘', 'Formatting': '📋', 'Reference': '📎', 'Examples': '📝' };
const categoryColor = {
  'Style Guide': 'bg-blue-50 text-blue-600',
  'Formatting': 'bg-purple-50 text-purple-600',
  'Reference': 'bg-amber-50 text-amber-600',
  'Examples': 'bg-emerald-50 text-emerald-600',
};

export default function SmeKit() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/banks/smekit').then(setFiles).catch(() => {});
  }, []);

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = (file) => {
    if (file.file_path) {
      window.open(`http://localhost:8000${file.file_path}`, '_blank');
    }
  };

  const handleDownloadAll = () => {
    files.forEach((f) => {
      if (f.file_path) window.open(`http://localhost:8000${f.file_path}`, '_blank');
    });
  };

  return (
    <div className="space-y-6">
      <BackButton to="/training" label="Back to Dashboard" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📚 Spellbook — SME Training Kit</h1>
          <p className="text-sm text-gray-500 mt-1">Study these materials before starting assessments.</p>
        </div>
        <button onClick={handleDownloadAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">
          <Download className="w-4 h-4" /> Download All
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      </div>

      <div className="space-y-2">
        {filtered.map((file) => (
          <div key={file.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <span className="text-xl">{categoryIcon[file.category] || '📄'}</span>
              <div>
                <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[file.category] || 'bg-gray-100 text-gray-500'}`}>
                    {file.category || 'General'}
                  </span>
                  <span className="text-xs text-gray-400">{file.file_type || 'PDF'}</span>
                </div>
              </div>
            </div>
            <button onClick={() => handleDownload(file)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                file.file_path ? 'text-teal-600 border border-teal-200 hover:bg-teal-50' : 'text-gray-300 cursor-not-allowed'
              }`} disabled={!file.file_path}>
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No files found.</p>}
      </div>
      <p className="text-xs text-gray-400 text-center">{files.length} files in Spellbook</p>
    </div>
  );
}
