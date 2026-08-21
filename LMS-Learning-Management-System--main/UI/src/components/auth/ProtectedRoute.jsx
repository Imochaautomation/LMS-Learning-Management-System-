import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, activeView } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  const effectiveRole = activeView || user.role;
  if (roles && !roles.includes(user.role) && !roles.includes(effectiveRole)) {
    const fallback = { manager: '/manager', employee: '/upskilling', admin: '/admin', new_joiner: '/training' };
    return <Navigate to={fallback[user.role] || '/login'} replace />;
  }

  return children;
}

