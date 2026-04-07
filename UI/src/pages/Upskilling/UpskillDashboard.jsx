import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { GraduationCap, UserCircle, Bot, Trophy, ArrowRight, Lock, Loader2, CheckCircle2, BookOpen, ExternalLink } from 'lucide-react';
import SkillGaugeChart from '../../components/shared/SkillGaugeChart';
import SkillLineChart from '../../components/shared/SkillLineChart';

const severityColor = { High: 'border-red-200 bg-red-50', Medium: 'border-amber-200 bg-amber-50', Low: 'border-emerald-200 bg-emerald-50' };
const severityBar = { High: 'bg-red-500', Medium: 'bg-amber-500', Low: 'bg-emerald-500' };
const severityBadge = { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-emerald-100 text-emerald-700' };

// Journey based on completed courses count (no XP)
const QUEST_LEVELS = [
  { title: 'New Learner', min: 0, emoji: '🌱' },
  { title: 'Rising Learner', min: 1, emoji: '📗' },
  { title: 'Active Learner', min: 3, emoji: '⭐' },
  { title: 'Skilled Learner', min: 5, emoji: '🏆' },
  { title: 'Expert Learner', min: 8, emoji: '🏅' },
  { title: 'Champion Learner', min: 12, emoji: '✨' },
];

function getLevel(completedCount) {
  for (let i = QUEST_LEVELS.length - 1; i >= 0; i--) {
    if (completedCount >= QUEST_LEVELS[i].min) return QUEST_LEVELS[i];
  }
  return QUEST_LEVELS[0];
}

export default function UpskillDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [skillGaps, setSkillGaps] = useState([]);
  const [strengths, setStrengths] = useState([]);
  const [areasOfImprovement, setAreasOfImprovement] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/profile/me').then(setProfile).catch(() => setProfile(null)),
      api.get('/ai/skill-analysis').then((data) => {
        setSkillGaps(data.skill_gaps || []);
        setStrengths(data.strengths || []);
        setAreasOfImprovement(data.areas_of_improvement || []);
      }).catch(() => {}),
      api.get('/courses/my').then(setCourses).catch(() => setCourses([])),
    ]).finally(() => setLoading(false));
  }, []);

  const profileComplete = profile && (profile.summary || profile.learning_goals);
  const interviewDone = skillGaps.length > 0;
  const started = courses.filter((c) => c.status === 'started');
  const completed = courses.filter((c) => c.status === 'completed');
  const level = getLevel(completed.length);

  // Determine current step
  let currentStep = 1; // Profile
  if (profileComplete) currentStep = 2; // Interview
  if (profileComplete && interviewDone) currentStep = 3; // Courses

  const steps = [
    { num: 1, label: 'Complete Profile', emoji: '📋', desc: 'Tell us about your background & goals' },
    { num: 2, label: 'AI Interview', emoji: '🤖', desc: 'AI analyzes your skills & gaps' },
    { num: 3, label: 'Course Recommendations', emoji: '🎓', desc: 'Personalized learning path' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-gray-500">Loading your dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{level.emoji}</span>
          <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">{level.title}</span>
          <span className="text-sm bg-amber-400/30 px-2 py-0.5 rounded-full">🏆 {completed.length} Trophies</span>
        </div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name}! 🚀</h1>
        <p className="text-indigo-200 text-sm mt-1">Your upskilling journey — follow the steps below to get started!</p>
        {user?.manager_name && <p className="text-indigo-300 text-xs mt-2">Manager: {user.manager_name}</p>}
      </div>

      {/* Step Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">🗺️ Your Journey</h2>
        <div className="flex items-center gap-0">
          {steps.map((step, i) => {
            const isDone = step.num < currentStep;
            const isActive = step.num === currentStep;
            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className={`flex items-center gap-3 flex-1 px-4 py-3 rounded-xl border-2 transition-all ${isDone ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                  isActive ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-200 shadow-sm' :
                    'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : step.num}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.emoji} {step.label}</p>
                    <p className="text-xs opacity-70">{step.desc}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className={`w-5 h-5 mx-2 shrink-0 ${isDone ? 'text-emerald-400' : 'text-gray-300'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Complete Profile */}
      {currentStep === 1 && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Step 1: Complete Your Profile</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Tell us about your background, designation, experience, and learning goals. This helps AI understand you better for the interview.
          </p>
          <button onClick={() => navigate('/upskilling/profile')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
            <UserCircle className="w-5 h-5" /> Complete Profile →
          </button>
          <div className="mt-8 flex justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-gray-200 text-gray-400 text-sm">
              <Lock className="w-4 h-4" /> AI Interview
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-gray-200 text-gray-400 text-sm">
              <Lock className="w-4 h-4" /> Course Recommendations
            </div>
          </div>
        </div>
      )}

      {/* Step 2: AI Interview */}
      {currentStep === 2 && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-10 h-10 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Step 2: AI Skill Assessment Interview</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Complete a 10-question interview with our AI. It will analyze your skills, identify gaps, and recommend personalized courses.
          </p>
          <button onClick={() => navigate('/upskilling/interview')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all">
            <Bot className="w-5 h-5" /> Start AI Interview →
          </button>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Profile completed ✓
          </div>
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-gray-200 text-gray-400 text-sm">
              <Lock className="w-4 h-4" /> Course Recommendations — complete interview first
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Full Dashboard — Interview done */}
      {currentStep === 3 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">Courses in Progress</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{started.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">🏆 Trophies Earned</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{completed.length}</p>
            </div>
            <Link to="/upskilling/profile" className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500">Update Profile</p>
              <UserCircle className="w-6 h-6 text-indigo-600 mt-2" />
            </Link>
            <Link to="/upskilling/interview" className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500">Retake Interview</p>
              <Bot className="w-6 h-6 text-violet-600 mt-2" />
            </Link>
          </div>

          {/* My Quest Journey — matching the dark theme design */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 text-white">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-amber-400" /> My Journey
            </h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {QUEST_LEVELS.map((lv, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div className={`text-center px-4 py-3 rounded-xl border transition-all ${completed.length >= lv.min
                    ? 'bg-white/15 border-white/20'
                    : 'bg-white/5 border-white/5 opacity-50'
                    }`}>
                    <span className="text-2xl block">{lv.emoji}</span>
                    <p className="text-xs font-semibold mt-1.5">{lv.title}</p>
                  </div>
                  {i < QUEST_LEVELS.length - 1 && <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Skill Gaps */}
          {skillGaps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">📊 Skill Gap Analysis</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">High</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Medium</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Low</span>
                </div>
              </div>

              {/* Skill Gap Gauge Chart */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <SkillGaugeChart score={Math.round(skillGaps.reduce((s, g) => s + (g.score || 0), 0) / skillGaps.length)} size={280} />
              </div>

              {/* Skill Line Chart */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">📈 Skill Score Breakdown</h3>
                <SkillLineChart skillGaps={skillGaps} height={220} />
              </div>

              {/* Strengths & Areas of Improvement */}
              {(strengths.length > 0 || areasOfImprovement.length > 0) && (
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  {strengths.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">💪 Strengths</h3>
                      <ul className="space-y-1.5">
                        {strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                            <span className="text-emerald-500 mt-0.5 shrink-0">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {areasOfImprovement.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">🎯 Areas of Improvement</h3>
                      <ul className="space-y-1.5">
                        {areasOfImprovement.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                            <span className="text-amber-500 mt-0.5 shrink-0">→</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Course Recommendations CTA */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" /> Recommended Courses
                </h2>
                <p className="text-sm text-gray-500 mt-1">Based on your AI interview results. Start learning!</p>
              </div>
              <Link to="/upskilling/courses"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 shadow-sm">
                <GraduationCap className="w-4 h-4" /> View Courses →
              </Link>
            </div>
            {courses.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {courses.slice(0, 3).map((c) => (
                  <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    {c.link ? (
                      <a href={c.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate block">{c.title}</a>
                    ) : (
                      <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{c.provider}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        c.status === 'started' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>{c.status}</span>
                      {c.link && (
                        <a href={c.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                          View Course <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
