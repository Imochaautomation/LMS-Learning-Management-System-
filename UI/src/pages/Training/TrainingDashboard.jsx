import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { BookOpen, FileText, GraduationCap, CheckCircle, Lock, Award, Trophy, Star, Loader2 } from 'lucide-react';

export default function TrainingDashboard() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/assessments/my').then(setAssessments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const reviewed = assessments.filter((a) => a.status === 'reviewed');
  const submitted = assessments.filter((a) => a.status === 'submitted' || a.status === 'reviewed');
  const badges = reviewed.filter(a => a.score >= 90).length;
  const trophies = reviewed.filter(a => a.score >= 95).length;
  const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, a) => s + (a.score || 0), 0) / reviewed.length) : 0;
  const allDone = assessments.length > 0 && assessments.every(a => a.status === 'reviewed' || a.status === 'submitted');

  const journeySteps = [
    { label: '📚 Spellbook', key: 'spellbook', done: true, desc: 'Study training materials' },
    ...assessments.map((a, i) => {
      const icons = ['⚔️', '🛡️', '🏹', '🗡️', '🔮'];
      const done = a.status === 'reviewed' || a.status === 'submitted';
      const active = !done && (i === 0 || assessments[i - 1]?.status === 'reviewed' || assessments[i - 1]?.status === 'submitted');
      return {
        label: `${icons[i % icons.length]} Quest ${i + 1}`,
        key: `a${i + 1}`,
        done,
        active: active && !done,
        desc: done ? `Assessment ${i + 1} done` : active ? 'In progress...' : 'Pending',
        locked: !done && !active,
      };
    }),
    { label: '🎓 Ready', key: 'ready', done: false, locked: !allDone, desc: 'Manager marks you ready' },
    { label: '🚀 Self-Learning', key: 'self', done: false, locked: true, desc: 'Courses unlock!' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <span className="ml-3 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero — Deep Teal gradient */}
      <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-400/10 rounded-full translate-y-10 -translate-x-10" />
        <div className="absolute top-6 right-24 w-2 h-2 bg-amber-400/60 rounded-full" />
        <div className="absolute top-14 right-40 w-1.5 h-1.5 bg-teal-300/40 rounded-full" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-medium bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">🌱 New Joiner</span>
            <span className="text-sm bg-purple-400/25 px-2.5 py-0.5 rounded-full">🏅 {badges} Badges</span>
            <span className="text-sm bg-amber-400/25 px-2.5 py-0.5 rounded-full">🏆 {trophies} Trophies</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">Welcome, {user?.name}! 👋</h1>
          <p className="text-teal-100 text-sm mt-1">Complete quests and earn badges & trophies!</p>
          {user?.manager_name && (
            <p className="text-teal-200/70 text-xs mt-2">🧑‍💼 Manager: {user.manager_name}</p>
          )}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-white to-purple-50 border border-purple-100 rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
          <Award className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-purple-600">{badges}</div>
          <div className="text-xs text-gray-500">Badges (90%+)</div>
        </div>
        <div className="bg-gradient-to-br from-white to-amber-50 border border-amber-100 rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
          <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-amber-600">{trophies}</div>
          <div className="text-xs text-gray-500">Trophies (95%+)</div>
        </div>
        <div className="bg-gradient-to-br from-white to-teal-50 border border-teal-100 rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
          <Star className="w-5 h-5 text-teal-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-teal-600">{avgScore}%</div>
          <div className="text-xs text-gray-500">Avg Accuracy</div>
        </div>
      </div>

      {/* Quest Journey */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">🗺️ My Quest Journey</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {journeySteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                step.done ? 'bg-teal-50 text-teal-700 border-2 border-teal-300' :
                step.active ? 'bg-amber-50 text-amber-700 border-2 border-amber-400 ring-2 ring-amber-200 shadow-sm' :
                step.locked ? 'bg-gray-50 text-gray-400 border-2 border-gray-200' :
                'bg-gray-50 text-gray-400 border-2 border-gray-200'
              }`}>
                {step.done ? <CheckCircle className="w-4 h-4" /> :
                 step.active ? <span className="text-base">⚔️</span> :
                 step.locked ? <Lock className="w-4 h-4" /> :
                 <div className="w-4 h-4 rounded-full border-2 border-current" />}
                <div>
                  <div>{step.label}</div>
                  <div className="text-[10px] font-normal opacity-70">{step.desc}</div>
                </div>
              </div>
              {i < journeySteps.length - 1 && (
                <span className={`text-lg ${step.done ? 'text-teal-400' : 'text-gray-300'}`}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How Badges Work */}
      <div className="bg-gradient-to-br from-slate-50 to-teal-50 border border-teal-100 rounded-xl p-5">
        <h3 className="text-sm font-bold text-teal-800 mb-2">🤖 How Badges & Trophies Work</h3>
        <p className="text-xs text-teal-700/80">
          Badges and Trophies are calculated based on the <strong className="text-teal-900">accuracy of your assessments</strong>, reviewed by AI.
        </p>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-purple-200 shadow-sm">
            <Award className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">Accuracy &gt; 90% → <span className="text-purple-600">Badge</span></span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-amber-200 shadow-sm">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">Accuracy &gt; 95% → <span className="text-amber-600">Trophy</span></span>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link to="/training/sme-kit" className="bg-white border border-teal-200 rounded-xl p-5 hover:shadow-md hover:border-teal-400 transition-all group">
          <span className="text-2xl mb-2 block">📚</span>
          <h3 className="font-bold text-gray-900 text-sm">Spellbook — SME Kit</h3>
          <p className="text-xs text-gray-500 mt-1">Training materials & style guides</p>
          <p className="text-xs text-teal-600 mt-2 font-semibold group-hover:underline">Open →</p>
        </Link>
        <Link to="/training/assessments" className="bg-white border border-amber-200 rounded-xl p-5 hover:shadow-md hover:border-amber-400 transition-all group">
          <span className="text-2xl mb-2 block">⚔️</span>
          <h3 className="font-bold text-gray-900 text-sm">Assessment Quests</h3>
          <p className="text-xs text-gray-500 mt-1">Download, complete & earn badges</p>
          <p className="text-xs text-amber-600 mt-2 font-semibold group-hover:underline">Open →</p>
        </Link>
        {allDone ? (
          <Link to="/training/courses" className="bg-white border border-emerald-200 rounded-xl p-5 hover:shadow-md hover:border-emerald-400 transition-all group">
            <span className="text-2xl mb-2 block">🎓</span>
            <h3 className="font-bold text-gray-900 text-sm">Courses</h3>
            <p className="text-xs text-emerald-600 mt-1">Courses unlocked!</p>
            <p className="text-xs text-emerald-600 mt-2 font-semibold group-hover:underline">Open →</p>
          </Link>
        ) : (
          <div className="relative bg-gray-50 border border-gray-200 rounded-xl p-5 opacity-60">
            <div className="absolute top-3 right-3">
              <Lock className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-2xl mb-2 block">🎓</span>
            <h3 className="font-bold text-gray-500 text-sm">Courses</h3>
            <p className="text-xs text-gray-400 mt-1">Complete all quests to unlock</p>
            <p className="text-xs text-gray-400 mt-2 font-semibold">🔒 Locked — complete assessments first</p>
          </div>
        )}
      </div>
    </div>
  );
}
