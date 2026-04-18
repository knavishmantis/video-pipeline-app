import { IconCamera } from '@tabler/icons-react';

/**
 * Scene card showing the same annotated view the prospect clipper sees on the
 * sample assignment page. Used by ClipperSample (the prospect) AND AdminSamples
 * (the reviewer) so the reviewer can judge the submission against the exact
 * instructions the clipper was given.
 */
export function SampleSceneCard({ scene, index, compact = false }: { scene: any; index: number; compact?: boolean }) {
  return (
    <div style={{
      background: compact ? 'var(--bg-base)' : 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: compact ? '8px' : '10px',
      padding: compact ? '12px 14px' : '18px 20px',
      boxShadow: compact ? 'none' : 'var(--card-shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: compact ? '10px' : '14px' }}>
        <div style={{
          width: compact ? '22px' : '28px',
          height: compact ? '22px' : '28px',
          borderRadius: '6px',
          background: 'var(--gold-dim)',
          border: '1px solid var(--gold-border)',
          color: 'var(--gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '11px' : '12px',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {scene.script_line && (
            <p style={{ fontSize: compact ? '12px' : '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px', lineHeight: '1.5' }}>
              "{scene.script_line}"
            </p>
          )}
          {scene.direction && (
            <p style={{ fontSize: compact ? '11px' : '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.6' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Direction:</strong> {scene.direction}
            </p>
          )}
          {scene.clipper_notes && (
            <div style={{
              marginTop: '10px',
              padding: compact ? '8px 10px' : '10px 12px',
              background: 'var(--col-clips-dim, rgba(120,180,220,0.1))',
              border: '1px solid var(--col-clips-border, rgba(120,180,220,0.25))',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}>
              <IconCamera size={compact ? 12 : 14} style={{ color: 'var(--col-clips, rgb(90,150,200))', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: compact ? '11px' : '12px', color: 'var(--text-secondary)', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>
                {scene.clipper_notes}
              </div>
            </div>
          )}
          {scene.link_group && (
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              Filming group: <strong style={{ color: 'var(--text-secondary)' }}>{scene.link_group}</strong>
            </div>
          )}
          {scene.images && scene.images.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              {scene.images.map((img: any) => (
                img.url && (
                  <img
                    key={img.id}
                    src={img.url}
                    alt="scene reference"
                    style={{ height: compact ? '64px' : '80px', borderRadius: '6px', border: '1px solid var(--border-default)' }}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
