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

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const userId = localStorage.getItem('qmoji_user_id');
  const username = localStorage.getItem('qmoji_username');

  const [keywords, setKeywords] = useState(['', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollRef = useRef<number | null>(null);
  const lastRoundRef = useRef<number>(0);

  // Identify host dynamically (first player in room list)
  const isHost = Boolean(roomState?.players[0]?.user_id && roomState.players[0].user_id === userId);

  // Redirect to lobby if missing authentication or room parameters
  useEffect(() => {
    if (!roomId || !userId || !username) {
      navigate('/multiplayer');
    }
  }, [roomId, userId, username, navigate]);

  // Join room on mount
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

  // Fetch state periodically
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

      // Reset local inputs & timer when server advances to new round
      if (data.round > lastRoundRef.current) {
        lastRoundRef.current = data.round;
        setKeywords(['', '', '', '']);
        setTimeLeft(ROUND_SECONDS);
        setSubmitSuccess(false);
      }

      setRoomState(data);
    } catch (err: any) {
      setError(err.message || 'Error updating room state.');
    }
  }, [roomId]);

  // Polling Hook
  useEffect(() => {
    if (!hasJoined) return;
    fetchState();
    pollRef.current = window.setInterval(fetchState, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [hasJoined, fetchState]);

  // Advance to next round / emoji
  const handleStartRound = useCallback(async () => {
    if (!roomId) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/start_round`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to start next round.');
      await fetchState();
    } catch (err: any) {
      setError(err.message || 'Error starting the round.');
    } finally {
      setIsSubmitting(false);
    }
  }, [roomId, fetchState]);

  // Single Timer & Host auto-advance on expiration
  useEffect(() => {
    if (roomState?.state !== 'playing') return;

    if (timeLeft > 0) {
      const timer = window.setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => window.clearTimeout(timer);
    }

    if (timeLeft === 0 && isHost) {
      handleStartRound();
    }
  }, [roomState?.state, timeLeft, isHost, handleStartRound]);

  const handleKeywordChange = (index: number, value: string) => {
    setKeywords((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomId || !userId) return;

    const filledKeywords = keywords.filter((k) => k.trim() !== '');
    if (filledKeywords.length === 0) {
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
        body: JSON.stringify({ keywords: filledKeywords, user_id: userId }),
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
        <h1>Welcome to Qmoji! Multiplayer Mode</h1>
        <p>
          Describe the emoji with up to four keywords in 30 seconds! <br />
          <strong>Room ID:</strong> {roomId} | <strong>Round:</strong> {roomState?.round ?? 0}
        </p>
      </header>

      {error && (
        <p className="qmoji-error" role="alert">
          {error}
        </p>
      )}

      {submitSuccess && (
        <p
          className="qmoji-success"
          role="alert"
          style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}
        >
          Successfully saved your keywords!
        </p>
      )}

      {!roomState ? (
        <p style={{ textAlign: 'center' }}>Loading room state...</p>
      ) : (
        <>
          {/* Players Sidebar / List */}
          <section className="keyword-panel" style={{ marginBottom: '1.5rem' }}>
            <h2>Players ({roomState.total_players})</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0 0' }}>
              {roomState.players.map((p, index) => (
                <li key={p.user_id} style={{ padding: '4px 0' }}>
                  {p.name} {index === 0 ? '👑 (Host)' : ''} {p.user_id === userId ? '(you)' : ''} — Score: {roomState.scores[p.user_id] ?? 0}
                </li>
              ))}
            </ul>
          </section>

          {/* Lobby Waiting State */}
          {roomState.state === 'waiting' && (
            <section className="qmoji-stage" aria-live="polite" style={{ flexDirection: 'column', gap: '16px' }}>
              <p style={{ textAlign: 'center' }}>
                Waiting for players. Share room code <strong>{roomId}</strong> with friends.
              </p>
              {isHost ? (
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleStartRound}
                  disabled={isSubmitting}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {isSubmitting ? 'Starting...' : 'Start Game'}
                </button>
              ) : (
                <p style={{ fontStyle: 'italic' }}>Waiting for the host to start the game...</p>
              )}
            </section>
          )}

          {/* Active Gameplay Workspace */}
          {roomState.state === 'playing' && (
            <div className="workspace-container">
              {/* Left Column: Stage Display */}
              <section
                className="qmoji-stage"
                aria-live="polite"
                style={{ flexDirection: 'column', gap: '24px' }}
              >
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: timeLeft <= 5 ? '#b42318' : 'var(--text-h)',
                    textAlign: 'center',
                  }}
                >
                  {timeLeft > 0 ? `Time remaining: ${timeLeft}s` : "Time's up! Loading next..."}
                </div>

                <div className="emoji-display" aria-label="Random emoji">
                  <span className="emoji" role="img">
                    {roomState.emoji}
                  </span>
                </div>

                <p style={{ textAlign: 'center', margin: 0, fontWeight: 500 }}>
                  Submissions: {roomState.submitted_count} / {roomState.total_players} players
                </p>
              </section>

              {/* Right Column: Keyword Input Form */}
              <section className="keyword-panel" aria-labelledby="keyword-prompt">
                <h2
                  id="keyword-prompt"
                  style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}
                >
                  What words come to mind for{' '}
                  <span className="emoji-inline" aria-hidden="true" style={{ fontSize: '1.2em' }}>
                    {roomState.emoji}
                  </span>
                  ?
                </h2>

                <form className="keyword-form" onSubmit={handleSubmit}>
                  <div className="keyword-grid">
                    {keywords.map((keyword, index) => (
                      <label key={index} className="keyword-field">
                        Keyword {index + 1}
                        <input
                          type="text"
                          value={keyword}
                          placeholder={`Keyword ${index + 1}`}
                          onChange={(event) => handleKeywordChange(index, event.target.value)}
                          autoComplete="off"
                          disabled={isSubmitting || alreadySubmitted || timeLeft === 0}
                        />
                      </label>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                    {!alreadySubmitted && (
                      <button
                        type="submit"
                        className="submit-button"
                        disabled={isSubmitting || timeLeft === 0}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontWeight: 500,
                        }}
                      >
                        {isSubmitting ? 'Saving...' : 'Submit Keywords'}
                      </button>
                    )}

                    {/* Show "Try another emoji" button to Host or when all players submit */}
                    {(roomState.submitted_count === roomState.total_players || isHost) && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleStartRound}
                        disabled={isSubmitting}
                        style={{ flex: 1, margin: 0, width: alreadySubmitted ? '100%' : 'auto' }}
                      >
                        {isSubmitting ? 'Loading...' : 'Try another emoji'}
                      </button>
                    )}
                  </div>

                  {alreadySubmitted && (
                    <p style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '16px' }}>
                      Submitted! Waiting for other players or timer expiration...
                    </p>
                  )}
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}