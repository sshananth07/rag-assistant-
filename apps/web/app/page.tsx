'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Send, FileText, X, Loader, ChevronRight, Zap, Download, Trash2, Search, Square } from 'lucide-react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  chunks?: RetrievedChunk[]
}

type RetrievedChunk = {
  id: string
  text: string
  filename: string
  section: string
  pageEstimate: number
  title: string
  score: number
}

type Paper = {
  paperId: string
  filename: string
  chunkCount: number
}

type Tooltip = {
  chunk: RetrievedChunk
  x: number
  y: number
}

type SearchResult = {
  title: string
  authors: string[]
  year: number
  abstract: string
  isOpenAccess: boolean
  pdfUrl: string | null
  doi: string | null
}

type Note = {
  id: string
  sessionId: string
  question: string
  answer: string
  chunks: RetrievedChunk[]
  paperIds: string[]
  createdAt: number
}

type SessionSummary = {
  id: string
  createdAt: number
  lastActiveAt: number
  messageCount: number
  paperCount: number
  preview: string
}

type SidebarView = 'papers' | 'search'

function formatPaperName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')        // remove .pdf
    .replace(/[_-]/g, ' ')          // underscores to spaces
    .replace(/\s+/g, ' ')           // collapse spaces
    .trim()
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [papers, setPapers] = useState<Paper[]>([])
  const [uploading, setUploading] = useState(false)
  const [querying, setQuerying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([])
  const [sidebarView, setSidebarView] = useState<SidebarView>('papers')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [fetchingPaper, setFetchingPaper] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [showNotes, setShowNotes] = useState(false)
  const [socraticMode, setSocraticMode] = useState(false)
  const [savingNote, setSavingNote] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [showSessions, setShowSessions] = useState(false)
  const [sessionsList, setSessionList] = useState<SessionSummary[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionHasMore, setSessionHasMore] = useState(false)
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false)
  const [notesPage, setNotesPage] = useState(1)
  const [notesHasMore, setNotesHasMore] = useState(false)
  const [loadingMoreNotes, setLoadingMoreNotes] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltip(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    async function initSession() {
      setSessionLoading(true)
      try {
        // Always load papers first
        const papersRes = await fetch('/api/papers')
        const allPapers: Paper[] = papersRes.ok ? await papersRes.json().then(
          (rows: any[]) => rows.map(r => ({
            paperId: r.id,
            filename: r.filename,
            chunkCount: r.chunkCount,
          }))
        ) : []
        setPapers(allPapers)

        const stored = localStorage.getItem('paperbuddy_session_id')

        if (stored) {
          const res = await fetch(`/api/sessions/${stored}`)
          if (res.ok) {
            const data = await res.json()

            if (data.messages?.length > 0) {
              setMessages(data.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                chunks: m.chunks ?? [],
                timestamp: new Date(m.createdAt),
              })))
            }

            if (data.state) {
              const validIds = (data.state.selectedPaperIds ?? []).filter(
                (id: string) => allPapers.some(p => p.paperId === id)
              )
              setSelectedPaperIds(validIds)
              setSocraticMode(data.state.socraticMode ?? false)
            }

            // Load notes for this session
            await loadNotes(stored, 1)

            setSessionId(stored)
            sessionIdRef.current = stored
            return
          }
        }

        // No valid stored session — find the most recent non-empty session
        const sessionsRes = await fetch('/api/sessions')
        if (sessionsRes.ok) {
          const allSessions = await sessionsRes.json()
          const mostRecent = allSessions.find((s: any) => s.messageCount > 0)

          if (mostRecent) {
            // Restore most recent session with messages
            localStorage.setItem('paperbuddy_session_id', mostRecent.id)

            const res = await fetch(`/api/sessions/${mostRecent.id}`)
            if (res.ok) {
              const data = await res.json()

              if (data.messages?.length > 0) {
                setMessages(data.messages.map((m: any) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  chunks: m.chunks ?? [],
                  timestamp: new Date(m.createdAt),
                })))
              }

              if (data.state) {
                const validIds = (data.state.selectedPaperIds ?? []).filter(
                  (id: string) => allPapers.some(p => p.paperId === id)
                )
                setSelectedPaperIds(validIds)
                setSocraticMode(data.state.socraticMode ?? false)
              }

              await loadNotes(mostRecent.id, 1)

              setSessionId(mostRecent.id)
              sessionIdRef.current = mostRecent.id
              return
            }
          }
        }

        // No sessions at all — create fresh one
        await createNewSession()

      } catch {
        await createNewSession()
      } finally {
        setSessionLoading(false)
      }
    }

    async function createNewSession() {
      const res = await fetch('/api/sessions', { method: 'POST' })
      const data = await res.json()
      localStorage.setItem('paperbuddy_session_id', data.id)
      setSessionId(data.id)
      sessionIdRef.current = data.id
    }

    initSession()
  }, [])

  useEffect(() => {
    if (!sessionId) return
    loadNotes(sessionId, 1)
  }, [sessionId])

  async function uploadFile(file: File) {
    if (!file.type.includes('pdf')) {
      setApiError('Only PDF files are supported.')
      return
    }
    setUploading(true)
    setApiError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: fd })
      const data = await res.json()

      if (res.status === 409 && data.duplicate) {
        setApiError(`"${formatPaperName(file.name)}" is already in your library.`)
        // Auto-select the existing paper instead
        if (!selectedPaperIds.includes(data.paperId)) {
          const nextSelectedIds = selectedPaperIds.length < 5
            ? [...selectedPaperIds, data.paperId]
            : selectedPaperIds
          setSelectedPaperIds(nextSelectedIds)
          await syncState({ selectedPaperIds: nextSelectedIds })
        }
        return
      }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload failed')

      const newPaper = { paperId: data.paperId, filename: file.name, chunkCount: data.chunkCount }
      const nextPapers = [...papers, newPaper]
      const nextSelectedIds = selectedPaperIds.length < 5
        ? [...selectedPaperIds, data.paperId]
        : selectedPaperIds
      setPapers(nextPapers)
      setSelectedPaperIds(nextSelectedIds)
      await syncState({ selectedPaperIds: nextSelectedIds })
    } catch (err: any) {
      setApiError(err.message ?? 'Failed to upload PDF. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function persistMessage(role: 'user' | 'assistant', content: string, chunks: RetrievedChunk[] = []) {
    const id = sessionIdRef.current
    console.log('persistMessage called — sessionId:', id, 'role:', role)
    if (!id) {
      console.log('persistMessage aborted — no sessionId')
      return
    }
    const res = await fetch(`/api/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content, chunks }),
    })
    console.log('persistMessage response:', res.status)
  }

  async function syncState(updates: {
    selectedPaperIds?: string[]
    socraticMode?: boolean
    ingestedPapers?: Paper[]
  }) {
    const id = sessionIdRef.current
    if (!id) return
    await fetch(`/api/sessions/${id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  async function sendMessage() {
    if (!input.trim() || querying) return
    const question = input.trim()
    setInput('')

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }
    setMessages(m => [...m, userMsg])
    setQuerying(true)

    await persistMessage('user', question)

    const assistantId = crypto.randomUUID()
    setMessages(m => [...m, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

    try {
      abortControllerRef.current = new AbortController()

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          paperIds: selectedPaperIds.length > 0 ? selectedPaperIds : undefined,
          socratic: socraticMode,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const is429 = res.status === 429
        const retryAfter = data?.retryAfter ?? 60

        if (is429) {
          // Start countdown
          setRetryCountdown(retryAfter)
          const interval = setInterval(() => {
            setRetryCountdown(prev => {
              if (prev === null || prev <= 1) {
                clearInterval(interval)
                return null
              }
              return prev - 1
            })
          }, 1000)

          setMessages(m => m.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: `⚠️ Rate limit reached. Retrying in ${retryAfter}s...` }
              : msg
          ))
        } else {
          setMessages(m => m.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: `⚠️ Request failed (${res.status}). Please try again.` }
              : msg
          ))
        }
        return
      }

      let chunks: RetrievedChunk[] = []
      try {
        const raw = res.headers.get('x-chunks')
        if (raw) chunks = JSON.parse(atob(raw))
      } catch { }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value, { stream: true })
          setMessages(m => m.map(msg =>
            msg.id === assistantId ? { ...msg, content: full, chunks } : msg
          ))
        }
      } catch (streamErr) {
        if (!full) {
          setMessages(m => m.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: '⚠️ Response interrupted. Please try again.' }
              : msg
          ))
          return
        }
      }

      if (full) {
        await persistMessage('assistant', full, chunks)
      }

    } finally {
      setQuerying(false)
    }
  }

  function stopGenerating() {
    abortControllerRef.current?.abort()
    setQuerying(false)
    // Mark the last assistant message as stopped
    setMessages(m => {
      const last = [...m].reverse().find(msg => msg.role === 'assistant')
      if (last && !last.content) {
        return m.map(msg =>
          msg.id === last.id
            ? { ...msg, content: '⚠️ Generation stopped.' }
            : msg
        )
      }
      return m
    })
  }

  async function searchPapers() {
    if (!searchQuery.trim() || searching) return
    setSearching(true)
    setSearchResults([])
    setApiError(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), limit: 8 }),
      })
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setSearchResults(data)
    } catch (err: any) {
      setApiError('Search failed. Check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  async function fetchAndIngestPaper(result: SearchResult) {
    if (!result.pdfUrl) return
    setFetchingPaper(result.title)
    try {
      const res = await fetch('/api/fetch-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: result.pdfUrl, title: result.title }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        alert(`Could not ingest paper: ${data.error ?? 'Unknown error'}`)
        return
      }

      if (data.paperId) {
        const newPaper = {
          paperId: data.paperId,
          filename: `${result.title.slice(0, 50)}.pdf`,
          chunkCount: data.chunkCount,
        }
        setPapers(prev => {
          const next = [...prev, newPaper]
          syncState({ ingestedPapers: next })
          return next
        })
        setSelectedPaperIds(prev => {
          const next = prev.length < 5 ? [...prev, data.paperId] : prev
          syncState({ selectedPaperIds: next })
          return next
        })
        setSidebarView('papers')
      }
    } catch (err) {
      alert('Failed to fetch paper — it may need to be uploaded manually.')
    } finally {
      setFetchingPaper(null)
    }
  }

  async function saveNote(msg: Message) {
    if (!msg.chunks || msg.chunks.length === 0) return
    setSavingNote(msg.id)
    try {
      const questionMsg = messages[messages.indexOf(msg) - 1]
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          question: questionMsg?.content ?? '',
          answer: msg.content,
          chunks: msg.chunks,
          paperIds: selectedPaperIds,
        }),
      })
      const data = await res.json()
      const note: Note = {
        id: data.id,
        sessionId: sessionIdRef.current ?? '',
        question: questionMsg?.content ?? '',
        answer: msg.content,
        chunks: msg.chunks,
        paperIds: selectedPaperIds,
        createdAt: Date.now(),
      }
      setNotes(prev => [note, ...prev])
    } finally {
      setSavingNote(null)
    }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function exportNotes() {
    setExporting(true)
    try {
      const url = sessionId
        ? `/api/notes/download?sessionId=${sessionId}`
        : '/api/notes/download'
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'research-notes.docx'
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  async function loadSessionList(page = 1) {
    if (page === 1) setLoadingSessions(true)
    else setLoadingMoreSessions(true)

    try {
      const res = await fetch(`/api/sessions?page=${page}&limit=10`)
      const data = await res.json()

      if (page === 1) {
        setSessionList(data.sessions ?? data)
      } else {
        setSessionList(prev => [...prev, ...(data.sessions ?? [])])
      }

      setSessionHasMore(data.pagination?.hasMore ?? false)
      setSessionPage(page)
    } finally {
      setLoadingSessions(false)
      setLoadingMoreSessions(false)
    }
  }

  async function switchSession(id: string) {
    if (id === sessionIdRef.current) {
      setShowSessions(false)
      return
    }

    const res = await fetch(`/api/sessions/${id}`)
    if (!res.ok) return

    const data = await res.json()

    setMessages(data.messages?.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      chunks: m.chunks ?? [],
      timestamp: new Date(m.createdAt),
    })) ?? [])

    if (data.state) {
      const validIds = (data.state.selectedPaperIds ?? []).filter(
        (pid: string) => papers.some(p => p.paperId === pid)
      )
      setSelectedPaperIds(validIds)
      setSocraticMode(data.state.socraticMode ?? false)
    }

    // Load notes for this session
    await loadNotes(id, 1)

    localStorage.setItem('paperbuddy_session_id', id)
    setSessionId(id)
    sessionIdRef.current = id
    setShowSessions(false)
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this session? This cannot be undone.')) return
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessionList(prev => prev.filter(s => s.id !== id))

    if (id === sessionIdRef.current) {
      const res = await fetch('/api/sessions', { method: 'POST' })
      const data = await res.json()
      localStorage.setItem('paperbuddy_session_id', data.id)
      setSessionId(data.id)
      sessionIdRef.current = data.id
      setMessages([])
      setSelectedPaperIds([])
      setPapers([])
      setSocraticMode(false)
    }
  }

  async function deletePaper(paperId: string, filename: string) {
    if (!confirm(`Delete "${formatPaperName(filename)}"? This cannot be undone.`)) return
    setApiError(null)
    try {
      const res = await fetch(`/api/papers/${paperId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      const nextPapers = papers.filter(p => p.paperId !== paperId)
      const nextSelectedIds = selectedPaperIds.filter(id => id !== paperId)
      setPapers(nextPapers)
      setSelectedPaperIds(nextSelectedIds)
      await syncState({ selectedPaperIds: nextSelectedIds })
    } catch {
      setApiError('Failed to delete paper. Please try again.')
    }
  }

  async function loadNotes(id: string, page = 1) {
    try {
      const res = await fetch(`/api/notes?sessionId=${id}&page=${page}&limit=10`)
      const data = await res.json()
      const newNotes = data.notes ?? data

      if (page === 1) {
        setNotes(newNotes)
      } else {
        setNotes(prev => [...prev, ...newNotes])
      }

      setNotesHasMore(data.pagination?.hasMore ?? false)
      setNotesPage(page)
    } catch { }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function togglePaper(paperId: string) {
    setSelectedPaperIds(prev => {
      if (prev.includes(paperId)) {
        const next = prev.filter(id => id !== paperId)
        syncState({ selectedPaperIds: next })
        return next
      }
      if (prev.length >= 5) {
        alert('Maximum 5 papers per session')
        return prev
      }
      const next = [...prev, paperId]
      syncState({ selectedPaperIds: next })
      return next
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function formatTime(d: Date) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function renderMessageContent(msg: Message) {
    if (msg.role === 'user') return <span>{msg.content}</span>
    if (msg.content === '') return (
      <span style={{
        animation: 'blink 1s infinite', display: 'inline-block',
        width: 8, height: 14, background: 'var(--accent)', borderRadius: 2
      }} />
    )

    const citationRegex = /\[chunk-\d+(?:,\s*chunk-\d+)*\]/g
    const parts: { text: string; isCitation: boolean }[] = []
    let lastIndex = 0
    let match

    citationRegex.lastIndex = 0
    while ((match = citationRegex.exec(msg.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: msg.content.slice(lastIndex, match.index), isCitation: false })
      }
      parts.push({ text: match[0], isCitation: true })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < msg.content.length) {
      parts.push({ text: msg.content.slice(lastIndex), isCitation: false })
    }

    return (
      <>
        {parts.map((part, i) => {
          if (!part.isCitation) return <span key={i}>{part.text}</span>

          const inner = part.text.slice(1, -1)
          const ids = inner.split(',').map(s => s.trim())

          return (
            <span key={i}>
              {ids.map((id, j) => {
                const index = parseInt(id.replace('chunk-', '')) - 1
                const chunk = msg.chunks?.[index]
                return (
                  <span key={id}>
                    <span
                      onClick={e => {
                        if (!chunk) return
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({ chunk, x: rect.left, y: rect.bottom + 8 })
                      }}
                      title={chunk ? 'Click to view source' : ''}
                      style={{
                        color: 'var(--accent-2)',
                        background: 'var(--accent-glow)',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: chunk ? 'pointer' : 'default',
                        border: '1px solid transparent',
                        transition: 'border-color 0.15s',
                        display: 'inline',
                        lineHeight: 1.8,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                    >
                      {id}
                    </span>
                    {j < ids.length - 1 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>, </span>}
                  </span>
                )
              })}
            </span>
          )
        })}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Chunk tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x, window.innerWidth - 380),
            top: tooltip.y,
            width: 360,
            background: 'var(--bg-2)',
            border: '1px solid var(--accent)',
            borderRadius: 10,
            padding: 14,
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px var(--accent-glow)',
            animation: 'fadeUp 0.15s ease forwards',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--accent-2)',
                background: 'var(--accent-glow)', padding: '2px 8px',
                borderRadius: 4, letterSpacing: '0.04em',
              }}>
                {tooltip.chunk.id.toUpperCase()}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                score: {tooltip.chunk.score.toFixed(3)}
              </span>
            </div>
            <button onClick={() => setTooltip(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 2,
            }}>
              <X size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {tooltip.chunk.section && (
              <span style={{
                fontSize: 10, color: 'var(--text-secondary)',
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                padding: '2px 7px', borderRadius: 4,
              }}>
                {tooltip.chunk.section}
              </span>
            )}
            <span style={{
              fontSize: 10, color: 'var(--text-secondary)',
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              padding: '2px 7px', borderRadius: 4,
            }}>
              ~p.{tooltip.chunk.pageEstimate}
            </span>
          </div>
          <div style={{
            fontSize: 10, color: 'var(--text-muted)',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FileText size={10} />
            {formatPaperName(tooltip.chunk.filename)}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-secondary)',
            lineHeight: 1.7, maxHeight: 200, overflowY: 'auto',
            borderTop: '1px solid var(--border)',
            paddingTop: 10,
          }}>
            {tooltip.chunk.text}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside style={{
        width: 300,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px var(--accent-glow)',
            }}>
              <Zap size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>PaperBuddy</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>RAG RESEARCH ASSISTANT</div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['papers', 'search'] as SidebarView[]).map(view => (
            <button
              key={view}
              onClick={() => setSidebarView(view)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                background: sidebarView === view ? 'var(--bg-3)' : 'transparent',
                color: sidebarView === view ? 'var(--accent-2)' : 'var(--text-muted)',
                fontSize: 11, fontFamily: 'DM Mono, monospace',
                borderBottom: sidebarView === view ? `2px solid var(--accent)` : '2px solid transparent',
                transition: 'all 0.2s', letterSpacing: '0.06em',
              }}
            >
              {view === 'papers' ? 'MY PAPERS' : 'DISCOVER'}
            </button>
          ))}
        </div>

        {/* Papers view */}
        {sidebarView === 'papers' && (
          <>
            <div style={{ padding: '12px 16px 8px' }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--border-2)'}`,
                  borderRadius: 10, padding: '16px 12px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'var(--accent-glow)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Loader size={18} color="var(--accent)" style={{ animation: 'spin-slow 1s linear infinite' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Processing PDF...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Upload size={18} color="var(--text-muted)" />
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Drop PDF or click to upload</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </div>

            {selectedPaperIds.length > 0 && (
              <div style={{
                margin: '0 16px 8px',
                padding: '8px 12px',
                background: 'var(--accent-glow)',
                border: '1px solid var(--accent)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 10, color: 'var(--accent-2)' }}>
                  {selectedPaperIds.length} paper{selectedPaperIds.length > 1 ? 's' : ''} · {papers.filter(p => selectedPaperIds.includes(p.paperId)).reduce((a, p) => a + p.chunkCount, 0)} chunks in session
                </div>
                <button
                  onClick={() => {
                    setSelectedPaperIds([])
                    syncState({ selectedPaperIds: [] })
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 10, padding: 0,
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
              {papers.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                  No papers yet — upload a PDF or discover papers in the search tab
                </div>
              ) : (
                papers.map(p => {
                  const isSelected = selectedPaperIds.includes(p.paperId)
                  const isHovered = hoveredPaper === p.paperId
                  return (
                    <div
                      key={p.paperId}
                      onMouseEnter={() => setHoveredPaper(p.paperId)}
                      onMouseLeave={() => setHoveredPaper(null)}
                      style={{
                        background: isSelected ? 'var(--accent-glow)' : isHovered ? 'var(--bg-3)' : 'var(--bg-3)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : isHovered ? 'var(--border-2)' : 'var(--border)'}`,
                        borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                        animation: 'fadeUp 0.3s ease forwards',
                        transition: 'all 0.2s', position: 'relative',
                      }}
                    >
                      {/* Clickable area for selection */}
                      <div
                        onClick={() => togglePaper(p.paperId)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2,
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-2)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Paper info */}
                        <div style={{ flex: 1, minWidth: 0, paddingRight: isHovered ? 20 : 0 }}>
                          <div style={{
                            fontSize: 11,
                            color: isSelected ? 'var(--accent-2)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{formatPaperName(p.filename)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {p.chunkCount} chunks · {isSelected ? '● in session' : 'click to add'}
                          </div>
                        </div>
                      </div>

                      {/* Trash icon — only visible on hover */}
                      {isHovered && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            deletePaper(p.paperId, p.filename)
                          }}
                          title="Delete paper"
                          style={{
                            position: 'absolute', top: 8, right: 8,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: 4, borderRadius: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#e24b4a'
                            e.currentTarget.style.background = 'rgba(226, 75, 74, 0.1)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--text-muted)'
                            e.currentTarget.style.background = 'none'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* Discover / search view */}
        {sidebarView === 'search' && (
          <>
            <div style={{ padding: '12px 16px 8px' }}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                borderRadius: 8, padding: '8px 10px',
              }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPapers()}
                  placeholder="Search research papers..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text-primary)', fontSize: 12,
                    fontFamily: 'DM Mono, monospace',
                  }}
                />
                <button
                  onClick={searchPapers}
                  disabled={searching || !searchQuery.trim()}
                  style={{
                    background: 'var(--accent)', border: 'none', borderRadius: 6,
                    padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 11,
                    opacity: searching || !searchQuery.trim() ? 0.5 : 1,
                  }}
                >
                  {searching ? '...' : 'Go'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                Powered by OpenAlex · {searchResults.length > 0 ? `${searchResults.length} results` : 'open access papers only ingestable'}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
              {searching && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  Searching OpenAlex...
                </div>
              )}
              {searchResults.map((result, i) => (
                <div key={i} style={{
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px', marginBottom: 10,
                  animation: 'fadeUp 0.3s ease forwards',
                  animationDelay: `${i * 0.05}s`,
                }}>
                  {/* Title */}
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, marginBottom: 6 }}>
                    {result.title}
                  </div>

                  {/* Authors + year */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {result.authors.slice(0, 2).join(', ')}{result.authors.length > 2 ? ` +${result.authors.length - 2}` : ''} · {result.year}
                  </div>

                  {/* Abstract preview */}
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
                    marginBottom: 8, display: '-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {result.abstract}
                  </div>

                  {/* Open access badge + action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                      background: result.isOpenAccess ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-2)',
                      color: result.isOpenAccess ? 'var(--green)' : 'var(--text-muted)',
                      border: `1px solid ${result.isOpenAccess ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                    }}>
                      {result.isOpenAccess ? '● Open Access' : '○ Paywalled'}
                    </span>

                    {result.pdfUrl ? (
                      <button
                        onClick={() => fetchAndIngestPaper(result)}
                        disabled={fetchingPaper === result.title}
                        style={{
                          fontSize: 10, padding: '4px 10px', borderRadius: 6,
                          background: fetchingPaper === result.title ? 'var(--bg-2)' : 'var(--accent)',
                          color: fetchingPaper === result.title ? 'var(--text-muted)' : '#fff',
                          border: 'none', cursor: fetchingPaper === result.title ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {fetchingPaper === result.title ? 'Ingesting...' : '+ Ingest'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Upload manually</span>
                    )}
                  </div>
                </div>
              ))}

              {!searching && searchResults.length === 0 && searchQuery && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 11 }}>
                  No results — try different keywords
                </div>
              )}

              {!searching && searchResults.length === 0 && !searchQuery && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.8 }}>
                  Search for papers related to your research topic. Open access papers can be ingested directly.
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
              Qdrant · Ollama · Gemini · OpenAlex
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>gemini-2.0-flash-lite</div>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)', gap: 12,
        }}>

          {/* Left — Session dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowSessions(p => !p)
                if (!showSessions) loadSessionList()
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                background: showSessions ? 'var(--accent-glow)' : 'var(--bg-3)',
                border: `1px solid ${showSessions ? 'var(--accent)' : 'var(--border)'}`,
                color: showSessions ? 'var(--accent-2)' : 'var(--text-secondary)',
                fontSize: 12, transition: 'all 0.2s',
                fontFamily: 'DM Mono, monospace',
                maxWidth: 280,
              }}
            >
              <ChevronRight
                size={12}
                style={{
                  transform: showSessions ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  flexShrink: 0,
                }}
              />
              <span style={{
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 220,
              }}>
                {sessionsList.find(s => s.id === sessionId)?.preview
                  ?? messages.find(m => m.role === 'user')?.content?.slice(0, 50)
                  ?? 'New Session'}
              </span>
            </button>

            {/* Session dropdown panel */}
            {showSessions && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                width: 340, background: 'var(--bg-2)',
                border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                zIndex: 100, overflow: 'hidden',
                animation: 'fadeUp 0.15s ease forwards',
              }}>
                {/* Dropdown header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: 12, fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                    Sessions
                  </div>
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/sessions', { method: 'POST' })
                      const data = await res.json()
                      localStorage.setItem('paperbuddy_session_id', data.id)
                      setSessionId(data.id)
                      sessionIdRef.current = data.id
                      setMessages([])
                      setSelectedPaperIds([])
                      setPapers([])
                      setSocraticMode(false)
                      setShowSessions(false)
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--accent)', border: 'none',
                      color: '#fff', fontSize: 11,
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    + New
                  </button>
                </div>

                {/* Session list */}
                <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px' }}>
                  {loadingSessions ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                      <Loader size={14} color="var(--accent)" style={{ animation: 'spin-slow 1s linear infinite' }} />
                    </div>
                  ) : sessionsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 11 }}>
                      No sessions yet
                    </div>
                  ) : (
                    sessionsList.map(session => {
                      const isActive = session.id === sessionId
                      return (
                        <div
                          key={session.id}
                          onClick={() => switchSession(session.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                            cursor: 'pointer', transition: 'all 0.15s',
                            background: isActive ? 'var(--accent-glow)' : 'transparent',
                            border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                          }}
                          onMouseEnter={e => {
                            if (!isActive) e.currentTarget.style.background = 'var(--bg-3)'
                          }}
                          onMouseLeave={e => {
                            if (!isActive) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {isActive && (
                              <div style={{ fontSize: 9, color: 'var(--accent-2)', marginBottom: 3, letterSpacing: '0.08em' }}>
                                ● ACTIVE
                              </div>
                            )}
                            <div style={{
                              fontSize: 12,
                              color: isActive ? 'var(--accent-2)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              maxWidth: 220,
                            }}>
                              {session.preview}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                              <span>{session.messageCount} messages</span>
                              <span>{session.paperCount} papers</span>
                              <span>{new Date(session.lastActiveAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteSession(session.id) }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '2px 4px', flexShrink: 0,
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#e24b4a')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )
                    })
                  )}
                  {sessionHasMore && (
                    <div style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => loadSessionList(sessionPage + 1)}
                        disabled={loadingMoreSessions}
                        style={{
                          width: '100%', padding: '8px', borderRadius: 6,
                          background: 'var(--bg-3)', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                          fontFamily: 'DM Mono, monospace',
                        }}
                      >
                        {loadingMoreSessions ? 'Loading...' : 'Load more sessions'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right — workspace tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notes button */}
            <button
              onClick={() => setShowNotes(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                background: showNotes ? 'var(--accent-glow)' : 'var(--bg-3)',
                border: `1px solid ${showNotes ? 'var(--accent)' : 'var(--border)'}`,
                color: showNotes ? 'var(--accent-2)' : 'var(--text-muted)',
                fontSize: 11, transition: 'all 0.2s',
                fontFamily: 'DM Mono, monospace',
              }}
            >
              <FileText size={12} />
              Notes
              {notes.length > 0 && (
                <span style={{
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: 10, padding: '1px 6px', fontSize: 10,
                }}>
                  {notes.length}
                </span>
              )}
            </button>

            {/* Socratic toggle */}
            <button
              onClick={() => {
                const next = !socraticMode
                setSocraticMode(next)
                syncState({ socraticMode: next })
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                background: socraticMode ? 'var(--accent-glow)' : 'var(--bg-3)',
                border: `1px solid ${socraticMode ? 'var(--accent)' : 'var(--border)'}`,
                color: socraticMode ? 'var(--accent-2)' : 'var(--text-muted)',
                fontSize: 11, transition: 'all 0.2s',
                fontFamily: 'DM Mono, monospace',
              }}
            >
              {socraticMode && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 6px var(--accent)',
                }} />
              )}
              Socratic
            </button>
          </div>
        </div>

        {apiError && (
          <div style={{
            margin: '12px 28px 0',
            padding: '10px 14px',
            background: 'rgba(226, 75, 74, 0.1)',
            border: '1px solid rgba(226, 75, 74, 0.3)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: '#e24b4a',
            fontFamily: 'DM Mono, monospace',
          }}>
            <span>⚠️ {apiError}</span>
            <button
              onClick={() => setApiError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e24b4a', padding: 2 }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {sessionLoading ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
          }}>
            <Loader size={24} color="var(--accent)" style={{ animation: 'spin-slow 1s linear infinite' }} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Restoring session...</div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.length === 0 && (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '40px 32px', gap: 32,
                }}>
                  {papers.length === 0 ? (
                    /* No papers yet — full onboarding */
                    <>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 64, height: 64, borderRadius: 16,
                          background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 16px',
                          boxShadow: '0 0 32px var(--accent-glow)',
                        }}>
                          <Zap size={28} color="var(--accent)" />
                        </div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                          Welcome to PaperBuddy
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.7 }}>
                          Your AI-powered research assistant. Upload your papers or discover open-access research to get started.
                        </div>
                      </div>

                      {/* Two paths */}
                      <div style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 480 }}>
                        {/* Upload path */}
                        <div
                          onClick={() => fileRef.current?.click()}
                          style={{
                            flex: 1, padding: '20px 16px', borderRadius: 12, cursor: 'pointer',
                            border: '1px dashed var(--border-2)',
                            background: 'var(--bg-2)',
                            textAlign: 'center', transition: 'all 0.2s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.background = 'var(--accent-glow)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border-2)'
                            e.currentTarget.style.background = 'var(--bg-2)'
                          }}
                        >
                          <Upload size={24} color="var(--accent)" style={{ marginBottom: 10 }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                            Upload a PDF
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Upload your own research papers, dissertations or articles
                          </div>
                        </div>

                        {/* Discover path */}
                        <div
                          onClick={() => setSidebarView('search')}
                          style={{
                            flex: 1, padding: '20px 16px', borderRadius: 12, cursor: 'pointer',
                            border: '1px dashed var(--border-2)',
                            background: 'var(--bg-2)',
                            textAlign: 'center', transition: 'all 0.2s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.background = 'var(--accent-glow)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border-2)'
                            e.currentTarget.style.background = 'var(--bg-2)'
                          }}
                        >
                          <Search size={24} color="var(--accent)" style={{ marginBottom: 10 }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                            Discover Papers
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Search 250M+ open-access papers from OpenAlex
                          </div>
                        </div>
                      </div>

                      {/* Feature highlights */}
                      <div style={{
                        display: 'flex', gap: 24, fontSize: 11,
                        color: 'var(--text-muted)', flexWrap: 'wrap',
                        justifyContent: 'center',
                      }}>
                        {[
                          '📄 Citation-grounded answers',
                          '🔍 Hybrid semantic search',
                          '📝 Research notes & export',
                          '🔄 Persistent sessions',
                        ].map(f => (
                          <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{f}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Papers exist but no messages yet — prompt to ask */
                    <>
                      <div style={{ textAlign: 'center', opacity: 0.7 }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: 14,
                          border: '1px solid var(--border-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 16px',
                        }}>
                          <FileText size={24} color="var(--text-muted)" />
                        </div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, marginBottom: 6 }}>
                          {selectedPaperIds.length === 0
                            ? 'Select a paper to start querying'
                            : 'Ready — ask anything about your papers'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {selectedPaperIds.length === 0
                            ? 'Check the boxes next to your papers in the sidebar'
                            : `${selectedPaperIds.length} paper${selectedPaperIds.length > 1 ? 's' : ''} selected · ${papers.filter(p => selectedPaperIds.includes(p.paperId)).reduce((a, p) => a + p.chunkCount, 0)} chunks ready`}
                        </div>
                      </div>

                      {/* Suggested questions */}
                      {selectedPaperIds.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 440 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>
                            SUGGESTED QUESTIONS
                          </div>
                          {[
                            'What is this research about?',
                            'What methodology is used?',
                            'Who are the participants?',
                            'What are the key findings?',
                          ].map(q => (
                            <button
                              key={q}
                              onClick={() => setInput(q)}
                              style={{
                                background: 'var(--bg-2)', border: '1px solid var(--border)',
                                borderRadius: 8, padding: '10px 14px',
                                color: 'var(--text-secondary)', fontSize: 12,
                                cursor: 'pointer', textAlign: 'left',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                transition: 'border-color 0.2s', fontFamily: 'DM Mono, monospace',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            >
                              {q}
                              <ChevronRight size={12} color="var(--text-muted)" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={msg.id} className="fade-up" style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 12, alignItems: 'flex-start',
                  animationDelay: `${i * 0.05}s`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: msg.role === 'user' ? 'var(--bg-3)' : 'var(--accent)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--border-2)' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600,
                    boxShadow: msg.role === 'assistant' ? '0 0 12px var(--accent-glow)' : 'none',
                  }}>
                    {msg.role === 'user' ? 'U' : <Zap size={12} color="#fff" />}
                  </div>

                  <div style={{ maxWidth: '72%' }}>
                    <div style={{
                      background: msg.role === 'user' ? 'var(--bg-3)' : 'var(--bg-2)',
                      border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'var(--border-2)'}`,
                      borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                      padding: '12px 16px', fontSize: 13, lineHeight: 1.7,
                      color: 'var(--text-primary)',
                    }}>
                      {renderMessageContent(msg)}
                    </div>
                    {/* {msg.role === 'assistant' && msg.chunks && msg.chunks.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {msg.chunks.map(chunk => (
                      <button
                        key={chunk.id}
                        onClick={e => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect()
                          setTooltip({ chunk, x: rect.left, y: rect.bottom + 8 })
                        }}
                        style={{
                          fontSize: 10, color: 'var(--text-muted)',
                          background: 'var(--bg-3)', border: '1px solid var(--border)',
                          borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--accent)'
                          e.currentTarget.style.color = 'var(--accent-2)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        {chunk.id} · {chunk.score.toFixed(2)}
                      </button>
                    ))}
                  </div>
                )} */}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {formatTime(msg.timestamp)}
                    </div>
                    {msg.role === 'assistant' && msg.content !== '' && msg.chunks && msg.chunks.length > 0 && (
                      <button
                        onClick={() => saveNote(msg)}
                        disabled={savingNote === msg.id}
                        style={{
                          marginTop: 4,
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: 10,
                          fontFamily: 'DM Mono, monospace',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--accent)'
                          e.currentTarget.style.color = 'var(--accent-2)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        <FileText size={10} />
                        {savingNote === msg.id ? 'Saving...' : '+ Save to notes'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {retryCountdown !== null && (
              <div style={{
                padding: '8px 28px',
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                borderRadius: 8,
                margin: '0 28px 8px',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, color: 'var(--amber)',
                fontFamily: 'DM Mono, monospace',
              }}>
                <Loader size={11} style={{ animation: 'spin-slow 1s linear infinite' }} />
                Rate limited — retrying in {retryCountdown}s...
              </div>
            )}

            <div style={{
              padding: '16px 28px 24px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-end',
                background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                borderRadius: 12, padding: '10px 12px', transition: 'border-color 0.2s',
              }}
                onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedPaperIds.length === 0 ? 'Select papers from the sidebar...' : 'Ask anything across your selected papers...'}
                  disabled={selectedPaperIds.length === 0 || querying}
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'DM Mono, monospace',
                    resize: 'none', lineHeight: 1.6, maxHeight: 120, overflowY: 'auto',
                  }}
                />
                <button
                  onClick={querying ? stopGenerating : sendMessage}
                  disabled={!querying && (!input.trim() || selectedPaperIds.length === 0)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: 'none',
                    background: querying
                      ? 'rgba(226, 75, 74, 0.2)'
                      : input.trim() && selectedPaperIds.length > 0
                        ? 'var(--accent)'
                        : 'var(--bg-3)',
                    cursor: querying || (input.trim() && selectedPaperIds.length > 0) ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.2s',
                    boxShadow: querying ? '0 0 12px rgba(226,75,74,0.3)' : input.trim() ? '0 0 12px var(--accent-glow)' : 'none',
                  }}
                >
                  {querying
                    ? <Square size={12} color="#e24b4a" />
                    : <Send size={14} color={input.trim() && selectedPaperIds.length > 0 ? '#fff' : 'var(--text-muted)'} />
                  }
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                {querying
                  ? 'Click ■ to stop generation'
                  : 'Enter to send · Shift+Enter for new line · Click citations to view source'}
              </div>
            </div>
          </>
        )}
      </main>

      {showNotes && (
        <div style={{
          width: 340, background: 'var(--bg-2)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0,
        }}>
          {/* Notes header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14 }}>Research Notes</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{notes.length} saved</div>
            </div>
            <button
              onClick={exportNotes}
              disabled={exporting || notes.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6, cursor: notes.length === 0 ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 11, opacity: notes.length === 0 ? 0.4 : 1,
                fontFamily: 'DM Mono, monospace',
              }}
            >
              {exporting ? <Loader size={11} /> : <Download size={11} />}
              {exporting ? 'Exporting...' : 'Export .docx'}
            </button>
          </div>

          {/* Notes list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {notes.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 0',
                color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.8,
              }}>
                No notes yet. Click "+ Save to notes" below any answer to save it here.
              </div>
            ) : (
              notes.map((note, i) => (
                <div key={note.id} style={{
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px', marginBottom: 10,
                  animation: 'fadeUp 0.3s ease forwards',
                }}>
                  {/* Question */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Q: {note.question.slice(0, 80)}{note.question.length > 80 ? '...' : ''}
                  </div>

                  {/* Answer preview */}
                  <div style={{
                    fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6,
                    marginBottom: 8,
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {note.answer.replace(/\[chunk-\d+(?:,\s*chunk-\d+)*\]/g, '').trim()}
                  </div>

                  {/* Chunk pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {note.chunks.map(chunk => (
                      <span
                        key={chunk.id}
                        onClick={e => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect()
                          setTooltip({ chunk, x: rect.left - 360, y: rect.bottom + 8 })
                        }}
                        style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          background: 'var(--accent-glow)', color: 'var(--accent-2)',
                          border: '1px solid transparent', cursor: 'pointer',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                      >
                        {chunk.id}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(note.createdAt).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => deleteNote(note.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 2,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e24b4a')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
            {notesHasMore && (
              <button
                onClick={() => loadNotes(sessionId!, notesPage + 1)}
                disabled={loadingMoreNotes}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'DM Mono, monospace', marginTop: 4,
                }}
              >
                {loadingMoreNotes ? 'Loading...' : 'Load more notes'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}