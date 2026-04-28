import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, AlertCircle, Loader2, Brain, BarChart3, BookOpen, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const ORANGE = '#F05A28';
const NAVY = '#1E1040';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake]       = useState(false);
  const { login, roleRoute }    = useAuth();
  const navigate                = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShake(false);
    if (!email.trim())    { setError('Please enter your email address'); triggerShake(); return; }
    if (!password.trim()) { setError('Please enter your password');      triggerShake(); return; }
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(roleRoute(user.role), { replace: true });
    } catch (err) {
      const msg = err.message || 'Invalid credentials';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('email')) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Unable to connect to server. Please check your connection.');
      } else {
        setError(msg);
      }
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600); };


  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" }}>

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[58%] flex-col justify-between p-12 relative overflow-hidden" style={{ background: `linear-gradient(140deg, ${NAVY} 0%, #2D1B6B 60%, #1B3A8A 100%)` }}>
        {/* Glow blobs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none" style={{ background: ORANGE, opacity: 0.09, filter: 'blur(80px)' }} />
        <div className="absolute bottom-16 -left-12 w-64 h-64 rounded-full pointer-events-none" style={{ background: '#60A5FA', opacity: 0.06, filter: 'blur(70px)' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <img src="/logoimocha.png" alt="iMocha" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          <div className="h-5 w-px bg-white/20 mx-1" />
          <span className="text-white/60 text-xs font-semibold tracking-wide uppercase">AI Learning Space</span>
        </div>

        {/* Hero copy */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold mb-8" style={{ background: 'rgba(240,90,40,0.18)', color: '#FCA06A', border: '1px solid rgba(240,90,40,0.35)' }}>
            ⚡ AI-Powered Skills Intelligence
          </div>

          <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-3">
            Skills Visibility.<br />
            <span style={{ color: ORANGE }}>Business Agility.</span>
          </h1>
          <p className="text-blue-200/70 text-sm leading-relaxed max-w-sm mb-10">
            Identify skill gaps with AI interviews, get visual gap analysis, and follow personalized learning paths — for every role in your organization.
          </p>

          <div className="space-y-4">
            {[
              { icon: Brain,    color: ORANGE,    bg: 'rgba(240,90,40,0.15)',  label: 'AI Interview Engine',   sub: 'Adaptive 10-question skill assessment' },
              { icon: BarChart3, color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', label: 'Skill Gap Analysis',    sub: 'Visual reports with learning roadmaps' },
              { icon: BookOpen, color: '#38BDF8',  bg: 'rgba(56,189,248,0.15)', label: 'Personalized Courses',  sub: 'AI-matched to your specific gaps' },
            ].map(({ icon: Icon, color, bg, label, sub }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{label}</div>
                  <div className="text-blue-200/60 text-xs">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative border-t border-white/10 pt-6">
          <p className="text-blue-100/50 text-xs italic leading-relaxed">
            "Your AI-powered skills intelligence layer for smarter workforce decisions"
          </p>
          <div className="flex items-center gap-2 mt-2">
            <img src="/logoimocha.png" alt="iMocha" className="h-4 w-auto" style={{ filter: 'brightness(0) invert(1)', opacity: 0.35 }} />
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-10 py-16 bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src="/logoimocha.png" alt="iMocha" className="h-8 w-auto mx-auto" />
          </div>

          {/* Back link */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-10 transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back to home
          </Link>

          <h2 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Welcome back</h2>
          <p className="text-base text-gray-400 mb-10">Sign in to access your learning dashboard</p>

          {/* Error */}
          {error && (
            <div className={`flex items-start gap-2.5 px-4 py-3 mb-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 ${shake ? 'animate-shake' : ''}`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={`space-y-5 ${shake && !error ? 'animate-shake' : ''}`}>
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-4 py-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white transition-all"
                  style={{ '--tw-ring-color': ORANGE }}
                  onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 3px rgba(240,90,40,0.12)`; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-10 py-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white transition-all"
                  onFocus={e => { e.target.style.borderColor = ORANGE; e.target.style.boxShadow = `0 0 0 3px rgba(240,90,40,0.12)`; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 text-white text-base font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md mt-2"
              style={{ background: ORANGE }}
              onMouseEnter={e => { if (!submitting) e.target.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.target.style.opacity = '1'; }}
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-10">
            Powered by <span className="font-bold" style={{ color: ORANGE }}>iMocha</span> · AI Skills Intelligence
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          15%,45%,75%{transform:translateX(-4px)}
          30%,60%,90%{transform:translateX(4px)}
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
