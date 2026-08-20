import { Download, FileText, FileSpreadsheet, File } from 'lucide-react';

const typeIcon = {
  PDF: { icon: FileText, color: 'text-red-500 bg-red-50' },
  Excel: { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50' },
  Word: { icon: File, color: 'text-blue-500 bg-blue-50' },
};

export default function FileCard({ name, type, size, onDownload }) {
  const t = typeIcon[type] || typeIcon.PDF;
  const Icon = t.icon;

  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg ${t.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-400">{type} &middot; {size}</p>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        Download
      </button>
    </div>
  );
}
