import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import BackButton from '../../components/shared/BackButton';
import { Bot, Send, Loader2, User, CheckCircle, ExternalLink, Zap } from 'lucide-react';
import { ToastContainer, useToast } from '../../components/shared/Toast';

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;

export default function ChatbotInterview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: 'bot', text: `Hi ${user?.name || 'there'}! 👋 I'm Jarvis, your AI-powered skill analyst. I'll ask you between 5 and 10 questions to understand your strengths and identify growth areas. Answer honestly — there are no wrong answers!\n\nYou can choose to get recommendations after 5 questions, or continue for up to 10 for a deeper analysis.\n\nLet's begin!` }
  ]);
  const [input, setInput] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const { toasts, removeToast, toast } = useToast();

  const canFinishEarly = questionIndex >= MIN_QUESTIONS && !finished;
  const progress = Math.min((questionIndex / MAX_QUESTIONS) * 100, 100);

  const sendMessage = async () => {
    if (!input.trim() || loading || finished) return;
    const userMsg = { role: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/interview', {
        question_index: questionIndex,
        answer: userMsg.text,
        total_questions: MAX_QUESTIONS,
      });
      const nextQ = questionIndex + 1;
      setQuestionIndex(nextQ);

      if (nextQ >= MAX_QUESTIONS) {
        setMessages((prev) => [...prev,
          { role: 'bot', text: res.follow_up || 'Thank you for completing all questions! 🎉' },
          { role: 'bot', text: '✅ All questions answered! Ready to generate your personalized skill analysis and course recommendations.' }
        ]);
        setFinished(true);
      } else {
        const earlyHint = nextQ === MIN_QUESTIONS
          ? '\n\n💡 You\'ve answered 5 questions! You can now get recommendations, or continue for a more detailed analysis.'
          : '';
        setMessages((prev) => [...prev, { role: 'bot', text: (res.follow_up || res.next_question || `Question ${nextQ + 1} coming...`) + earlyHint }]);
      }
    } catch (err) {
      const fallbackTopics = ['editing tools', 'grammar standards', 'US English', 'team collaboration', 'deadline management', 'document formatting', 'quality assurance', 'mentoring juniors', 'handling feedback', 'career goals'];
      setMessages((prev) => [...prev, { role: 'bot', text: `Question ${questionIndex + 2}: Tell me about your experience with ${fallbackTopics[questionIndex + 1] || 'your skills'}?` }]);
      setQuestionIndex((p) => p + 1);
      if (questionIndex + 1 >= MAX_QUESTIONS) {
        setFinished(true);
        setMessages((prev) => [...prev, { role: 'bot', text: '✅ Interview complete! Generating your skill analysis...' }]);
      }
    }
    setLoading(false);
  };

  const finishEarly = async () => {
    setLoading(true);
    try {
      // Tell backend to mark session as completed
      await api.post('/ai/interview', {
        question_index: questionIndex,
        answer: 'I would like to finish the interview and get my recommendations now.',
        total_questions: MAX_QUESTIONS,
        force_complete: true,
      });
      setMessages((prev) => [...prev,
        { role: 'user', text: 'I\'d like to get course recommendations based on my answers so far.' },
        { role: 'bot', text: `Great! You've answered ${questionIndex} questions — that's enough for a solid analysis. Let me generate your skill breakdown and course recommendations now. 🎯` }
      ]);
    } catch {
      setMessages((prev) => [...prev,
        { role: 'bot', text: `You've answered ${questionIndex} questions. Ready to generate your analysis! 🎯` }
      ]);
    }
    setFinished(true);
    setLoading(false);
  };

  const generateAnalysis = async () => {
    setGenerating(true);
    try {
      await api.post('/ai/generate-analysis', { user_id: user.id });
      const courses = await api.get('/courses/recommended');
      setAnalysisResult(courses);
      toast.success('Skill analysis complete! Check your recommended courses.');
    } catch (err) { toast.error(`Failed to generate analysis: ${err.message}`); }
    setGenerating(false);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <BackButton to="/upskilling" label="Back to Dashboard" />

      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold">Jarvis - AI Skill Interviewer</h1>
              <p className="text-indigo-200 text-sm">
                Question {Math.min(questionIndex + 1, MAX_QUESTIONS)} · Min 5, Max 10
              </p>
            </div>
          </div>
          {canFinishEarly && (
            <button onClick={finishEarly}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl border border-white/30 transition-all">
              <Zap className="w-3.5 h-3.5" /> Get Recommendations Now
            </button>
          )}
        </div>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-indigo-200 mt-1">
          <span>Min: 5 questions</span>
          <span>{questionIndex}/{MAX_QUESTIONS} answered</span>
          <span>Max: 10 questions</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ height: '68vh' }}>
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'bot' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                  {msg.role === 'bot' ? <Bot className="w-4 h-4 text-indigo-600" /> : <User className="w-4 h-4 text-emerald-600" />}
                </div>
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === 'bot' ? 'bg-gray-100 text-gray-800 rounded-tl-none' : 'bg-indigo-600 text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"><Bot className="w-4 h-4 text-indigo-600" /></div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-none"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /></div>
              </div>
            )}
          </div>

          {!finished ? (
            <div className="border-t border-gray-200 p-3 flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your answer... (Shift+Enter for new line)"
                disabled={loading}
                rows={1}
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 resize-none overflow-y-auto"
                style={{ minHeight: '44px', maxHeight: '140px' }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || loading}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : analysisResult ? (
            <div className="border-t border-gray-200 p-4 space-y-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-700 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Analysis Complete! Here are your recommended courses:
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {analysisResult.map((c, i) => (
                  <div key={c.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      {c.link ? (
                        <a href={c.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline truncate block">
                          {c.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                      )}
                      <p className="text-xs text-gray-400">{c.provider}{c.duration ? ` · ${c.duration}` : ''}</p>
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors">
                  Go to Dashboard →
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 p-4 text-center">
              <button onClick={generateAnalysis} disabled={generating}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Generate My Skill Analysis & Course Recommendations
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
