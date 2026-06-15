/**
 * New Joiner: List their AI-generated training assessments.
 * Route: /training/ai-assessments
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Loader2, BookOpen, ChevronRight, Trophy, Clock, CheckCircle2 } from 'lucide-react';

const TEAL = '#0d9488';
const ORANGE = '#F05A28';

export default function AIAssessments() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/training/assessments/mine')
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: TEAL }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #134e4a)` }}>
        <h1 className="text-2xl font-bold mb-1">🧠 Training Assessments</h1>
        <p className="text-teal-100 text-sm">AI-generated quizzes based on your SME training materials.</p>
      </div>

      {assessments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No assessments yet</p>
          <p className="text-sm text-gray-400 mt-1">Your manager will create assessments from your SME Kit materials.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const hasPassed = a.passed;
            const hasAttempt = a.attempt_count > 0;

            return (
              <div
                key={a.id}
                onClick={() => navigate(`/training/ai-assessments/${a.id}`)}
                className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-gray-300 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg shrink-0"
                    style={{ background: hasPassed ? 'linear-gradient(135deg,#10b981,#0d9488)' : `linear-gradient(135deg,${TEAL},#134e4a)` }}>
                    {hasPassed ? '🏆' : '🧠'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{a.title}</span>
                      {hasPassed && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Passed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{a.kit_name}</span>
                      <span>{a.total_questions} questions ({a.mcq_count} MCQ + {a.written_count} written)</span>
                      <span>Pass at {a.pass_threshold}%</span>
                    </div>
                    {hasAttempt && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-indigo-600 font-medium">{a.attempt_count} attempt{a.attempt_count > 1 ? 's' : ''}</span>
                        {a.best_score != null && (
                          <span className={`text-xs font-bold ${hasPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Best: {Math.round(a.best_score)}/100
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${hasAttempt ? (hasPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') : 'text-white'}`}
                    style={!hasAttempt ? { background: ORANGE } : {}}>
                    {hasAttempt ? (hasPassed ? 'Review' : 'Retry') : 'Start'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
