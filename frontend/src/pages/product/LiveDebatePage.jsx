import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Copy,
  Gamepad2,
  Link2,
  LogOut,
  Mic2,
  Play,
  RefreshCw,
  RotateCcw,
  Share2,
  Sparkles,
  Swords,
  Timer,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { productApi } from '../../services/productApi.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function LiveDebatePage({ currentPath = '', currentUser }) {
  const [room, setRoom] = useState(null)
  const [topic, setTopic] = useState('AI Regulation practice round')
  const [joinCode, setJoinCode] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [startBurst, setStartBurst] = useState(false)
  const [clockTick, setClockTick] = useState(0)
  const autoJoinRef = useRef(false)
  const coachNoteRef = useRef(null)
  const currentUserName = getUserDisplayName(currentUser)

  const applyRoom = useCallback((nextRoom, { forceBurst = false } = {}) => {
    const normalized = normalizeRoom(nextRoom)
    setRoom((current) => {
      const shouldBurst = normalized.status === 'running' && (forceBurst || current?.status !== 'running')
      if (shouldBurst) window.setTimeout(() => setStartBurst(true), 0)
      return normalized
    })
  }, [])

  const joinRoom = useCallback(async (rawCode = joinCode) => {
    const code = cleanRoomCode(rawCode)
    if (!code) {
      setError('Enter the room code from the other device.')
      return
    }

    setBusy('join')
    setError('')
    try {
      const data = await productApi.joinLiveRoom(code)
      applyRoom(data.room)
      setJoinCode(code)
      replaceRoomUrl(code)
    } catch (joinError) {
      setError(joinError.message || 'Unable to join that live debate room.')
    } finally {
      setBusy('')
    }
  }, [applyRoom, joinCode])

  useEffect(() => {
    const queryString = currentPath.split('?')[1] || ''
    const code = cleanRoomCode(new URLSearchParams(queryString).get('room') || '')
    if (!code || autoJoinRef.current) return
    autoJoinRef.current = true
    setJoinCode(code)
    joinRoom(code)
  }, [currentPath, joinRoom])

  useEffect(() => {
    if (!room?.roomCode) return undefined
    let cancelled = false
    const pollRoom = async () => {
      try {
        const data = await productApi.liveRoom(room.roomCode)
        if (!cancelled) applyRoom(data.room)
      } catch (pollError) {
        if (!cancelled && room.status === 'running') {
          setError(pollError.message || 'Live room sync failed. Retrying...')
        }
      }
    }
    const interval = window.setInterval(pollRoom, room.status === 'running' ? 1800 : 2600)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [applyRoom, room?.roomCode, room?.status])

  useEffect(() => {
    if (room?.status !== 'running') return undefined
    const interval = window.setInterval(() => setClockTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [room?.status])

  useEffect(() => {
    if (!startBurst) return undefined
    const timeout = window.setTimeout(() => setStartBurst(false), 2600)
    return () => window.clearTimeout(timeout)
  }, [startBurst])

  useEffect(() => {
    if (!currentPath.includes('focus=coach')) return
    const frameId = window.requestAnimationFrame(() => {
      coachNoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [currentPath])

  const transcript = room?.statements || []
  const hasScoredEntries = transcript.some((entry) => typeof entry.score === 'number')
  const hasHostScore = transcript.some((entry) => entry.speakerKey === 'host' && typeof entry.score === 'number')
  const hasOpponentScore = transcript.some((entry) => entry.speakerKey === 'opponent' && typeof entry.score === 'number')
  const speakerScores = room?.scores || computeSpeakerScores(transcript)
  const latestImprovementPlan = useMemo(() => getLatestImprovementPlan(transcript), [transcript])
  const latestStatement = useMemo(() => [...transcript].reverse().find((entry) => entry.status === 'Analyzed'), [transcript])
  const elapsedSeconds = getElapsedSeconds(room, clockTick)
  const shareLink = useMemo(() => buildShareLink(room?.roomCode), [room?.roomCode])
  const roleLabel = roleName(room?.userRole)
  const isParticipant = room?.userRole === 'host' || room?.userRole === 'opponent'
  const canWrite = Boolean(room?.canSubmit && isParticipant && room.status === 'running')
  const statusText = room ? liveStatusText(room) : 'Ready'
  const latestCounterargument = room?.latestCounterargument || buildSuggestedCounterargument(latestStatement?.analysis, latestStatement?.reply, latestStatement?.text)
  const latestCoachNote = room?.latestReply || latestStatement?.reply || ''

  const createRoom = async () => {
    setBusy('create')
    setError('')
    try {
      const data = await productApi.createLiveRoom({ topic })
      applyRoom(data.room)
      replaceRoomUrl(data.room.roomCode)
    } catch (createError) {
      setError(createError.message || 'Unable to create a live debate room.')
    } finally {
      setBusy('')
    }
  }

  const startLiveDebate = async () => {
    if (!room?.roomCode) return
    setBusy('start')
    setError('')
    try {
      const data = await productApi.startLiveRoom(room.roomCode)
      applyRoom(data.room, { forceBurst: true })
    } catch (startError) {
      setError(startError.message || 'Unable to start this debate.')
    } finally {
      setBusy('')
    }
  }

  const submitStatement = async () => {
    const statement = draft.trim()
    if (!room?.roomCode || !statement || busy) return
    if (!canWrite) {
      setError(room?.status === 'running'
        ? 'Only the signed-in host or joined opponent can submit.'
        : 'Start the room after the opponent joins from another device.')
      return
    }

    setBusy('submit')
    setError('')
    try {
      const data = await productApi.submitLiveStatement(room.roomCode, statement)
      setDraft('')
      applyRoom(data.room)
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit this statement.')
    } finally {
      setBusy('')
    }
  }

  const refreshRoom = async () => {
    if (!room?.roomCode) return
    setBusy('refresh')
    setError('')
    try {
      const data = await productApi.liveRoom(room.roomCode)
      applyRoom(data.room)
    } catch (refreshError) {
      setError(refreshError.message || 'Unable to refresh this debate room.')
    } finally {
      setBusy('')
    }
  }

  const copyInvite = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy failed. Manually send the room code instead.')
    }
  }

  const leaveRoom = () => {
    setRoom(null)
    setDraft('')
    setError('')
    setCopied(false)
    setStartBurst(false)
    setJoinCode('')
    replaceRoomUrl('')
  }

  return (
    <div className="product-page live-page">
      {startBurst && <DebateStartBurst room={room} />}

      <PageHeading
        title="Live debate"
        description="Host a real two-device debate room, sync both speakers, and get live analysis after every turn."
        action={<span className={`live-session-state ${room?.status === 'running' ? 'running' : ''}`}><i /> {statusText}</span>}
      />

      {!room ? (
        <section className="live-room-setup">
          <article className="product-panel live-setup-card featured">
            <PanelHeading title="Host a debate room" meta="Device 1" />
            <Gamepad2 size={28} />
            <h2>Create a match lobby</h2>
            <p>Start here, then send the invite link to your opponent so they join from another phone, laptop, or browser.</p>
            <label htmlFor="live-topic">Round topic</label>
            <input
              id="live-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Example: AI regulation, school phones, climate policy..."
            />
            <button className="product-button primary" disabled={busy === 'create'} type="button" onClick={createRoom}>
              {busy === 'create' ? <RefreshCw className="spin" size={17} /> : <Swords size={17} />}
              {busy === 'create' ? 'Creating room...' : 'Create live room'}
            </button>
          </article>

          <article className="product-panel live-setup-card">
            <PanelHeading title="Join as opponent" meta="Device 2" />
            <UserPlus size={28} />
            <h2>Enter room code</h2>
            <p>Use this only on the second device/account. The opponent is no longer controlled from the host screen.</p>
            <label htmlFor="live-room-code">Room code</label>
            <input
              id="live-room-code"
              value={joinCode}
              onChange={(event) => setJoinCode(cleanRoomCode(event.target.value))}
              placeholder="ABC123"
            />
            <button className="product-button secondary" disabled={busy === 'join'} type="button" onClick={() => joinRoom()}>
              {busy === 'join' ? <RefreshCw className="spin" size={17} /> : <Link2 size={17} />}
              {busy === 'join' ? 'Joining...' : 'Join room'}
            </button>
          </article>
        </section>
      ) : (
        <>
          <section className="live-room-lobby product-panel">
            <div className="live-room-code-card">
              <span>Room code</span>
              <strong>{room.roomCode}</strong>
              <small>Send this to the opponent device.</small>
            </div>
            <div className="live-participants">
              <ParticipantCard label="Host" name={room.hostName} active={room.userRole === 'host'} ready />
              <ParticipantCard label="Opponent" name={room.opponentName || 'Waiting for second device'} active={room.userRole === 'opponent'} ready={Boolean(room.opponentName)} />
            </div>
            <div className="live-share-actions">
              <button className="product-button secondary" type="button" onClick={copyInvite}>
                <Copy size={16} />
                {copied ? 'Copied invite' : 'Copy invite link'}
              </button>
              <button className="product-button secondary" disabled={busy === 'refresh'} type="button" onClick={refreshRoom}>
                <RefreshCw className={busy === 'refresh' ? 'spin' : ''} size={16} />
                Sync
              </button>
            </div>
          </section>

          <section className="live-control-bar live-room-control-bar">
            <div><Timer size={18} /><span>Session time</span><strong>{formatTime(elapsedSeconds)}</strong></div>
            <div><Users size={18} /><span>Your side</span><strong>{roleLabel}</strong></div>
            <div className="live-control-actions">
              <button className="product-button secondary" type="button" onClick={leaveRoom}><LogOut size={17} /> Leave room</button>
              {room.status === 'running' ? (
                <span className="live-match-badge"><Zap size={15} /> Match live</span>
              ) : room.userRole === 'host' ? (
                <button className="product-button primary" disabled={!room.canStart || busy === 'start'} type="button" onClick={startLiveDebate}>
                  {busy === 'start' ? <RefreshCw className="spin" size={17} /> : <Play size={17} />}
                  {room.opponentName ? 'Start live debate' : 'Waiting for opponent'}
                </button>
              ) : (
                <span className="live-match-badge waiting"><RotateCcw size={15} /> Waiting for host</span>
              )}
            </div>
          </section>

          <section className="live-game-hint">
            <Share2 size={17} />
            <span>
              {room.status === 'waiting'
                ? 'Invite an opponent from another device. The host screen cannot play both sides anymore.'
                : room.status === 'ready'
                  ? 'Opponent connected. Host can trigger the debate-start animation.'
                  : 'Both devices are synced. Each statement is saved and analyzed under the real speaker.'}
            </span>
          </section>

          <section className="live-grid">
            <article className="product-panel live-transcript">
              <PanelHeading title="Live transcript" meta={`${transcript.length} statements`} />
              <div className="live-statements">
                {transcript.length ? transcript.map((entry) => (
                    <div className={entry.speakerKey === room.userRole ? 'own-statement' : ''} key={entry.id}>
                      <span className={entry.speakerKey === 'host' ? 'speaker-a' : 'speaker-b'}>{entry.speakerName}</span>
                      <p>{entry.text}</p>
                      <small className={entryStatusTone(entry)}>
                        {entry.speakerKey === room.userRole ? 'You - ' : ''}{entry.status} - {entry.score}%
                      </small>
                    </div>
                  )) : (
                    <div className="panel-empty-state compact">
                      <strong>No live statements yet.</strong>
                      <p>{room.status === 'running' ? 'Send the first argument from your device.' : 'Start the match after the second device joins.'}</p>
                    </div>
                  )}
              </div>
              <div className="live-entry">
                <div className="live-device-lock">
                  <span>{roleLabel}</span>
                  <strong>{currentUserName}</strong>
                  <small>{room.userRole === 'host' ? 'Host device' : room.userRole === 'opponent' ? 'Opponent device' : 'Read-only'}</small>
                </div>
                <label htmlFor="live-statement">{roleLabel} statement</label>
                <textarea
                  id="live-statement"
                  rows={3}
                  placeholder={canWrite ? 'Type your next argument...' : room.status === 'running' ? 'This room is read-only for this account.' : 'Waiting for the room to start...'}
                  value={draft}
                  disabled={!canWrite || busy === 'submit'}
                  onChange={(event) => setDraft(event.target.value)}
                />
                {error && <div className="live-error">{error}</div>}
                <button className="product-button primary" disabled={busy === 'submit' || !canWrite || !draft.trim()} type="button" onClick={submitStatement}>
                  {busy === 'submit' ? <RefreshCw className="spin" size={17} /> : <Mic2 size={17} />}
                  {busy === 'submit' ? 'Analyzing turn...' : canWrite ? 'Send turn' : 'Room not live yet'}
                </button>
                {shareLink && <small className="live-session-meta">Invite: {shareLink}</small>}
              </div>
            </article>

            <div className="live-analysis-stack">
              <article className="product-panel">
                <PanelHeading
                  title="Real-time analysis"
                  meta={hasScoredEntries ? 'From synced room turns' : room.status === 'running' ? 'Waiting for first turn' : 'Lobby mode'}
                />
                <div className="speaker-score-row">
                  <span>{room.hostName}<strong>{hasHostScore ? `${speakerScores.host || 0}%` : 'No data'}</strong></span>
                  <progress aria-label={`${room.hostName} score`} className="score-progress" max="100" value={hasHostScore ? speakerScores.host || 0 : 0} />
                </div>
                <div className="speaker-score-row beta">
                  <span>{room.opponentName || 'Opponent'}<strong>{hasOpponentScore ? `${speakerScores.opponent || 0}%` : 'No data'}</strong></span>
                  <progress aria-label="Opponent score" className="score-progress" max="100" value={hasOpponentScore ? speakerScores.opponent || 0 : 0} />
                </div>
                <div className="live-signal-list">
                  {buildLiveSignals(room).map((signal) => (
                    <div className={signal.tone} key={signal.title}>
                      {signal.tone === 'green' ? <CheckCircle2 size={17} /> : signal.tone === 'amber' ? <AlertTriangle size={17} /> : <CircleStop size={17} />}
                      <span><strong>{signal.title}</strong><small>{signal.detail}</small></span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="product-panel live-counter">
                <PanelHeading title="Suggested counterargument" />
                <Sparkles size={20} />
                <div className="live-generated-analysis">
                  {(latestCounterargument || 'Submit a real turn to generate a counterargument from DebateHelp.')
                    .split('\n\n')
                    .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                <small>{latestCounterargument ? 'Generated from the latest synced turn' : 'Waiting for real debate input'}</small>
              </article>

              <article className="product-panel live-coach-note" data-product-focus="coach" ref={coachNoteRef}>
                <PanelHeading title="Coach note" />
                <p>{latestCoachNote ? summarizeLiveAnalysis(latestCoachNote) : 'Coach notes appear after DebateHelp analyzes a room turn.'}</p>
                {latestImprovementPlan.length ? (
                  <div className="live-improvement-list" aria-label="Latest live debate improvement plan">
                    {latestImprovementPlan.slice(0, 3).map((item, index) => (
                      <div key={`${item.area}-${item.action}`}>
                        <span>{index + 1}</span>
                        <strong>{item.area} · {item.score}%</strong>
                        <small>{item.action}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ParticipantCard({ label, name, active, ready }) {
  return (
    <div className={`${ready ? 'ready' : 'waiting'} ${active ? 'active' : ''}`}>
      <span>{label}</span>
      <strong>{name}</strong>
      <small>{active ? 'This device' : ready ? 'Connected' : 'Not joined yet'}</small>
    </div>
  )
}

function DebateStartBurst({ room }) {
  return (
    <div className="debate-start-burst" role="status" aria-live="assertive">
      <div>
        <Swords size={44} />
        <span>Debate starting</span>
        <strong>CLASH!</strong>
        <small>{room?.hostName || 'Host'} vs {room?.opponentName || 'Opponent'}</small>
      </div>
    </div>
  )
}

function normalizeRoom(room) {
  return {
    roomCode: room?.roomCode || '',
    topic: room?.topic || 'Live Debate',
    status: room?.status || 'waiting',
    userRole: room?.userRole || 'viewer',
    hostName: room?.hostName || 'Host',
    opponentName: room?.opponentName || '',
    participantCount: Number(room?.participantCount || 0),
    canStart: Boolean(room?.canStart),
    canSubmit: Boolean(room?.canSubmit),
    startedAt: room?.startedAt || null,
    elapsedSeconds: Number(room?.elapsedSeconds || 0),
    statements: Array.isArray(room?.statements) ? room.statements.map(normalizeStatement) : [],
    scores: room?.scores || { host: 0, opponent: 0 },
    latestReply: room?.latestReply || '',
    latestCounterargument: room?.latestCounterargument || '',
    latestAnalysis: room?.latestAnalysis || null,
  }
}

function normalizeStatement(entry) {
  return {
    id: entry?.id || createLocalId('statement'),
    speakerKey: entry?.speakerKey || 'host',
    speakerName: entry?.speakerName || (entry?.speakerKey === 'opponent' ? 'Opponent' : 'Host'),
    text: entry?.text || '',
    reply: entry?.reply || '',
    analysis: entry?.analysis || {},
    score: toScore(entry?.score),
    status: entry?.status || 'Analyzed',
    createdAt: entry?.createdAt || '',
  }
}

function cleanRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

function replaceRoomUrl(code) {
  if (!globalThis.history) return
  const nextPath = code ? `/app/live?room=${encodeURIComponent(code)}` : '/app/live'
  globalThis.history.replaceState(null, '', nextPath)
}

function buildShareLink(code) {
  if (!code || !globalThis.location) return ''
  return `${globalThis.location.origin}/app/live?room=${encodeURIComponent(code)}`
}

function liveStatusText(room) {
  if (!room) return 'Ready'
  if (room.status === 'running') return 'Match live'
  if (room.status === 'ready') return 'Opponent ready'
  if (room.status === 'paused') return 'Paused'
  return 'Waiting for opponent'
}

function roleName(role) {
  if (role === 'host') return 'Host'
  if (role === 'opponent') return 'Opponent'
  return 'Viewer'
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function getElapsedSeconds(room, tick) {
  if (!room) return 0
  if (room.status !== 'running' || !room.startedAt) return room.elapsedSeconds || 0
  const started = Date.parse(room.startedAt)
  if (!Number.isFinite(started)) return room.elapsedSeconds || 0
  return Math.max(0, Math.round(((tick || Date.now()) - started) / 1000))
}

function createLocalId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`
  return `${prefix}-${Date.now()}`
}

function getUserDisplayName(currentUser) {
  return currentUser?.full_name || currentUser?.email || 'You'
}

function toScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.round(number)))
}

function computeSpeakerScores(entries) {
  const totals = entries.reduce((scores, entry) => {
    const key = entry.speakerKey === 'opponent' ? 'opponent' : 'host'
    if (!scores[key]) scores[key] = []
    scores[key].push(toScore(entry.score))
    return scores
  }, { host: [], opponent: [] })
  return {
    host: totals.host.length ? Math.round(totals.host.reduce((sum, score) => sum + score, 0) / totals.host.length) : 0,
    opponent: totals.opponent.length ? Math.round(totals.opponent.reduce((sum, score) => sum + score, 0) / totals.opponent.length) : 0,
  }
}

function buildSuggestedCounterargument(analysis, reply, statement) {
  const fromReply = extractLabeledSection(reply, 'Counterargument')
  if (fromReply) return fromReply

  if (analysis?.counterargument) return analysis.counterargument

  if (Array.isArray(analysis?.counterarguments) && analysis.counterarguments.length) {
    return analysis.counterarguments.join('\n\n')
  }

  return statement ? defaultCounterargument(statement) : ''
}

function extractLabeledSection(text = '', label) {
  if (!text) return ''
  const labels = [
    'Computed diagnosis',
    'Strongest part',
    'Main weakness',
    'Priority fixes',
    'Counterargument',
    'Stronger framing',
    'Confidence',
  ].join('|')
  const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\n(?:${labels}):|$)`, 'i')
  const match = text.match(pattern)
  return match?.[1]?.trim() || ''
}

function defaultCounterargument(statement = '') {
  const normalized = statement.toLowerCase()
  if (/ai|artificial intelligence|algorithm/.test(normalized)) {
    return 'A strong opponent can argue that broad rules raise compliance costs, protect large incumbents, and slow useful low-risk innovation.'
  }
  if (/school|student|education|university|college/.test(normalized)) {
    return 'A strong opponent can agree with the learning goal while arguing that teacher capacity, schedule pressure, and unequal implementation determine whether the reform actually works.'
  }
  if (/climate|carbon|emission/.test(normalized)) {
    return 'A strong opponent can argue that the policy changes costs without proving it will change behavior fast enough to reduce emissions.'
  }
  if (/health|medical|care/.test(normalized)) {
    return 'A strong opponent can accept the access goal while challenging funding, provider capacity, wait times, and transition costs.'
  }
  return 'A strong opponent can challenge whether your evidence proves this specific conclusion instead of a narrower alternative.'
}

function buildLiveSignals(room) {
  const entries = room?.statements || []
  const latestScored = [...entries].reverse().find((entry) => typeof entry.score === 'number' && entry.status === 'Analyzed')
  if (!room?.opponentName) {
    return [
      {
        title: 'Waiting for real opponent',
        detail: 'Copy the invite link and open it from another signed-in device. This screen no longer controls both sides.',
        tone: 'amber',
      },
    ]
  }
  if (!latestScored) {
    return [
      {
        title: room.status === 'running' ? 'Match started' : 'Lobby ready',
        detail: room.status === 'running'
          ? 'Send the first real statement to create live scoring.'
          : 'The host can start the match and trigger the game intro.',
        tone: room.status === 'running' ? 'green' : 'amber',
      },
    ]
  }
  const analysis = latestScored.analysis || {}
  const sources = Array.isArray(analysis.sources) ? analysis.sources : []
  const fallacies = Array.isArray(analysis.fallacies) ? analysis.fallacies : []
  const improvementPlan = normalizeImprovementPlan(analysis.improvementPlan || analysis.improvement_plan)
  const topPlan = improvementPlan[0]
  return [
    {
      title: 'Latest synced turn analyzed',
      detail: `${latestScored.speakerName} scored ${latestScored.score}% on the newest room statement${analysis.method ? ` using ${analysis.method}` : ''}.`,
      tone: 'green',
    },
    {
      title: sources.length ? 'Evidence signals found' : 'Evidence gap',
      detail: sources.length
        ? `${sources.length} source/statistic/citation signal${sources.length === 1 ? '' : 's'} detected by the backend analyzer.`
        : 'The backend analyzer found no source, statistic, or citation signal in the latest statement.',
      tone: sources.length ? 'green' : 'amber',
    },
    {
      title: fallacies.length ? 'Reasoning risk flagged' : 'No major fallacy flag',
      detail: fallacies.length
        ? `${fallacies[0].name || 'Reasoning risk'}: ${fallacies[0].detail || 'Review this reasoning step.'}`
        : 'No major fallacy pattern was detected for the latest statement.',
      tone: fallacies.length ? 'red' : 'green',
    },
    {
      title: 'Next coaching move',
      detail: topPlan
        ? `${topPlan.area}: ${topPlan.action}`
        : 'Keep adding live statements to build a stronger session report.',
      tone: topPlan ? 'amber' : 'green',
    },
  ]
}

function getLatestImprovementPlan(entries) {
  const latestScored = [...entries]
    .reverse()
    .find((entry) => typeof entry.score === 'number' && entry.status === 'Analyzed')
  if (!latestScored?.analysis) return []
  return normalizeImprovementPlan(latestScored.analysis.improvementPlan || latestScored.analysis.improvement_plan)
}

function normalizeImprovementPlan(plan) {
  if (!Array.isArray(plan)) return []
  return plan.slice(0, 6).map((item, index) => ({
    area: item?.area || `Priority ${index + 1}`,
    score: toScore(item?.score ?? 0),
    action: item?.action || 'Add a clearer source, warrant, or answer to the strongest objection.',
  }))
}

function entryStatusTone(entry) {
  if (entry.status === 'Analyzed') return 'success'
  if (entry.status === 'Analysis failed') return 'danger'
  return 'warning'
}

function summarizeLiveAnalysis(reply) {
  return reply.split(/\n{2,}|(?<=[.!?])\s+/).find(Boolean) || reply
}

export default LiveDebatePage
