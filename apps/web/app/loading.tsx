export default function Loading() {
    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', gap: 12,
        }}>
            <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px var(--accent-glow)',
                animation: 'pulse-glow 2s infinite',
            }}>
                <span style={{ fontSize: 16 }}>⚡</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                Loading PaperBuddy...
            </div>
        </div>
    )
}