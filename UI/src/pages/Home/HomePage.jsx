import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../data/mockData';
import { BookOpen, TrendingUp, GraduationCap, Users, Shield } from 'lucide-react';

const modules = [
  {
    id: 'training',
    title: 'Training & Onboarding',
    desc: 'For new joiners — study SME Kit, take assessments, receive AI feedback, and get course recommendations.',
    icon: BookOpen,
    color: 'from-emerald-500 to-teal-600',
    roles: ['New Joiner', 'Trainer'],
    features: ['SME Kit Library', 'Assessment Rounds', 'AI Review & Feedback', 'Targeted Course Recommendations'],
    loginRole: ROLES.NEW_JOINER,
    route: '/training',
  },
  {
    id: 'upskilling',
    title: 'Upskilling & Reskilling',
    desc: 'For existing employees — profile-based AI assessment, skill gap analysis, and open-domain course library.',
    icon: TrendingUp,
    color: 'from-indigo-500 to-violet-600',
    roles: ['Employee', 'Manager'],
    features: ['Profile & Career Goals', 'AI Gap Analysis', 'Open Course Library', 'Manager Notifications'],
    loginRole: ROLES.EMPLOYEE,
    route: '/upskilling',
  },
];

const quickAccess = [
  { label: 'Trainer View', icon: Users, role: ROLES.TRAINER, route: '/trainer', color: 'amber' },
  { label: 'Admin Panel', icon: Shield, role: ROLES.ADMIN, route: '/admin', color: 'red' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { loginAs } = useAuth();

  const enterModule = (mod) => {
    loginAs(mod.loginRole);
    navigate(mod.route);
  };

  const enterQuick = (q) => {
    loginAs(q.role);
    navigate(q.route);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <GraduationCap className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">AI-powered Learning Space</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Upskill, Reskill, and Train — one platform for onboarding and career growth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => enterModule(mod)}
              className="group text-left bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className={`bg-gradient-to-r ${mod.color} p-6`}>
                <mod.icon className="w-8 h-8 text-white mb-3" />
                <h2 className="text-xl font-bold text-white">{mod.title}</h2>
                <p className="text-sm text-white/80 mt-1">{mod.desc}</p>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {mod.roles.map((r) => (
                    <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{r}</span>
                  ))}
                </div>
                <ul className="space-y-2">
                  {mod.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
                  Enter Module →
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          {quickAccess.map((q) => (
            <button
              key={q.label}
              onClick={() => enterQuick(q)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <q.icon className="w-4 h-4" />
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
