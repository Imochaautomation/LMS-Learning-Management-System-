import { Link } from 'react-router-dom';
import { Brain, BarChart3, BookOpen, Users, TrendingUp, Shield, ChevronRight, Zap, GraduationCap, Target, Award } from 'lucide-react';

const ORANGE = '#F05A28';
const NAVY = '#1E1040';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" }}>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logoimocha.png" alt="iMocha" className="h-10 w-auto" />
            <div className="h-6 w-px bg-gray-200" />
            <span className="text-sm font-bold tracking-widest uppercase" style={{ color: NAVY, letterSpacing: '0.08em' }}>AI Learning Space</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-base font-medium text-gray-500 hover:text-gray-900 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              Sign In
            </Link>
            <Link to="/login" className="text-base font-bold text-white px-6 py-3 rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-2" style={{ background: ORANGE }}>
              Get Started <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <style>{`
        @keyframes float-slow { 0%,100%{transform:translateY(0) translateX(0) scale(1)} 33%{transform:translateY(-22px) translateX(10px) scale(1.04)} 66%{transform:translateY(12px) translateX(-8px) scale(0.97)} }
        @keyframes float-mid  { 0%,100%{transform:translateY(0) translateX(0) scale(1)} 40%{transform:translateY(18px) translateX(-14px) scale(1.06)} 70%{transform:translateY(-10px) translateX(6px) scale(0.96)} }
        @keyframes float-fast { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-28px) translateX(16px)} }
        @keyframes aurora     { 0%,100%{opacity:0.13;transform:scale(1) rotate(0deg)} 50%{opacity:0.22;transform:scale(1.15) rotate(8deg)} }
        @keyframes particle   { 0%{transform:translateY(0) translateX(0);opacity:0} 10%{opacity:1} 90%{opacity:0.6} 100%{transform:translateY(-120px) translateX(var(--dx));opacity:0} }
        @keyframes spin-slow  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .hero-particle { animation: particle var(--dur,6s) linear infinite; animation-delay: var(--delay,0s); }
        .aurora-blob   { animation: aurora var(--adur,8s) ease-in-out infinite; animation-delay: var(--adelay,0s); }
      `}</style>
      <section className="relative pt-36 pb-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #2D1B6B 55%, #1B3A8A 100%)` }}>
        {/* Aurora blobs */}
        <div className="aurora-blob absolute -top-40 -right-40 w-[620px] h-[620px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`, opacity: 0.13, filter: 'blur(80px)', '--adur': '9s', '--adelay': '0s' }} />
        <div className="aurora-blob absolute top-1/2 -left-48 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', opacity: 0.15, filter: 'blur(90px)', '--adur': '11s', '--adelay': '2s' }} />
        <div className="aurora-blob absolute -bottom-20 right-1/3 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)', opacity: 0.12, filter: 'blur(70px)', '--adur': '13s', '--adelay': '1s' }} />
        <div className="aurora-blob absolute top-10 left-1/2 w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`, opacity: 0.07, filter: 'blur(60px)', '--adur': '7s', '--adelay': '3s' }} />

        {/* Floating particles */}
        {[
          { left:'10%', top:'80%', size:3, dur:'7s', delay:'0s',  dx:'20px',  color:'rgba(240,90,40,0.7)' },
          { left:'20%', top:'85%', size:2, dur:'9s', delay:'1.5s',dx:'-15px', color:'rgba(255,255,255,0.5)' },
          { left:'35%', top:'90%', size:4, dur:'6s', delay:'0.8s',dx:'25px',  color:'rgba(124,58,237,0.6)' },
          { left:'50%', top:'88%', size:2, dur:'8s', delay:'2s',  dx:'-10px', color:'rgba(240,90,40,0.5)' },
          { left:'63%', top:'82%', size:3, dur:'10s',delay:'0.3s',dx:'18px',  color:'rgba(255,255,255,0.4)' },
          { left:'75%', top:'86%', size:2, dur:'7s', delay:'1.2s',dx:'-20px', color:'rgba(96,165,250,0.6)' },
          { left:'85%', top:'90%', size:4, dur:'9s', delay:'0.6s',dx:'12px',  color:'rgba(240,90,40,0.4)' },
          { left:'92%', top:'84%', size:2, dur:'6s', delay:'2.5s',dx:'-8px',  color:'rgba(255,255,255,0.3)' },
          { left:'5%',  top:'70%', size:3, dur:'11s',delay:'1s',  dx:'22px',  color:'rgba(124,58,237,0.5)' },
          { left:'42%', top:'75%', size:2, dur:'8s', delay:'3s',  dx:'-18px', color:'rgba(255,255,255,0.35)'},
          { left:'58%', top:'78%', size:3, dur:'7s', delay:'1.8s',dx:'14px',  color:'rgba(96,165,250,0.5)' },
          { left:'28%', top:'92%', size:2, dur:'9s', delay:'0.4s',dx:'-12px', color:'rgba(240,90,40,0.6)' },
        ].map((p, i) => (
          <div key={i} className="hero-particle absolute rounded-full pointer-events-none"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size, background: p.color,
              '--dur': p.dur, '--delay': p.delay, '--dx': p.dx, boxShadow: `0 0 ${p.size * 3}px ${p.color}` }} />
        ))}

        {/* Animated grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Rotating ring accent */}
        <div className="absolute top-1/2 left-1/2 pointer-events-none" style={{ width: 700, height: 700, marginLeft: -350, marginTop: -350, animation: 'spin-slow 30s linear infinite', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '50%' }} />
        <div className="absolute top-1/2 left-1/2 pointer-events-none" style={{ width: 500, height: 500, marginLeft: -250, marginTop: -250, animation: 'spin-slow 20s linear infinite reverse', border: '1px solid rgba(240,90,40,0.05)', borderRadius: '50%' }} />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-8" style={{ background: 'rgba(240,90,40,0.18)', color: '#FCA06A', border: '1px solid rgba(240,90,40,0.35)' }}>
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Skills Intelligence Platform
          </div>

          <h1 className="text-5xl md:text-[4rem] font-black text-white leading-[1.1] tracking-tight mb-6">
            Skills Visibility.<br />
            <span style={{ color: ORANGE }}>Business Agility.</span>
          </h1>

          <p className="text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            Identify skill gaps, design personalized learning paths, and transform your workforce to continuous upskilling.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base shadow-lg hover:opacity-90 transition-all" style={{ background: ORANGE }}>
              Start Learning Free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white/80 text-base transition-all" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)' }}>
              Explore Features
            </a>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/10">
            {[
              { value: 'AI Interview', sub: 'Adaptive 10-question engine' },
              { value: 'Skill Radar', sub: 'Visual gap analysis' },
              { value: '4 Roles', sub: 'Admin · Manager · Employee · New Joiner' },
              { value: 'Auto-Courses', sub: 'AI-matched recommendations' },
            ].map(({ value, sub }) => (
              <div key={value} className="text-center px-3 py-2">
                <div className="text-base font-bold text-white">{value}</div>
                <div className="text-xs text-blue-200/70 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24" style={{ background: '#F8F9FC' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ORANGE }}>Platform Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ color: NAVY }}>Everything your workforce needs</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Continuous upskilling, skill gap analysis, and AI-powered learning — one platform, full visibility.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Brain, color: ORANGE, bg: '#FFF4EE', border: '#FFD5C2', title: 'AI Interview Engine', desc: 'Adaptive 10-question interviews that dynamically follow up on answers — revealing true skill depth, not surface-level responses.', tags: ['Conversational AI', 'Adaptive Q&A', 'Auto-scoring'] },
              { icon: BarChart3, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', title: 'Skill Gap Analysis', desc: 'Visual radar charts, severity-ranked skill cards, and personalized learning roadmaps — generated automatically from interview data.', tags: ['Radar Charts', 'Severity Scoring', 'Learning Roadmap'] },
{ icon: Users, color: '#10B981', bg: '#F0FDF4', border: '#A7F3D0', title: 'Manager Intelligence', desc: 'Monitor team skill progress, review individual learner growth, and track course completions — all from a single manager dashboard.', tags: ['Team Overview', 'Learner Progress', 'Course Tracking'] },
              { icon: TrendingUp, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', title: 'Course Recommendations', desc: 'AI matches skill gaps to real courses on Coursera, Udemy, LinkedIn Learning and more — with direct enrollment links.', tags: ['AI-Matched', 'Multi-platform', 'Gap-targeted'] },
              { icon: Shield, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', title: 'Role-Based Access', desc: 'Fine-grained access control for admins, managers, employees, and new joiners — everyone sees exactly what they need, nothing more.', tags: ['4 Roles', 'Secure JWT', 'Route Guards'] },
            ].map(({ icon: Icon, color, bg, border, title, desc, tags }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border hover:shadow-lg transition-all duration-200 group" style={{ borderColor: border }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-105" style={{ background: bg }}>
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">{desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: bg, color, border: `1px solid ${border}` }}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ORANGE }}>Get Started in Minutes</p>
            <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ color: NAVY }}>How it works</h2>
            <p className="text-gray-400">Three steps from sign-in to a personalized learning roadmap</p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-10">
            {/* Dashed connector */}
            <div className="hidden md:block absolute top-10 left-[calc(33%+24px)] right-[calc(33%+24px)] border-t-2 border-dashed border-orange-100" />
            {[
              { step: '01', icon: Target, title: 'Set Your Profile', desc: 'Add your role, experience, and learning goals. Upload your resume for context-aware interview questions.', color: ORANGE },
              { step: '02', icon: Brain, title: 'Take the AI Interview', desc: 'Chat with our AI interviewer. 10 adaptive questions reveal your actual skill levels across key competencies.', color: '#7C3AED' },
              { step: '03', icon: Award, title: 'Get Your Roadmap', desc: 'Instantly see your skill gap analysis, severity scores, and a personalized list of courses to close the gaps.', color: '#0EA5E9' },
            ].map(({ step, icon: Icon, title, desc, color }) => (
              <div key={step} className="text-center relative">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg relative z-10" style={{ background: color }}>
                  <Icon className="w-9 h-9 text-white" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 text-xs font-black flex items-center justify-center" style={{ borderColor: color, color }}>{step}</span>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-[220px] mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role highlights ── */}
      <section className="py-20" style={{ background: '#F8F9FC' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ORANGE }}>Built for Everyone</p>
            <h2 className="text-3xl font-black" style={{ color: NAVY }}>One platform, four roles</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { emoji: '🎓', role: 'New Joiner', color: '#0d9488', bg: '#F0FDFA', border: '#99F6E4', points: ['SME Kit access', 'AI training assessments', 'Training course tracking', 'Onboarding dashboard'] },
              { emoji: '📈', role: 'Employee', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', points: ['AI skill interview', 'Gap analysis dashboard', 'Course recommendations', 'Skill radar chart'] },
              { emoji: '👩‍💼', role: 'Manager', color: ORANGE, bg: '#FFF4EE', border: '#FFD5C2', points: ['Team skill overview', 'Individual learner views', 'Assign SME Kit & quizzes', 'Track training progress'] },
              { emoji: '⚙️', role: 'Admin', color: '#10B981', bg: '#F0FDF4', border: '#A7F3D0', points: ['User management', 'Role assignment', 'System overview', 'Full data access'] },
            ].map(({ emoji, role, color, bg, border, points }) => (
              <div key={role} className="bg-white rounded-2xl p-6 border" style={{ borderColor: border }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: bg }}>{emoji}</div>
                <h3 className="font-bold text-base mb-3" style={{ color }}>{role}</h3>
                <ul className="space-y-1.5">
                  {points.map(p => <li key={p} className="text-xs text-gray-500 flex items-start gap-1.5"><span style={{ color }} className="mt-0.5">✓</span>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #2D1B6B 100%)` }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6" style={{ background: 'rgba(240,90,40,0.2)' }}>
            <GraduationCap className="w-8 h-8" style={{ color: ORANGE }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to close your skill gaps?</h2>
          <p className="text-blue-200/80 mb-8 text-lg max-w-xl mx-auto">Sign in and complete your first AI interview in under 10 minutes. Get a personalized skill report instantly.</p>
          <Link to="/login" className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white text-lg shadow-xl hover:opacity-90 transition-all" style={{ background: ORANGE }}>
            Get Started Now <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: NAVY }}>
        {/* Main footer content */}
        <div className="max-w-7xl mx-auto px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

            {/* Brand column */}
            <div className="md:col-span-2">
              <img src="/logoimocha.png" alt="iMocha" className="h-8 w-auto mb-4" style={{ filter: 'brightness(0) invert(1)' }} />
              <p className="text-sm text-blue-200/70 leading-relaxed max-w-xs mb-5">
                The AI-powered skills intelligence platform for smarter workforce decisions — continuous upskilling, skill visibility, and business agility.
              </p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ORANGE }}>Skills Visibility. Business Agility.</p>
            </div>

            {/* Platform links */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Platform</p>
              <ul className="space-y-2.5">
                {['AI Interview Engine', 'Skill Gap Analysis', 'Learning Roadmaps', 'Course Recommendations', 'Manager Dashboard'].map((item) => (
                  <li key={item}>
                    <Link to="/login" className="text-sm text-blue-200/60 hover:text-white transition-colors">{item}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Roles links */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">For Roles</p>
              <ul className="space-y-2.5">
                {['Employees', 'Managers', 'Admins'].map((item) => (
                  <li key={item}>
                    <Link to="/login" className="text-sm text-blue-200/60 hover:text-white transition-colors">{item}</Link>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Get Started</p>
                <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90" style={{ background: ORANGE }}>
                  Sign In →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/30">© 2026 iMocha. All rights reserved.</p>
            <p className="text-xs text-white/30">AI-Powered Learning Space · Built for the modern workforce</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
