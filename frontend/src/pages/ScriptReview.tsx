import { useState, useEffect } from 'react';
import { analyzedShortsApi, AnalyzedShort, ReviewResponse } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ReviewStatsWidget } from '../components/ReviewStats';

export default function ScriptReview() {
  const [script, setScript] = useState<AnalyzedShort | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guess, setGuess] = useState(50);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadRandomScript();
  }, []);

  const loadRandomScript = async () => {
    try {
      setLoading(true);
      setResult(null);
      setGuess(50);
      setNotes('');
      const data = await analyzedShortsApi.getRandomUnrated();
      setScript(data);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load script', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!script) return;

    try {
      setSubmitting(true);
      const response = await analyzedShortsApi.submitReview(script.id, guess, notes);
      setResult(response);
      showToast('Review submitted!', 'success');
      
      // Auto-advance after 3 seconds
      setTimeout(() => {
        loadRandomScript();
      }, 3000);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    loadRandomScript();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading script...</div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-gray-500 mb-4">No unrated scripts available</div>
          <button
            onClick={loadRandomScript}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const difference = result ? result.guess_percentile - result.actual_percentile : null;
  const errorColor = result
    ? result.error <= 5
      ? 'text-green-600'
      : result.error <= 15
      ? 'text-yellow-600'
      : 'text-red-600'
    : '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Script Review</h1>
        <ReviewStatsWidget />
      </div>

      {!result ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{script.title}</h2>
              {/* Hide views/likes to avoid giving away percentile */}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Script Transcript
              </label>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border border-gray-200">
                <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                  {script.transcript}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Percentile Guess (0-100)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={guess}
                  onChange={(e) => setGuess(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">0%</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={guess}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value)));
                      setGuess(val);
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-semibold"
                  />
                  <span className="text-sm text-gray-600">100%</span>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {guess === 99 ? '99th percentile (top 1%)' : 
                   guess >= 90 ? `${guess}th percentile (top ${100 - guess}%)` :
                   guess >= 50 ? `${guess}th percentile` :
                   `${guess}th percentile (bottom ${100 - guess}%)`}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your thoughts on what makes this script good or bad..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{script.title}</h2>
            <div className="text-sm text-gray-500 mb-4">
              {script.views.toLocaleString()} views • {script.likes.toLocaleString()} likes • {script.comments.toLocaleString()} comments
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Your Guess</div>
                <div className="text-2xl font-bold text-gray-900">{result.guess_percentile.toFixed(1)}%</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Actual Percentile</div>
                <div className="text-2xl font-bold text-blue-600">{result.actual_percentile.toFixed(1)}%</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Error</div>
                  <div className={`text-xl font-bold ${errorColor}`}>
                    {result.error.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Difference</div>
                  <div className={`text-xl font-bold ${difference && difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {difference && difference > 0 ? '+' : ''}{difference?.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {result.error <= 5 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
                🎯 Excellent guess! You're getting really good at this.
              </div>
            )}
            {result.error > 5 && result.error <= 15 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
                👍 Good guess! Keep practicing.
              </div>
            )}
            {result.error > 15 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                💡 Keep learning! Review what makes high/low percentile scripts different.
              </div>
            )}
          </div>

          {notes && (
            <div className="mb-6">
              <div className="text-sm font-medium text-gray-700 mb-2">Your Notes</div>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-900 whitespace-pre-wrap">
                {notes}
              </div>
            </div>
          )}

          <button
            onClick={handleNext}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Next Script
          </button>
        </div>
      )}
    </div>
  );
}

