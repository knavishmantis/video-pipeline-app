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
  const [savingNotes, setSavingNotes] = useState(false);
  const { showToast, ToastComponent } = useToast();

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
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!script) return;
    try {
      setSavingNotes(true);
      await analyzedShortsApi.updateNotes(script.id, notes);
      showToast('Notes saved!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to save notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleNext = () => {
    loadRandomScript();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading script…</div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4" style={{ color: 'var(--text-muted)' }}>No unrated scripts available</div>
          <button
            onClick={loadRandomScript}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const difference = result ? result.guess_percentile - result.actual_percentile : null;
  const errorVar = result
    ? result.error <= 5
      ? 'var(--green)'
      : result.error <= 15
      ? 'var(--gold)'
      : 'var(--red)'
    : 'var(--text-primary)';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Script Review</h1>
        <ReviewStatsWidget />
      </div>

      {!result ? (
        <>
          <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{script.title}</h2>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                Script Transcript
              </label>
              <div className="rounded-lg p-4 max-h-96 overflow-y-auto" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: 'var(--text-primary)' }}>
                  {script.transcript}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                Percentile Guess (0–100)
              </label>
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={guess}
                  onChange={(e) => setGuess(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--gold)' }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>0%</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={guess}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value)));
                      setGuess(val);
                    }}
                    className="w-20 px-2 py-1 rounded text-center font-bold text-sm focus:outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>100%</span>
                </div>
                <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  {guess === 99 ? '99th percentile (top 1%)' : 
                   guess >= 90 ? `${guess}th percentile (top ${100 - guess}%)` :
                   guess >= 50 ? `${guess}th percentile` :
                   `${guess}th percentile (bottom ${100 - guess}%)`}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your thoughts on what makes this script good or bad..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-4 py-2.5 rounded-lg font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{script.title}</h2>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {script.views.toLocaleString()} views · {script.likes.toLocaleString()} likes · {script.comments.toLocaleString()} comments
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Your Guess</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{result.guess_percentile.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg p-4" style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Actual Percentile</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{result.actual_percentile.toFixed(1)}%</div>
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Error</div>
                  <div className="text-xl font-bold" style={{ color: errorVar }}>
                    {result.error.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Difference</div>
                  <div className="text-xl font-bold" style={{ color: difference && difference > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {difference && difference > 0 ? '+' : ''}{difference?.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {result.error <= 5 && (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'color-mix(in srgb, var(--green) 12%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--green) 30%, var(--border-default))', color: 'var(--green)' }}>
                🎯 Excellent guess! You're getting really good at this.
              </div>
            )}
            {result.error > 5 && result.error <= 15 && (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'color-mix(in srgb, var(--gold) 12%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--gold) 30%, var(--border-default))', color: 'var(--gold)' }}>
                👍 Good guess! Keep practicing.
              </div>
            )}
            {result.error > 15 && (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'color-mix(in srgb, var(--red) 12%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--red) 30%, var(--border-default))', color: 'var(--red)' }}>
                💡 Keep learning! Review what makes high/low percentile scripts different.
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did this script perform the way it did? What can you learn from it?"
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', cursor: savingNotes ? 'not-allowed' : 'pointer' }}
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          <button
            onClick={handleNext}
            className="w-full px-4 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
          >
            Next Script
          </button>
        </div>
      )}
      <ToastComponent />
    </div>
  );
}
