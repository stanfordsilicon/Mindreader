import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');

type Player = { user_id: string; name: string };
type RoomState = { players: Player[]; scores: Record<string, number>; total_players: number };

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const userId = localStorage.getItem('qmoji_user_id');

  useEffect(() => {
    if (!roomId) return;
    const fetchState = async () => {
      const res = await fetch(`${API_BASE_URL}/${roomId}/state`);
      if (res.ok) setRoomState(await res.json());
    };
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [roomId]);

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