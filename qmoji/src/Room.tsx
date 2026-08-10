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
  results: Record<string, Record<string, number>>; // user_id -> { word: count }
  round_scores: Record<string, number>; // user_id -> points earned this round
  total_scores: Record<string, number>; // user_id -> running total
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

  // Derive host status dynamically (first player in list)
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

  // Single Timer & Auto-advance hook
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

  const alreadySubmitted = roomState?.submitted_user_ids.includes(userId ?? '') ?? false;

  return (
    <main className="qmoji-app">
      <header className="qmoji-header">
        <h1>=QMoji</h1>
        <p>
          Describe the emoji with up to four keywords in 30 seconds!
          Room ID: {roomId} | Round: {roomState?.round ?? 0}
        </p>
      </header>

      {error && (
        <p className="qmoji-error" role="alert">
          {error}
        </p>
      )}

      {submitSuccess && !showResults && (
        <p className="qmoji-success" role="alert" style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}>
          Successfully saved your keywords!
        </p>
      )}

      {showResults && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Round results"
          onClick={() => setShowResults(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setShowResults(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                border: 'none',
                background: 'transparent',
                fontSize: '1.25rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px',
              }}
            >
              ✕
            </button>

            <h3 style={{ textAlign: 'center', marginTop: 0, marginBottom: '4px' }}>
              How everyone answered {roundResults?.emoji ?? roomState?.emoji}
            </h3>

            {isLoadingResults ? (
              <p style={{ textAlign: 'center' }}>Loading results...</p>
            ) : roundResults ? (
              <>
                {userId && (
                  <p
                    style={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      color: '#2e7d32',
                      margin: '8px 0 16px',
                    }}
                  >
                    +{roundResults.round_scores?.[userId] ?? 0} points
                    {roundResults.total_scores?.[userId] !== undefined && (
                      <span style={{ fontWeight: 500, color: '#555', display: 'block', fontSize: '0.85rem' }}>
                        total: {roundResults.total_scores[userId]}
                      </span>
                    )}
                  </p>
                )}

                {Object.entries(roundResults.results).map(([id, words]) => {
                  // Only show words that scored above 0 -- a 0 means nobody
                  // else guessed it, so there's nothing meaningful to display.
                  const sortedWords = Object.entries(words)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a);

                  if (sortedWords.length === 0) {
                    return (
                      <div key={id} style={{ marginBottom: '20px' }}>
                        <strong>{getPlayerName(id)}</strong>
                        <p style={{ color: '#888', margin: '8px 0 0', fontStyle: 'italic' }}>
                          0 points
                        </p>
                      </div>
                    );
                  }

                  const maxCount = Math.max(...sortedWords.map(([, c]) => c), 1);

                  return (
                    <div key={id} style={{ marginBottom: '20px' }}>
                      <strong>{getPlayerName(id)}</strong>
                      <ul style={{ listStyle: 'none', padding: 0, marginTop: '8px' }}>
                        {sortedWords.map(([word, count], index) => (
                          <li
                            key={word}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '6px',
                            }}
                          >
                            <div
                              style={{
                                position: 'relative',
                                background: '#eee',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                height: '28px',
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: `${(count / maxCount) * 100}%`,
                                  background: '#4CAF50',
                                  transition: 'width 0.4s ease',
                                  transitionDelay: `${index * 80}ms`,
                                }}
                              />
                              <span
                                style={{
                                  position: 'relative',
                                  padding: '0 10px',
                                  lineHeight: '28px',
                                  fontWeight: 500,
                                }}
                              >
                                {word}
                              </span>
                            </div>
                            <span
                              style={{
                                fontWeight: 'bold',
                                minWidth: '24px',
                                textAlign: 'right',
                              }}
                            >
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </>
            ) : (
              <p style={{ textAlign: 'center' }}>No results yet.</p>
            )}

            {isHost && (
              <button
                type="button"
                onClick={handleStartRound}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontWeight: 500,
                  marginTop: '8px',
                }}
              >
                {isSubmitting ? 'Loading...' : 'Next round'}
              </button>
            )}
          </div>
        </div>
      )}

      {!roomState ? (
        <p>Loading room...</p>
      ) : (
        <>
          <section style={{ marginBottom: '1.5rem' }}>
            <h3>Players ({roomState.total_players})</h3>
            <ul>
              {roomState.players.map((p, index) => (
                <li key={p.user_id}>
                  {p.name} {index === 0 ? '👑 (Host)' : ''} {p.user_id === userId ? '(you)' : ''} — score: {roomState.scores[p.user_id] ?? 0}
                </li>
              ))}
            </ul>
          </section>

          {roomState.state === 'waiting' && (
            <section>
              <p>Waiting for players. Share room code <strong>{roomId}</strong> with friends.</p>
              {isHost ? (
                <button onClick={handleStartRound} style={{ padding: '0.75rem 1.5rem' }}>
                  Start Game
                </button>
              ) : (
                <p>Waiting for the host to start...</p>
              )}
            </section>
          )}

          {roomState.state === 'playing' && (
            <section>
              <div style={{ fontWeight: 'bold', marginBottom: '1rem', color: timeLeft <= 5 ? '#b42318' : 'inherit' }}>
                {timeLeft > 0 ? `Time remaining: ${timeLeft}s` : "Time's up!"}
              </div>
              <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>
                {roomState.emoji}
              </div>

              <p style={{ textAlign: 'center' }}>
                {roomState.submitted_count} / {roomState.total_players} players have submitted
              </p>

              {!alreadySubmitted ? (
                <form onSubmit={handleSubmit}>
                  onKeydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  {keywords.map((kw, i) => (
                    <input
                      key={i}
                      type="text"
                      value={kw}
                      placeholder={`Keyword ${i + 1}`}
                      onChange={(e) => handleKeywordChange(i, e.target.value)}
                      disabled={isSubmitting || timeLeft === 0}
                      style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                    />
                  ))}
                  <button type="submit" disabled={isSubmitting || timeLeft === 0} style={{ padding: '0.75rem 1.5rem', width: '100%' }}>
                    {isSubmitting ? 'Saving...' : 'Submit Keywords'}
                  </button>
                </form>
              ) : (
                <p style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '1rem' }}>
                  Waiting for other players or timer expiration...
                </p>
              )}

              {(roomState.submitted_count === roomState.total_players || isHost) && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={fetchRoundResults}
                    disabled={isLoadingResults}
                    style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', marginRight: isHost ? '0.5rem' : 0 }}
                  >
                    {isLoadingResults ? 'Loading...' : 'See results'}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}