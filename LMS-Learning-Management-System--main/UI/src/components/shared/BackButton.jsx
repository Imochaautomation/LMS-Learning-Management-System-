import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ to, label = 'Back' }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium mb-4 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
