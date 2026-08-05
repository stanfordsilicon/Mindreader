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

  // Fetch current state
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

      // Reset local round state when server advances to new round
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

  // Poll state periodically
  useEffect(() => {
    if (!hasJoined) return;
    fetchState();
    pollRef.current = window.setInterval(fetchState, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [hasJoined, fetchState]);

  // Timer countdown
  useEffect(() => {
    if (roomState?.state !== 'playing' || timeLeft <= 0) return;
    const t = window.setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => window.clearTimeout(t);
  }, [roomState?.state, timeLeft]);

  const handleStartRound = async () => {
    if (!roomId) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/start_round`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to start round.');
      await fetchState();
    } catch (err: any) {
      setError(err.message || 'Error starting the round.');
    }
  };

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
        <h1>Welcome to Qmoji! Multiplayer Mode</h1>
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
        <p>Loading room...</p>
      ) : (
        <>
          <section style={{ marginBottom: '1.5rem' }}>
            <h3>Players ({roomState.total_players})</h3>
            <ul>
              {roomState.players.map((p) => (
                <li key={p.user_id}>
                  {p.name}
                  {p.user_id === userId ? ' (you)' : ''} — score: {roomState.scores[p.user_id] ?? 0}
                </li>
              ))}
            </ul>
          </section>

          {roomState.state === 'waiting' && (
            <section>
              <p>Waiting for players. Share room code <strong>{roomId}</strong> with friends.</p>
              <button onClick={handleStartRound} style={{ padding: '0.75rem 1.5rem' }}>
                Start Round
              </button>
            </section>
          )}

          {roomState.state === 'playing' && (
            <section>
              <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                {timeLeft > 0 ? `Time remaining: ${timeLeft}s` : "Time's up!"}
              </div>
              <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>
                {roomState.emoji}
              </div>

              <p>
                {roomState.submitted_count} / {roomState.total_players} players have submitted
              </p>

              {!alreadySubmitted ? (
                <form onSubmit={handleSubmit}>
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
                  <button type="submit" disabled={isSubmitting || timeLeft === 0} style={{ padding: '0.75rem 1.5rem' }}>
                    {isSubmitting ? 'Saving...' : 'Submit Keywords'}
                  </button>
                </form>
              ) : (
                <p>Waiting for other players to submit...</p>
              )}

              {roomState.submitted_count === roomState.total_players && (
                <button onClick={handleStartRound} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem' }}>
                  Next Round
                </button>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}