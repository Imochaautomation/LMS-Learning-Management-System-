import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const { login, roleRoute } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShake(false);

    if (!email.trim()) { setError('Please enter your email address'); triggerShake(); return; }
    if (!password.trim()) { setError('Please enter your password'); triggerShake(); return; }

    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(roleRoute(user.role), { replace: true });
    } catch (err) {
      const msg = err.message || 'Invalid credentials';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('email')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Unable to connect to server. Please check your connection and try again.');
      } else {
        setError(msg);
      }
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LMS Platform</h1>
          <p className="text-gray-500 mt-2">Upskill &middot; Reskill &middot; Train</p>
        </div>

        <div className={`bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 transition-transform ${shake ? 'animate-shake' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to access your dashboard</p>

          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 mb-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className={`w-full pl-10 pr-4 py-3 text-sm bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 focus:bg-white transition-all ${error && !email ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className={`w-full pl-10 pr-4 py-3 text-sm bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 focus:bg-white transition-all ${error && !password ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-6 bg-white/60 backdrop-blur rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Test Credentials</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-700">Admin</p>
              <p className="text-gray-400">admin@company.com / admin123</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-700">Manager</p>
              <p className="text-gray-400">neha@company.com / neha123</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-700">New Joiner</p>
              <p className="text-gray-400">priya@company.com / priya123</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-700">Employee</p>
              <p className="text-gray-400">arjun@company.com / arjun123</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
