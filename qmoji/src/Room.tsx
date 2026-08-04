import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');

type Player = { user_id: string; name: string };
type RoomState = { players: Player[]; scores: Record<string, number>; total_players: number };

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState('');

  const userId = localStorage.getItem('qmoji_user_id');
  const username = localStorage.getItem('qmoji_username');

  // Bounce back to the lobby if we don't have a valid session
  useEffect(() => {
    if (!roomId || !userId || !username) {
      navigate('/multiplayer');
    }
  }, [roomId, userId, username, navigate]);

  // Join once on mount
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

  // Only start polling AFTER join succeeds
  useEffect(() => {
    if (!roomId || !hasJoined) return;

    const fetchState = async () => {
      const res = await fetch(`${API_BASE_URL}/${roomId}/state`);
      if (res.ok) setRoomState(await res.json());
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [roomId, hasJoined]);

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!roomState) return <p>Loading...</p>;

  return (
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
  );
}

export default Room;