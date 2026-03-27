import { useState, useEffect, useRef, useCallback } from 'react';
import { competitorAnalysisApi } from '../services/api';

// ── Channel metadata ──────────────────────────────────────────────────────────

const CHANNEL_META: Record<string, { displayName: string; mcUsername: string }> = {
  'camman18':          { displayName: 'camman18',          mcUsername: 'camman_18'    },
  'DashPum4':          { displayName: 'DashPum4',          mcUsername: 'DashPum4'     },
  'Skip the Tutorial': { displayName: 'Skip the Tutorial', mcUsername: 'skiptutorial' },
  'TurbaneMC':         { displayName: 'TurbaneMC',         mcUsername: 'TurbaneMC'    },
};

function mcHeadUrl(mcUsername: string) {
  return `https://mc-heads.net/avatar/${mcUsername}/64`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function percentileLabel(p: number): string {
  if (p >= 95) return 'Top 5%';
  if (p >= 90) return 'Top 10%';
  if (p >= 75) return 'Top 25%';
  if (p >= 50) return 'Above median';
  if (p >= 25) return 'Below median';
  return 'Bottom 25%';
}

function percentileColor(p: number): string {
  if (p >= 75) return '#2DC97A';
  if (p >= 50) return '#4ECB71';
  if (p >= 25) return '#E8943A';
  return '#E05A4E';
}

function accuracyColor(err: number): string {
  if (err <= 10) return '#2DC97A';
  if (err <= 20) return '#4ECB71';
  if (err <= 35) return '#E8943A';
  return '#E05A4E';
}

// ── Shared panel ─────────────────────────────────────────────────────────────

const PNL = ({ children, label, style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px', ...style }}>
    {label && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>{label}</div>}
    {children}
  </div>
);

// ── Percentile slider ─────────────────────────────────────────────────────────

function PercentileSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color = percentileColor(value);
  const marks = [
    { p: 0, label: 'Worst' },
    { p: 25, label: 'Bot 25%' },
    { p: 50, label: 'Median' },
    { p: 75, label: 'Top 25%' },
    { p: 90, label: 'Top 10%' },
    { p: 100, label: 'Best' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Your guess — channel percentile
        </span>
        <span style={{ fontSize: '22px', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {value}th
        </span>
      </div>
      <div style={{ position: 'relative', marginBottom: '6px' }}>
        {/* Track fill */}
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          width: `${value}%`, height: '4px',
          background: color, borderRadius: '2px', transform: 'translateY(-50%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
        <input
          type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: '100%', height: '4px', appearance: 'none',
            background: 'var(--border-default)', borderRadius: '2px',
            outline: 'none', cursor: 'pointer', position: 'relative', zIndex: 2,
            accentColor: color,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {marks.map(m => (
          <span key={m.p} style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => onChange(m.p)}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Reveal display ────────────────────────────────────────────────────────────

function RevealPanel({
  reveal,
  guess,
  onRate,
  onNext,
  hasMore,
}: {
  reveal: any;
  guess: number | null;
  onRate: (r: number) => void;
  onNext: () => void;
  hasMore: boolean;
}) {
  const actual = reveal.actual_percentile as number;
  const error = guess !== null ? Math.abs(guess - actual) : null;
  const [rating, setRating] = useState<number>(reveal.review?.rating || 0);

  function handleRate(r: number) {
    setRating(r);
    onRate(r);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Accuracy */}
      <PNL>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {guess !== null && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Your guess</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: percentileColor(guess), letterSpacing: '-0.05em', lineHeight: 1 }}>{guess}th</div>
              </div>
              <div style={{ fontSize: '22px', color: 'var(--text-muted)', fontWeight: 300 }}>→</div>
            </>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Actual percentile</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: percentileColor(actual), letterSpacing: '-0.05em', lineHeight: 1 }}>{actual}th</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{percentileLabel(actual)}</div>
          </div>
          {error !== null ? (
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Error</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: accuracyColor(error), letterSpacing: '-0.05em', lineHeight: 1 }}>±{error}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>pts</div>
            </div>
          ) : (
            <div style={{ flex: 1, fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
              Too recent — no guess tracked
            </div>
          )}
        </div>

        {/* Distribution bar */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ position: 'relative', height: '20px', background: 'var(--border-default)', borderRadius: '10px', overflow: 'visible' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '10px',
              background: 'linear-gradient(to right, #E05A4E 0%, #E8943A 25%, #B8922E 50%, #4ECB71 75%, #2DC97A 100%)',
              opacity: 0.3,
            }} />
            {guess !== null && (
              <div style={{
                position: 'absolute', top: '-4px', bottom: '-4px',
                left: `calc(${guess}% - 1px)`,
                width: '2px', background: 'var(--text-muted)', borderRadius: '2px',
              }}>
                <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  guess
                </div>
              </div>
            )}
            <div style={{
              position: 'absolute', top: '-6px', bottom: '-6px',
              left: `calc(${actual}% - 2px)`,
              width: '4px', background: percentileColor(actual), borderRadius: '2px',
            }}>
              <div style={{ position: 'absolute', bottom: '-16px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: percentileColor(actual), fontWeight: 700, whiteSpace: 'nowrap' }}>
                actual
              </div>
            </div>
          </div>
        </div>
      </PNL>

      {/* Actual stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Views', value: fmtViews(reveal.views) },
          { label: 'Rank in channel', value: `#${reveal.rank_from_top} / ${reveal.total_in_channel}` },
          { label: 'Duration', value: fmtDuration(reveal.duration_sec) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Rating */}
      <PNL label="Rate this video">
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                background: r <= rating ? 'var(--gold)' : 'var(--border-default)',
                color: r <= rating ? 'var(--bg-primary)' : 'var(--text-muted)',
                transition: 'all 0.1s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </PNL>

      {/* Next */}
      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '13px', fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        {hasMore ? 'Next Video →' : 'All reviewed — back to channels'}
      </button>
    </div>
  );
}

// ── Session view ──────────────────────────────────────────────────────────────

function SessionView({
  channel,
  onBack,
}: {
  channel: string;
  onBack: () => void;
}) {
  const meta = CHANNEL_META[channel] || { displayName: channel, mcUsername: channel };
  const [video, setVideo] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [guess, setGuess] = useState(50);
  const [phase, setPhase] = useState<'loading' | 'watching' | 'revealed' | 'done' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadNext = useCallback(async () => {
    setPhase('loading');
    setNotes('');
    setGuess(50);
    setReveal(null);
    setVideoUrl(null);
    setLoadError(null);
    try {
      const v = await competitorAnalysisApi.getNextVideo(channel);
      setVideo(v);
      const url = await competitorAnalysisApi.getVideoUrl(v.id);
      setVideoUrl(url);
      setPhase('watching');
    } catch (e: any) {
      if (e.response?.status === 404) {
        setHasMore(false);
        setPhase('done');
      } else {
        setLoadError(e.response?.data?.error || e.message || 'Failed to load video');
        setPhase('error');
      }
    }
  }, [channel]);

  useEffect(() => { loadNext(); }, [loadNext]);

  const isTooRecent = video
    ? (Date.now() - new Date(video.published_at).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;

  async function handleReveal() {
    await competitorAnalysisApi.saveReview(video.id, {
      notes,
      percentile_guess: isTooRecent ? undefined : guess,
    });
    const data = await competitorAnalysisApi.getReveal(video.id);
    setReveal(data);
    setPhase('revealed');
  }

  async function handleRate(rating: number) {
    await competitorAnalysisApi.saveReview(video.id, {
      notes,
      percentile_guess: isTooRecent ? undefined : guess,
      rating,
    });
  }

  function handleNext() {
    loadNext();
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <style>{`
        @media (max-width: 700px) {
          .competitor-session-grid { grid-template-columns: 1fr !important; }
          .competitor-channel-table { overflow-x: auto; }
          .competitor-channel-header { display: none !important; }
          .competitor-channel-row { grid-template-columns: 1fr 80px !important; gap: 0; }
          .competitor-channel-row > *:not(:first-child):not(:last-child) { display: none; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
        >
          ← Channels
        </button>
        <img
          src={mcHeadUrl(meta.mcUsername)}
          alt={meta.displayName}
          style={{ width: 28, height: 28, borderRadius: '4px', imageRendering: 'pixelated' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{meta.displayName}</span>
        {phase === 'watching' && video && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {new Date(video.published_at).toLocaleDateString()} · {fmtDuration(video.duration_sec)}
          </span>
        )}
      </div>

      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Loading video…
        </div>
      )}

      {phase === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#E05A4E' }}>Failed to load video</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '400px', textAlign: 'center' }}>{loadError}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={loadNext} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 700 }}>Retry</button>
            <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Back to Channels</button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>All videos reviewed!</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No more unreviewed videos for {meta.displayName}.</div>
          <button onClick={onBack} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '13px', fontWeight: 700 }}>
            Back to Channels
          </button>
        </div>
      )}

      {(phase === 'watching' || phase === 'revealed') && video && (
        <div className="competitor-session-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px', alignItems: 'start' }}>
          {/* Video */}
          <div>
            <div style={{ background: '#000', borderRadius: '10px', overflow: 'hidden', aspectRatio: '9/16', maxHeight: '65vh' }}>
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '12px' }}>
                  Loading…
                </div>
              )}
            </div>
            {/* Title visible after reveal only */}
            {phase === 'revealed' && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{video.title}</div>
            )}
          </div>

          {/* Side panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {phase === 'watching' && (
              <>
                <PNL label="Your analysis">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="What's working? Hook type? Pacing? Editing style? Thumbnail?"
                    style={{
                      width: '100%', minHeight: '140px', background: 'transparent',
                      border: 'none', outline: 'none', resize: 'vertical',
                      fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6,
                      fontFamily: 'inherit',
                    }}
                  />
                </PNL>

                {isTooRecent ? (
                  <PNL>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Percentile guess</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Disabled — video is less than 7 days old, views are still climbing.
                    </div>
                  </PNL>
                ) : (
                  <PNL>
                    <PercentileSlider value={guess} onChange={setGuess} />
                  </PNL>
                )}

                <button
                  onClick={handleReveal}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '13px', fontWeight: 700,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Reveal Stats
                </button>
              </>
            )}

            {phase === 'revealed' && reveal && (
              <>
                {notes && (
                  <PNL label="Your notes">
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notes}</div>
                  </PNL>
                )}
                <RevealPanel
                  reveal={reveal}
                  guess={isTooRecent ? null : guess}
                  onRate={handleRate}
                  onNext={handleNext}
                  hasMore={hasMore}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Channel row ───────────────────────────────────────────────────────────────

function ChannelRow({ ch, onStart }: { ch: any; onStart: () => void }) {
  const meta = CHANNEL_META[ch.channel] || { displayName: ch.channel, mcUsername: ch.channel };
  const pct = ch.total > 0 ? Math.round((ch.reviewed / ch.total) * 100) : 0;
  const allDone = ch.reviewed >= ch.total;

  return (
    <div className="competitor-channel-row" style={{
      display: 'grid',
      gridTemplateColumns: '220px 100px 100px 100px 120px 90px 140px',
      alignItems: 'center',
      gap: '0',
      padding: '14px 18px',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {/* Channel identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '6px', overflow: 'hidden', background: 'var(--border-default)', flexShrink: 0 }}>
          <img
            src={mcHeadUrl(meta.mcUsername)}
            alt={meta.displayName}
            style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{meta.displayName}</span>
      </div>

      {/* Avg views */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtViews(ch.avg_views)}</div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>avg views</div>
      </div>

      {/* Median views */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtViews(ch.median_views)}</div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>median</div>
      </div>

      {/* Best video */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#2DC97A' }}>{fmtViews(ch.max_views)}</div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>best video</div>
      </div>

      {/* Downloaded + reviewed progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ch.reviewed}/{ch.total} reviewed</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: allDone ? '#2DC97A' : 'var(--text-secondary)' }}>{pct}%</span>
        </div>
        <div style={{ height: '4px', background: 'var(--border-default)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: allDone ? '#2DC97A' : 'var(--gold)', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Accuracy */}
      <div>
        {ch.avg_error != null && ch.reviewed > 0 ? (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: accuracyColor(ch.avg_error) }}>±{ch.avg_error} pts</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>accuracy</div>
          </>
        ) : (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>—</div>
        )}
      </div>

      {/* Action */}
      <button
        onClick={onStart}
        disabled={allDone}
        style={{
          padding: '7px 14px', borderRadius: '6px', border: 'none',
          cursor: allDone ? 'default' : 'pointer',
          background: allDone ? 'var(--border-default)' : 'var(--gold)',
          color: allDone ? 'var(--text-muted)' : 'var(--bg-primary)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em',
          opacity: allDone ? 0.5 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {allDone ? 'All reviewed' : 'Start Session →'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompetitorAnalysis() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  useEffect(() => {
    if (activeChannel) return; // Don't reload while in session
    setLoading(true);
    competitorAnalysisApi.getChannels()
      .then(setChannels)
      .catch((e: any) => setError(e.response?.data?.error || 'Failed to load channels'))
      .finally(() => setLoading(false));
  }, [activeChannel]);

  if (activeChannel) {
    return (
      <SessionView
        channel={activeChannel}
        onBack={() => setActiveChannel(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <style>{`
        @media (max-width: 700px) {
          .competitor-session-grid { grid-template-columns: 1fr !important; }
          .competitor-channel-header { display: none !important; }
          .competitor-channel-row { grid-template-columns: 1fr auto !important; padding: 12px 14px; }
          .competitor-channel-row > *:not(:first-child):not(:last-child) { display: none; }
        }
      `}</style>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Analytics
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Competitor Analysis
        </h1>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Loading channels…
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', color: '#E05A4E', fontSize: '13px' }}>{error}</div>
      )}

      {!loading && !error && channels.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '12px' }}>
          No downloaded competitor videos found.
        </div>
      )}

      {!loading && channels.length > 0 && (
        <div className="competitor-channel-table" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
          {/* Header */}
          <div className="competitor-channel-header" style={{
            display: 'grid',
            gridTemplateColumns: '220px 100px 100px 100px 120px 90px 140px',
            gap: '0',
            padding: '8px 18px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-primary)',
          }}>
            {['Channel', 'Avg Views', 'Median', 'Best Video', 'Progress', 'Accuracy', ''].map(h => (
              <div key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
            ))}
          </div>
          {channels.map(ch => (
            <ChannelRow
              key={ch.channel}
              ch={ch}
              onStart={() => setActiveChannel(ch.channel)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
