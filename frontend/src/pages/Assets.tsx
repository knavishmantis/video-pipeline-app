import { useState } from 'react';
import JSZip from 'jszip';

const BUCKET_BASE = 'https://storage.googleapis.com/knavishmantis-video-pipeline-prod';

const RED_EMOJIS = [
  'conniving',
  'devastation',
  'disgusted',
  'dumb emoji',
  'grrr',
  'jaw-drop',
  'keep-it-up-pal',
  'no-bitches?',
  'problem',
  'roger that',
  'shocked',
  'smootch',
  'wagt',
  'wondering',
  'yipee',
];

async function downloadAllEmojis(setDownloading: (v: boolean) => void) {
  setDownloading(true);
  try {
    const zip = new JSZip();
    await Promise.all(
      RED_EMOJIS.map(async (name) => {
        const url = `${BUCKET_BASE}/emojis/red/${encodeURIComponent(name)}.png`;
        const res = await fetch(url);
        const blob = await res.blob();
        zip.file(`${name}.png`, blob);
      })
    );
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = 'red-emojis.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  } finally {
    setDownloading(false);
  }
}

export default function Assets() {
  const [downloading, setDownloading] = useState(false);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Assets
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Brand assets and media for production use
          </p>
        </div>
      </div>

      {/* Emojis section */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
              Emojis
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Transparent PNG · 720×720 · Red — {RED_EMOJIS.length} emojis
            </p>
          </div>
          <button
            onClick={() => downloadAllEmojis(setDownloading)}
            disabled={downloading}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            {downloading ? 'Downloading…' : 'Download All'}
          </button>
        </div>

        {/* Emoji grid */}
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {RED_EMOJIS.map((name) => {
            const url = `${BUCKET_BASE}/emojis/red/${encodeURIComponent(name)}.png`;
            return (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
              >
                <img
                  src={url}
                  alt={name}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {name}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
