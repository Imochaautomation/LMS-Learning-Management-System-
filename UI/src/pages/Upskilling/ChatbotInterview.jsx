import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Send, Loader2, User, CheckCircle, ExternalLink, Zap, Mic, MicOff } from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

const MIN_QUESTIONS = 15;
const MAX_QUESTIONS = 15;

const cleanText = (t) => t.replace(/\*+/g, '').trim();

const isClarification = (t) =>
  /\b(explain|clarify|what do you mean|rephrase|don't understand|elaborate|confusing|confused|unclear|can you repeat|what does that mean)\b/i.test(t);

function JarvisAvatar({ size = 'md' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  return (
    <div className={`${s} rounded-full flex items-center justify-center shrink-0 font-black text-white shadow-md`}
      style={{ background: 'linear-gradient(135deg, #F05A28 0%, #c2410c 100%)' }}>
      J
    </div>
  );
}

function SessionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium px-2 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export default function ChatbotInterview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const generatingRef = useRef(false);

  const welcome = `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm Jarvis, your AI skill interviewer from iMocha.\n\nI'll ask you ${MAX_QUESTIONS} short, focused questions to understand your strengths and find growth opportunities. There are no right or wrong answers — just be honest!\n\nYou can ask me to clarify any question at any time. After ${MIN_QUESTIONS} questions you can wrap up early.\n\nLet's get started!`;

  // Each item: { type: 'session', label, messages: [{role,text}] } | { role, text }
  const [chatBlocks, setChatBlocks] = useState([]);
  const [input, setInput] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [finished, setFinished] = useState(false);
  const [awaitingWrapup, setAwaitingWrapup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  const canFinishEarly = questionIndex >= MIN_QUESTIONS && !finished && !awaitingWrapup;
  const progress = Math.min((questionIndex / MAX_QUESTIONS) * 100, 100);

  // Flatten chatBlocks into a flat list of messages for rendering
  const allMessages = chatBlocks;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatBlocks, loading]);

  // Load session history on mount
  useEffect(() => {
    api.get('/ai/session').then((sessions) => {
      const blocks = [];
      const inProgress = sessions.find(s => s.status === 'in_progress');
      const completed = sessions.filter(s => s.status === 'completed');
      const abandoned = sessions.filter(s => s.status === 'abandoned');

      // Show all past sessions (completed + abandoned) as archived blocks
      const past = [...completed, ...abandoned].sort((a, b) => a.id - b.id);
      past.forEach((s, idx) => {
        const date = s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : `Session ${idx + 1}`;
        const label = s.status === 'abandoned' ? `Interrupted session — ${date}` : `Interview session — ${date}`;
        blocks.push({ type: 'divider', label });
        (s.messages || []).forEach(m => {
          blocks.push({ role: m.role === 'user' ? 'user' : 'bot', text: cleanText(m.content || '') });
        });
      });

      // Current in-progress session
      if (inProgress && (inProgress.messages || []).length > 0) {
        blocks.push({ type: 'divider', label: 'Current session (in progress)' });
        (inProgress.messages || []).forEach(m => {
          blocks.push({ role: m.role === 'user' ? 'user' : 'bot', text: cleanText(m.content || '') });
        });
        setQuestionIndex(inProgress.question_index || 0);
      } else if (past.length > 0) {
        // Past sessions exist but no active session — show welcome for new retake
        blocks.push({ type: 'divider', label: 'New interview' });
        blocks.push({ role: 'bot', text: welcome });
      } else {
        // Brand new user
        blocks.push({ role: 'bot', text: welcome });
      }

      setChatBlocks(blocks);
    }).catch(() => {
      setChatBlocks([{ role: 'bot', text: welcome }]);
    }).finally(() => setSessionLoaded(true));
  }, []);

  const resetTextarea = () => {
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
  };

  const appendMessage = (msg) => setChatBlocks(prev => [...prev, msg]);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice input is not supported in this browser. Try Chrome or Edge.'); return; }
    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    const r = new SpeechRecognition();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.onstart = () => setIsListening(true);
    r.onresult = (e) => {
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) setInput((prev) => {
        const base = prev.trimEnd();
        return base ? base + ' ' + final.trim() : final.trim();
      });
    };
    r.onend = () => {
      if (recognitionRef.current === r) {
        try { r.start(); } catch { setIsListening(false); }
      } else {
        setIsListening(false);
      }
    };
    r.onerror = (e) => {
      if (e.error !== 'no-speech') { setIsListening(false); recognitionRef.current = null; toast.error('Voice input stopped.'); }
    };
    r.start();
    recognitionRef.current = r;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input.trim() };
    appendMessage(userMsg);
    resetTextarea();
    setLoading(true);

    const isClarity = isClarification(userMsg.text);

    try {
      const res = await api.post('/ai/interview', {
        question_index: questionIndex,
        answer: userMsg.text,
        total_questions: MAX_QUESTIONS,
        is_clarification: isClarity,
      });

      const reply = cleanText(res.follow_up || res.next_question || '');

      if (!isClarity) {
        const nextQ = questionIndex + 1;
        setQuestionIndex(nextQ);

        if (nextQ >= MAX_QUESTIONS) {
          appendMessage({ role: 'bot', text: reply });
          appendMessage({ role: 'bot', text: `That wraps up all ${MAX_QUESTIONS} questions! Before I generate your skill analysis, is there anything you'd like to add or clarify? Just type your response, or click "Finish & Generate Report" when you're ready.` });
          setAwaitingWrapup(true);
        } else {
          const earlyHint = nextQ === MIN_QUESTIONS
            ? '\n\n(You can now finish early and get your recommendations, or continue for a deeper analysis.)'
            : '';
          appendMessage({ role: 'bot', text: reply + earlyHint });
        }
      } else {
        appendMessage({ role: 'bot', text: reply });
      }
    } catch {
      const fallback = [
        'Tell me about a specific challenge you faced in your current role and how you handled it.',
        'What tools or platforms do you use most in your day-to-day work?',
        'How do you keep your skills up to date in your field?',
        'Describe a recent project you are proud of. What was your contribution?',
        'What area of your work would you most like to improve?',
      ];
      const msg = cleanText(fallback[questionIndex % fallback.length]);
      appendMessage({ role: 'bot', text: msg });
      if (!isClarity) {
        const nextQ = questionIndex + 1;
        setQuestionIndex(nextQ);
        if (nextQ >= MAX_QUESTIONS) setAwaitingWrapup(true);
      }
    }
    setLoading(false);
  };

  const handleWrapupConfirm = async () => {
    setLoading(true);
    try {
      await api.post('/ai/interview', {
        question_index: questionIndex,
        answer: 'Ready to finish. Please generate my skill analysis.',
        total_questions: MAX_QUESTIONS,
        force_complete: true,
      });
    } catch {}
    appendMessage({ role: 'user', text: 'I am ready to finish.' });
    appendMessage({ role: 'bot', text: 'All done! Generating your personalized skill gap analysis and course recommendations now. This takes a moment.' });
    setAwaitingWrapup(false);
    setFinished(true);
    setLoading(false);
  };

  const finishEarly = async () => {
    setLoading(true);
    try {
      await api.post('/ai/interview', {
        question_index: questionIndex,
        answer: 'I would like to finish the interview now.',
        total_questions: MAX_QUESTIONS,
        force_complete: true,
      });
    } catch {}
    appendMessage({ role: 'user', text: "I'd like to finish now and get my recommendations." });
    appendMessage({ role: 'bot', text: `You've answered ${questionIndex} questions — that's a solid foundation. Generating your skill analysis now!` });
    setAwaitingWrapup(false);
    setFinished(true);
    setLoading(false);
  };

  const generateAnalysis = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setAnalysisError(false);
    try {
      await api.post('/ai/generate-analysis', { user_id: user.id });
      const courses = await api.get('/courses/recommended');
      setAnalysisResult(courses);
      toast.success('Skill analysis complete!');
    } catch (err) {
      setAnalysisError(true);
      toast.error('Analysis generation failed. You can retry below.');
    }
    setGenerating(false);
    generatingRef.current = false;
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <BackButton to="/upskilling" label="Back to Dashboard" />

      {/* Header */}
      <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(to right, #F05A28, #c2410c)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-black text-2xl shadow-inner">J</div>
            <div>
              <h1 className="text-lg font-bold">Jarvis · AI Skill Interviewer</h1>
              <p className="text-orange-100 text-sm">
                {awaitingWrapup ? 'Wrapping up — confirm to finish' : finished ? 'Interview complete' : `${questionIndex} of ${MAX_QUESTIONS} answered`}
              </p>
            </div>
          </div>
          {canFinishEarly && (
            <button onClick={finishEarly}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl border border-white/30 transition-all">
              <Zap className="w-3.5 h-3.5" /> Finish Early
            </button>
          )}
        </div>
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-orange-200/80 mt-1">
          <span>Min: {MIN_QUESTIONS} questions</span>
          <span>{questionIndex}/{MAX_QUESTIONS} answered</span>
          <span>Max: {MAX_QUESTIONS} questions</span>
        </div>
      </div>

      {/* Chat window */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ height: '65vh' }}>
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!sessionLoaded && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
            {allMessages.map((msg, i) => {
              if (msg.type === 'divider') {
                return <SessionDivider key={i} label={msg.label} />;
              }
              return (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role === 'bot'
                    ? <JarvisAvatar size="sm" />
                    : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                  }
                  <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'bot'
                      ? 'bg-gray-100 text-gray-800 rounded-tl-none'
                      : 'text-white rounded-tr-none'
                  }`}
                  style={msg.role !== 'bot' ? { background: '#F05A28' } : {}}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-3">
                <JarvisAvatar size="sm" />
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {!finished && !awaitingWrapup && sessionLoaded && (
            <div className="border-t border-gray-200 p-3 flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = '44px';
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder={isListening ? '🎙 Listening... speak now' : 'Type your answer or use the mic... (Shift+Enter for new line)'}
                disabled={loading}
                rows={1}
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50 resize-none overflow-y-auto"
                style={{ minHeight: '44px', maxHeight: '140px' }}
              />
              {/* Voice button: Mic icon when ON (listening), MicOff icon when OFF */}
              <button onClick={startVoice} disabled={loading}
                className={`p-3 rounded-xl shrink-0 transition-all ${isListening ? 'text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={isListening ? { background: '#F05A28' } : {}}
                title={isListening ? 'Mic is ON — click to stop' : 'Click to start voice input'}>
                {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button onClick={sendMessage} disabled={!input.trim() || loading}
                className="p-3 text-white rounded-xl disabled:opacity-50 shrink-0 transition-colors"
                style={{ background: '#F05A28' }}
                onMouseEnter={e => { if (!(!input.trim() || loading)) e.currentTarget.style.background = '#c2410c'; }}
                onMouseLeave={e => e.currentTarget.style.background = '#F05A28'}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Wrapup confirmation */}
          {awaitingWrapup && !finished && (
            <div className="border-t border-gray-200 p-4 space-y-3">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Add any final thoughts... (optional)"
                  disabled={loading}
                  rows={1}
                  className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50 resize-none"
                  style={{ minHeight: '44px', maxHeight: '100px' }}
                />
                <button onClick={sendMessage} disabled={!input.trim() || loading}
                  className="p-3 text-white rounded-xl disabled:opacity-50 shrink-0"
                  style={{ background: '#F05A28' }}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <button onClick={handleWrapupConfirm} disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 text-white font-semibold rounded-xl transition-colors"
                style={{ background: '#16a34a' }}
                onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
                onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}>
                <CheckCircle className="w-4 h-4" /> Finish & Generate My Report
              </button>
            </div>
          )}

          {/* Post-interview: generate analysis */}
          {finished && !analysisResult && (
            <div className="border-t border-gray-200 p-4 text-center space-y-2">
              <button onClick={generateAnalysis} disabled={generating}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-60">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {generating ? 'Generating analysis… this may take a minute' : 'Generate My Skill Analysis & Course Recommendations'}
              </button>
              {analysisError && (
                <p className="text-xs text-red-500">Generation failed — please retry. If it keeps failing, try refreshing and coming back.</p>
              )}
            </div>
          )}

          {/* Results */}
          {finished && analysisResult && (
            <div className="border-t border-gray-200 p-4 space-y-4">
              <p className="text-sm font-semibold text-emerald-700 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Analysis complete! Here are your recommended courses:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {analysisResult.map((c, i) => (
                  <div key={c.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                      <p className="text-xs text-gray-400">{c.provider}{c.duration ? ` · ${c.duration}` : ''}{c.free ? ' · Free' : ''}</p>
                    </div>
                    {c.link && (
                      <a href={c.link} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 shrink-0 ml-2 font-medium">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-center">
                <button onClick={() => navigate('/upskilling')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-white font-medium rounded-xl"
                  style={{ background: '#F05A28' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F05A28'}>
                  Go to Dashboard →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
