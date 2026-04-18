/**
 * SimilarCutsPanel — inline panel for one scene showing grounded competitor-cut
 * reference suggestions (from Mogswamp / other analyzed channels).
 *
 * Renders directly inline under a scene card. Lazily loads on first expand.
 * Each suggestion shows: autoplay-muted-loop video preview, visual description,
 * why-it-fits caption, adaptation-note pills (subject swaps), and an "Adopt"
 * button that returns a pre-filled clipper_notes string to the parent.
 */
import { useState, useEffect, useRef } from 'react';
import { Scene } from '../../../shared/types';
import { scenesApi, SimilarCutSuggestion } from '../services/api';

function formatTimestamp(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildAdoptedClipperNotes(s: SimilarCutSuggestion): string {
  const stamp = formatTimestamp(s.start_ms);
  const base = `Similar to ${s.channel} ${s.youtube_video_id} at ${stamp}: ${s.visual_description}`;
  const styleBits: string[] = [];
  if (s.pov) styleBits.push(`${s.pov} POV`);
  if (s.clip_type) styleBits.push(`${s.clip_type} style`);
  const style = styleBits.length ? ` Match ${styleBits.join(' + ')}.` : '';
  const subs = s.adaptation_notes.length
    ? ` Substitutions: ${s.adaptation_notes.join('; ')}.`
    : '';
  return `${base}.${style}${subs}`;
}

interface Props {
  shortId: number;
  scene: Scene;
  channel?: string; // default: 'Mogswamp' (only one we care about initially)
  onAdopt: (adoptedText: string, source: SimilarCutSuggestion) => void;
  initiallyOpen?: boolean;
}

export function SimilarCutsPanel({ shortId, scene, channel = 'Mogswamp', onAdopt, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SimilarCutSuggestion[] | null>(null);
  const [loadedForSceneHash, setLoadedForSceneHash] = useState<string>('');
  const sceneHash = `${scene.id}:${scene.script_line}:${scene.direction}`;

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await scenesApi.similarCuts(shortId, scene.id, { k: 5, channel });
      setSuggestions(r.suggestions);
      setLoadedForSceneHash(sceneHash);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setOpen(o => !o);
    if (!open && (!suggestions || loadedForSceneHash !== sceneHash)) {
      loadSuggestions();
    }
  };

  return (
    <div style={{ marginTop: '6px', fontSize: '12px' }}>
      <button
        onClick={toggle}
        style={{
          background: open ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'transparent',
          border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
          color: 'var(--gold)',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
        title={`Find similar cuts from ${channel}`}
      >
        {open ? '▾' : '▸'} Similar cuts from {channel}
      </button>

      {open && (
        <div style={{ marginTop: '8px' }}>
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Searching reference library…</div>}
          {error && (
            <div style={{ color: '#e05a4e', fontSize: '11px' }}>
              {error}
              <button onClick={loadSuggestions} style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', textDecoration: 'underline' }}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && suggestions && suggestions.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              No close matches. Try once this scene has a script line or direction.
            </div>
          )}
          {!loading && suggestions && suggestions.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '10px',
              }}
            >
              {suggestions.map(s => (
                <SuggestionCard key={s.cut_id} suggestion={s} onAdopt={() => onAdopt(buildAdoptedClipperNotes(s), s)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion, onAdopt }: { suggestion: SimilarCutSuggestion; onAdopt: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovering) {
      v.currentTime = suggestion.start_ms / 1000;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [hovering, suggestion.start_ms]);

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        border: '1px solid color-mix(in srgb, var(--text-muted) 30%, transparent)',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
      }}
    >
      {suggestion.signed_video_url ? (
        <video
          ref={videoRef}
          src={suggestion.signed_video_url}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', background: '#000', maxHeight: '280px' }}
        />
      ) : (
        <div style={{ aspectRatio: '9/16', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', maxHeight: '280px' }}>
          No preview
        </div>
      )}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {suggestion.clip_type && <Pill color="var(--gold)">{suggestion.clip_type}</Pill>}
          {suggestion.pov && <Pill color="var(--col-clips)">{suggestion.pov}</Pill>}
          {suggestion.editing_effects.slice(0, 3).map(fx => (
            <Pill key={fx} color="var(--col-editing)">{fx}</Pill>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
          {suggestion.why_it_fits || suggestion.visual_description}
        </div>
        {suggestion.adaptation_notes.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {suggestion.adaptation_notes.map((swap, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'color-mix(in srgb, var(--col-editing) 18%, transparent)',
                  color: 'var(--col-editing)',
                  border: '1px solid color-mix(in srgb, var(--col-editing) 50%, transparent)',
                }}
              >
                {swap}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {suggestion.channel} · {formatTimestamp(suggestion.start_ms)}–{formatTimestamp(suggestion.end_ms)}
        </div>
        <button
          onClick={onAdopt}
          style={{
            background: 'var(--gold)',
            color: '#000',
            border: 'none',
            padding: '6px 8px',
            borderRadius: '5px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
          title="Fill clipper notes with this pattern + substitutions"
        >
          Adopt pattern
        </button>
      </div>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '9px',
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: '4px',
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        border: `1px solid ${color}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </span>
  );
}
