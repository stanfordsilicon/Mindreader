import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');
const POLL_INTERVAL_MS = 2000;
const ROUND_SECONDS = 30;

type Player = { user_id: string; name: string };
type RoomState = {
  players: Player[];
  scores: Record<string, number>;
  total_players: number;
  state: 'waiting' | 'playing' | 'ended';
  round: number;
  emoji?: string;
  submitted_count: number;
  submitted_user_ids: string[];
};

type RoundResults = {
  round: number;
  emoji: string;
  results: Record<string, Record<string, number>>;
  round_scores: Record<string, number>;
  total_scores: Record<string, number>;
};

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const userId = localStorage.getItem('qmoji_user_id');
  const username = localStorage.getItem('qmoji_username');

  const [keywords, setKeywords] = useState(['', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollRef = useRef<number | null>(null);
  const lastRoundRef = useRef<number>(0);

  const isHost = Boolean(roomState?.players[0]?.user_id && roomState.players[0].user_id === userId);

  const getPlayerName = useCallback(
    (id: string) => {
      if (id === userId) return 'You';
      const match = roomState?.players.find((p) => p.user_id === id);
      return match?.name ?? `Player ${id.slice(0, 6)}`;
    },
    [roomState, userId],
  );

  useEffect(() => {
    if (!roomId || !userId || !username) {
      navigate('/multiplayer');
    }
  }, [roomId, userId, username, navigate]);

  useEffect(() => {
    if (!roomId || !userId || !username || hasJoined) return;

    const join = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, user_id: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to join room.');
        }
        setHasJoined(true);
      } catch (err: any) {
        setError(err.message || 'Error joining the room.');
      }
    };

    join();
  }, [roomId, userId, username, hasJoined]);

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/state`);
      if (res.status === 404) {
        setError('Room no longer exists.');
        return;
      }
      if (!res.ok) throw new Error('Error fetching room state.');
      const data: RoomState = await res.json();

      if (data.round > lastRoundRef.current) {
        lastRoundRef.current = data.round;
        setKeywords(['', '', '', '']);
        setTimeLeft(ROUND_SECONDS);
        setSubmitSuccess(false);
        setShowResults(false);
        setRoundResults(null);
      }

      setRoomState(data);
    } catch (err: any) {
      setError(err.message || 'Error updating room state.');
    }
  }, [roomId]);

  useEffect(() => {
    if (!hasJoined) return;
    fetchState();
    pollRef.current = window.setInterval(fetchState, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [hasJoined, fetchState]);

  const fetchRoundResults = useCallback(async () => {
    if (!roomId) return;
    setIsLoadingResults(true);
    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/round_results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Could not load round results.');
      const data: RoundResults = await res.json();
      setRoundResults(data);
      setShowResults(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load round results.');
    } finally {
      setIsLoadingResults(false);
    }
  }, [roomId]);

  const handleStartRound = useCallback(async () => {
    if (!roomId) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/start_round`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to fetch new emoji.');
      setShowResults(false);
      await fetchState();
    } catch (err: any) {
      setError(err.message || 'Error fetching new emoji.');
    } finally {
      setIsSubmitting(false);
    }
  }, [roomId, fetchState]);

  useEffect(() => {
    if (roomState?.state !== 'playing') return;

    if (timeLeft > 0) {
      const timer = window.setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => window.clearTimeout(timer);
    }

    if (!roundResults || roundResults.round !== roomState.round) {
      fetchRoundResults();
    }
  }, [roomState?.state, roomState?.round, timeLeft, isHost, handleStartRound, fetchRoundResults, roundResults]);

  const handleKeywordChange = (index: number, value: string) => {
    setKeywords((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !userId) return;

    const filled = keywords.filter((k) => k.trim() !== '');
    if (filled.length === 0) {
      setError('Please fill out at least one keyword before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSubmitSuccess(false);
    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: filled, user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit keywords.');
      }
      setSubmitSuccess(true);
      await fetchState();
    } catch (err: any) {
      setError(err.message || 'Error submitting keywords.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
  if (roomId && userId) {
    try {
      // 1. Tell backend to remove player from room state
      await fetch(`${API_BASE_URL}/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch (err) {
      console.error('Failed to notify backend on leave:', err);
    }
  }

  // 2. Clear local storage and navigate back
  localStorage.removeItem('qmoji_current_room');
  navigate('/multiplayer');
};

  const alreadySubmitted = roomState?.submitted_user_ids.includes(userId ?? '') ?? false;

  const sortedScoreboard = roomState
    ? [...roomState.players]
        .map((p) => ({ ...p, score: roomState.scores[p.user_id] ?? 0 }))
        .sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="qmoji-card">
      <div className="qmoji-header-row">
        <button className="qmoji-icon-btn" onClick={handleLeave} aria-label="Leave room">↩</button>
        <span className="qmoji-room-code">{roomId}</span>
      </div>
      <h1 className="qmoji-title">QMoji</h1>
      <p className="qmoji-subtitle">Describe the emoji with up to four keywords in 30 seconds!</p>

      {error && (
        <div style={{ color: '#ffb4a8', background: 'rgba(192,57,43,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: '14px', fontSize: '0.75rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {submitSuccess && !showResults && (
        <p style={{ color: 'var(--qmoji-green-bright)', fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem' }}>
          Successfully saved your keywords!
        </p>
      )}

      {/* ---- Round results modal ---- */}
      {showResults && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Round results"
          onClick={() => setShowResults(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="qmoji-panel-yellow"
            style={{ width: '100%', maxWidth: '380px', maxHeight: '80vh', overflowY: 'auto', position: 'relative', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}
          >
            <button
              type="button"
              onClick={() => setShowResults(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'transparent', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '4px', color: 'var(--qmoji-ink)' }}
            >
              ✕
            </button>

            <h3>Let's see what {getPlayerName(roomState?.players?.[0]?.user_id ?? '')} answered...</h3>

            {isLoadingResults ? (
              <p style={{ textAlign: 'center', fontSize: '0.8rem' }}>Loading results...</p>
            ) : roundResults ? (
              <>
                {userId && (
                  <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#1e4620', margin: '0 0 14px' }}>
                    +{roundResults.round_scores?.[userId] ?? 0} points
                    {roundResults.total_scores?.[userId] !== undefined && (
                      <span style={{ fontWeight: 500, display: 'block', fontSize: '0.7rem', opacity: 0.75 }}>
                        total: {roundResults.total_scores[userId]}
                      </span>
                    )}
                  </p>
                )}

                {Object.entries(roundResults.results).map(([id, words]) => {
                  const sortedWords = Object.entries(words)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a);

                  return (
                    <div key={id} style={{ marginBottom: '18px' }}>
                      <strong style={{ fontSize: '0.8rem' }}>{getPlayerName(id)}</strong>
                      {sortedWords.length === 0 ? (
                        <p style={{ opacity: 0.7, margin: '8px 0 0', fontStyle: 'italic', fontSize: '0.75rem' }}>
                          0 points — no matching words
                        </p>
                      ) : (
                        <div className="qmoji-word-grid" style={{ marginTop: 8 }}>
                          {sortedWords.map(([word, count]) => (
                            <div key={word} className={`qmoji-word-box ${count > 0 ? 'match' : ''}`}>
                              {word} <span style={{ opacity: 0.8, fontWeight: 500 }}>({count})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <p style={{ textAlign: 'center', fontSize: '0.8rem' }}>No results yet.</p>
            )}

            {isHost && (
              <button
                type="button"
                className="qmoji-btn qmoji-btn-green"
                onClick={handleStartRound}
                disabled={isSubmitting}
                style={{ marginTop: '10px' }}
              >
                {isSubmitting ? 'Loading...' : 'Next round'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---- Main room states ---- */}
      {!roomState ? (
        <p style={{ textAlign: 'center', fontSize: '0.8rem' }}>Loading room...</p>
      ) : (
        <>
          {roomState.state === 'waiting' && (
            <div className="qmoji-panel-yellow">
              <h3>Waiting for all players...</h3>
              <div className="qmoji-pill-row">
                {roomState.players.map((p, index) => (
                  <span key={p.user_id} className={`qmoji-pill ${index === 0 ? 'host' : ''}`}>
                    {p.name}{p.user_id === userId ? ' (you)' : ''}
                  </span>
                ))}
              </div>

              {isHost ? (
                <button className="qmoji-btn qmoji-btn-green" onClick={handleStartRound} disabled={isSubmitting} style={{ marginTop: 8 }}>
                  {isSubmitting ? 'Starting...' : 'Start'}
                </button>
              ) : (
                <button className="qmoji-btn qmoji-btn-red" onClick={handleLeave} style={{ marginTop: 8 }}>
                  Leave
                </button>
              )}
              <p style={{ fontSize: '0.65rem', textAlign: 'center', marginTop: 10, opacity: 0.8 }}>
                Share room code <strong>{roomId}</strong> with friends
              </p>
            </div>
          )}

          {roomState.state === 'playing' && (
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '0.75rem', textAlign: 'center',
                marginBottom: 14, color: timeLeft <= 5 ? '#ff8a75' : timeLeft <= 15 ? 'var(--qmoji-yellow)' : 'var(--qmoji-white)',
              }}>
                {timeLeft > 0 ? `${timeLeft}s` : "Time's up!"}
              </div>

              <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: 16 }}>
                {roomState.emoji}
              </div>

              <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.8, marginBottom: 14 }}>
                {roomState.submitted_count} / {roomState.total_players} players have submitted
              </p>

              {!alreadySubmitted ? (
                <form
                  onSubmit={handleSubmit}
                  onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                >
                  <div className="qmoji-word-grid" style={{ marginBottom: 14 }}>
                    {keywords.map((kw, i) => (
                      <input
                        key={i}
                        type="text"
                        className="qmoji-input"
                        value={kw}
                        placeholder={`Keyword ${i + 1}`}
                        onChange={(e) => handleKeywordChange(i, e.target.value)}
                        disabled={isSubmitting || timeLeft === 0}
                      />
                    ))}
                  </div>
                  <button type="submit" className="qmoji-btn qmoji-btn-green" disabled={isSubmitting || timeLeft === 0}>
                    {isSubmitting ? 'Saving...' : 'Enter word'}
                  </button>
                </form>
              ) : (
                <p style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.75rem', opacity: 0.8 }}>
                  Waiting for other players or timer expiration...
                </p>
              )}

              {(roomState.submitted_count === roomState.total_players || isHost) && (
                <button
                  type="button"
                  className="qmoji-btn"
                  onClick={fetchRoundResults}
                  disabled={isLoadingResults}
                  style={{ marginTop: 16, background: 'var(--qmoji-teal-deep)', color: 'var(--qmoji-ink)' }}
                >
                  {isLoadingResults ? 'Loading...' : 'See results'}
                </button>
              )}
            </div>
          )}

          {roomState.state === 'ended' && (
            <div className="qmoji-panel-yellow">
              <h3>Final Scores</h3>
              {sortedScoreboard.map((p, index) => (
                <div key={p.user_id} className={`qmoji-score-row ${index === 0 ? 'leader' : ''}`}>
                  <span>{index === 0 ? '👑 ' : ''}{p.name}{p.user_id === userId ? ' (you)' : ''}</span>
                  <span>{p.score}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="qmoji-btn qmoji-btn-red" onClick={handleLeave}>Leave</button>
                {isHost && (
                  <button className="qmoji-btn qmoji-btn-green" onClick={handleStartRound}>
                    Play again
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Always-visible scoreboard while a round is in progress */}
          {roomState.state === 'playing' && (
            <div style={{ marginTop: 20 }}>
              {sortedScoreboard.map((p, index) => (
                <div key={p.user_id} className={`qmoji-score-row ${index === 0 ? 'leader' : ''}`}>
                  <span>{index === 0 ? '👑 ' : ''}{p.name}{p.user_id === userId ? ' (you)' : ''}</span>
                  <span>{p.score}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="qmoji-footer">Powered by SILICON @ Stanford</p>
    </div>
  );
}