import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { UserCircle, Briefcase, Target, Upload, FileText, Check, Loader2, Sparkles, Rocket, Brain, ArrowRight } from 'lucide-react';

const stepLabels = ['Basic Info', 'Background', 'Goals & Resume'];

const DEPARTMENTS = [
  'Content', 'Customer Success', 'Engineering', 'Finance', 'Human Resources',
  'IT Services', 'Product Marketing', 'Sales', 'Product', 'Channel Sales',
  'Marketing', 'Marketing (Business Development)', 'Pre-Sales & Solutioning',
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', designation: '', experience: '', department: '', summary: '', goals: '' });
  const [resumeName, setResumeName] = useState('');
  const [resumePath, setResumePath] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/auth/me').then((user) => {
      setForm((f) => ({ ...f, name: user.name || '', designation: user.designation || '', experience: user.experience || '', department: user.department || '' }));
    }).catch(() => { });
    api.get('/profile').then((profile) => {
      if (profile) {
        setForm((f) => ({ ...f, summary: profile.summary || '', goals: profile.learning_goals || '' }));
        if (profile.resume_path) { setResumePath(profile.resume_path); setResumeName('Resume uploaded'); }
      }
    }).catch(() => { });
  }, []);

  const [errors, setErrors] = useState({});

  const update = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setSaved(false); setErrors((p) => ({ ...p, [field]: '' })); };
  const step1Ok = form.name.trim().length >= 2 && form.designation.trim().length >= 2 && form.experience;
  const step2Ok = form.summary.trim().length > 20;
  const allFilled = step1Ok && step2Ok && form.goals.trim().length >= 10;

  const tryNextStep = (from) => {
    const errs = {};
    if (from === 0) {
      if (!form.name.trim()) errs.name = 'Full name is required';
      else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
      if (!form.designation.trim()) errs.designation = 'Designation is required';
      else if (form.designation.trim().length < 2) errs.designation = 'Must be at least 2 characters';
      if (!form.experience) errs.experience = 'Please select your experience range';
    }
    if (from === 1) {
      if (!form.summary.trim()) errs.summary = 'Professional background is required';
      else if (form.summary.trim().length < 20) errs.summary = 'Please write at least 20 characters';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(from + 1);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.goals.trim()) errs.goals = 'Please describe your learning goals';
    else if (form.goals.trim().length < 10) errs.goals = 'Please write at least 10 characters';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await api.post('/profile', { summary: form.summary, learning_goals: form.goals });
      setSaved(true);
      setTimeout(() => navigate('/upskilling/interview'), 800);
    }
    catch (err) { console.error(err.message); }
    finally { setSaving(false); }
  };

  const handleResume = async (e) => {
    const file = e.target.files[0]; if (!file) return; setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try { const res = await api.upload('/profile/resume', fd); setResumePath(res.resume_path); setResumeName(file.name); }
    catch (err) { console.error(err.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <BackButton to="/upskilling" label="Back to Dashboard" />

      {/* Hero Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(to right, #F05A28, #c2410c)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Set Up Your Profile</h1>
              <p className="text-white/70 text-sm">AI uses this to create your personalized learning journey</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <button onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${step === i ? 'text-white shadow-lg' :
                  (i === 0 && step1Ok) || (i === 1 && step2Ok) || (i === 2 && allFilled)
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    'bg-gray-100 text-gray-400'
                }`}
              style={step === i ? { background: '#F05A28' } : {}}>
              {(i === 0 && step1Ok) || (i === 1 && step2Ok) || (i === 2 && allFilled)
                ? <Check className="w-3.5 h-3.5" />
                : <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">{i + 1}</span>}
              {label}
            </button>
            {i < stepLabels.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(240,90,40,0.1)' }}>
                <UserCircle className="w-5 h-5" style={{ color: '#F05A28' }} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Basic Information</h2>
                <p className="text-xs text-gray-400">Tell us about your current role</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={update('name')} placeholder="e.g. Arjun Nair"
                  className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Designation <span className="text-red-400">*</span></label>
                <input value={form.designation} onChange={update('designation')} placeholder="e.g. Senior Editor"
                  className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all ${errors.designation ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
                {errors.designation && <p className="text-xs text-red-500 mt-1">{errors.designation}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience <span className="text-red-400">*</span></label>
                <select value={form.experience} onChange={update('experience')}
                  className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all bg-white appearance-none cursor-pointer ${errors.experience ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select experience range</option>
                  <option value="0-2 years">0-2 years</option>
                  <option value="2-4 years">2-4 years</option>
                  <option value="4-6 years">4-6 years</option>
                  <option value="6-8 years">6-8 years</option>
                  <option value="8-10 years">8-10 years</option>
                  <option value="10-12 years">10-12 years</option>
                  <option value="12-14 years">12-14 years</option>
                  <option value="14-16 years">14-16 years</option>
                  <option value="16-18 years">16-18 years</option>
                  <option value="18-20 years">18-20 years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select value={form.department} onChange={update('department')}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all bg-white appearance-none cursor-pointer">
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.experience && <p className="text-xs text-red-500 mt-1">{errors.experience}</p>}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => tryNextStep(0)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all text-white shadow-lg"
                style={{ background: '#F05A28' }}
                onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                onMouseLeave={e => e.currentTarget.style.background = '#F05A28'}>
                Next: Background <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Professional Background */}
        {step === 1 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Professional Background</h2>
                <p className="text-xs text-gray-400">Help AI understand your expertise</p>
              </div>
            </div>
            <div>
              <textarea value={form.summary} onChange={update('summary')} rows={5}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-none transition-all ${errors.summary ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                placeholder="Describe your background — roles held, responsibilities, skills, specializations..." />
              <div className="flex items-center justify-between mt-2">
                {errors.summary
                  ? <p className="text-xs text-red-500">{errors.summary}</p>
                  : <p className="text-xs text-gray-400">Write like a mini resume. AI uses this to tailor your assessment.</p>}
                <span className={`text-xs font-medium ${form.summary.trim().length > 20 ? 'text-emerald-500' : 'text-gray-300'}`}>
                  {form.summary.length} chars {form.summary.trim().length > 20 ? '✓' : '(min 20)'}
                </span>
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs text-purple-700 flex items-center gap-2">
                <Brain className="w-4 h-4 shrink-0" />
                <span><strong>Pro tip:</strong> Mention specific tools you've used, types of content you've edited, team sizes, and domains you've worked in. The more detail, the better AI can personalize your journey.</span>
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(0)} className="px-5 py-3 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">← Back</button>
              <button type="button" onClick={() => tryNextStep(1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200">
                Next: Goals & Resume <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Goals & Resume */}
        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Learning Goals & Resume</h2>
                <p className="text-xs text-gray-400">Where do you want to grow?</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Learning Goals & Expectations <span className="text-red-400">*</span></label>
              <textarea value={form.goals} onChange={update('goals')} rows={4}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 resize-none transition-all ${errors.goals ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                placeholder="What skills do you want to learn? What are your career aspirations? Any domain you're curious about..." />
              {errors.goals
                ? <p className="text-xs text-red-500 mt-1.5">{errors.goals}</p>
                : <p className="text-xs text-gray-400 mt-1.5">Not restricted to your current role — explore any domain!</p>}
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Resume <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResume} />
              <div onClick={() => fileRef.current.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:shadow-sm ${resumePath ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                  }`}>
                {uploading ? (
                  <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: '#F05A28' }} />
                ) : resumePath ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Check className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-emerald-700">{resumeName}</p>
                    <p className="text-xs text-emerald-500">Click to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Drop your resume here or click to browse</p>
                    <p className="text-xs text-gray-400">PDF, DOC, or DOCX — AI can use this for deeper assessment</p>
                  </div>
                )}
              </div>
            </div>

            {/* What happens next */}
            <div className="rounded-xl p-5 border" style={{ background: 'rgba(240,90,40,0.05)', borderColor: 'rgba(240,90,40,0.2)' }}>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#c2410c' }}><Rocket className="w-4 h-4" /> What happens next?</h3>
              <div className="flex items-center gap-3 text-xs" style={{ color: '#c2410c' }}>
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-orange-100">📝 Save Profile</div>
                <ArrowRight className="w-3 h-3 text-orange-300" />
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-orange-100">🤖 AI Interview</div>
                <ArrowRight className="w-3 h-3 text-orange-300" />
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-orange-100">📊 Skill Analysis</div>
                <ArrowRight className="w-3 h-3 text-orange-300" />
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-orange-100">🎓 Course Recs</div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="px-5 py-3 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">← Back</button>
              <button type="submit" disabled={!allFilled || saving}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${saved ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                    !allFilled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-white shadow-lg'
                  }`}
                style={allFilled && !saved ? { background: '#F05A28' } : {}}
                onMouseEnter={e => { if (allFilled && !saved) e.currentTarget.style.background = '#c2410c'; }}
                onMouseLeave={e => { if (allFilled && !saved) e.currentTarget.style.background = '#F05A28'; }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {saved ? 'Profile Saved! ✨' : 'Save & Start AI Journey'}
              </button>
            </div>
          </div>
        )}
      </form>

      <p className="text-xs text-center text-gray-400">You can update your profile anytime to refresh AI recommendations.</p>
    </div>
  );
}
