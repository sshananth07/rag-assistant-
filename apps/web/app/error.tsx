'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', gap: 16, padding: 24,
        }}>
            <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'rgba(226, 75, 74, 0.1)',
                border: '1px solid rgba(226, 75, 74, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
            }}>
                ⚠️
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontFamily: 'Syne, sans-serif', fontSize: 18,
                    fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8,
                }}>
                    Something went wrong
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.7 }}>
                    {error.message ?? 'An unexpected error occurred. Please try again.'}
                </div>
            </div>
            <button
                onClick={reset}
                style={{
                    padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--accent)', border: 'none',
                    color: '#fff', fontSize: 12,
                    fontFamily: 'DM Mono, monospace',
                }}
            >
                Try again
            </button>
        </div>
    )
}