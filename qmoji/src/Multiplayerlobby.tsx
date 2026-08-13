import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const Multiplayerlobby: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');

  const language = (location.state as { language?: string } | null)?.language || 'English';
  const [username, setUsername] = useState<string>('');
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const saveUserSession = (roomId: string, name: string) => {
    let userId = localStorage.getItem('qmoji_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('qmoji_user_id', userId);
    }
    localStorage.setItem('qmoji_username', name);
    localStorage.setItem('qmoji_current_room', roomId);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username before creating a room.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/create_room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, single_player_only: false }),
      });
      if (!response.ok) throw new Error('Failed to create room.');
      const data: { room_id: string; emoji: string } = await response.json();
      saveUserSession(data.room_id, username.trim());
      navigate(`/room/${data.room_id}`);
    } catch (err: any) {
      setError(err.message || 'Error connecting to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!joinRoomId.trim()) {
      setError('Please enter a valid Room ID.');
      return;
    }
    const formattedRoomId = joinRoomId.trim().toUpperCase();
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/${formattedRoomId}/state`);
      if (response.status === 404) throw new Error('Room not found. Check your Room ID.');
      if (!response.ok) throw new Error('Error validating room state.');
      saveUserSession(formattedRoomId, username.trim());
      navigate(`/room/${formattedRoomId}`);
    } catch (err: any) {
      setError(err.message || 'Error joining the room.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="qmoji-card">
      <div className="qmoji-header-row">
        <button className="qmoji-icon-btn" onClick={() => navigate(-1)} aria-label="Back">↩</button>
      </div>
      <h1 className="qmoji-title">QMoji</h1>
      <p className="qmoji-subtitle">Describe the emoji with up to four keywords in 30 seconds!</p>

      {error && (
        <div style={{ color: '#ffb4a8', background: 'rgba(192,57,43,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: '14px', fontSize: '0.75rem' }}>
          {error}
        </div>
      )}

      <div className="qmoji-field">
        <label>Choose username</label>
        <input
          type="text"
          className="qmoji-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. EmojiMaster99"
          disabled={isLoading}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
        <div className="qmoji-panel-yellow">
          <h3>Create Room</h3>
          <button className="qmoji-btn qmoji-btn-green" onClick={handleCreateRoom} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>

        <div className="qmoji-panel-yellow">
          <h3>Join Room</h3>
          <form onSubmit={handleJoinRoom}>
            <input
              type="text"
              className="qmoji-input"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
              placeholder="XXXX"
              maxLength={4}
              disabled={isLoading}
              style={{ marginBottom: 10, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '0.75rem' }}
            />
            <button type="submit" className="qmoji-btn qmoji-btn-green" disabled={isLoading}>
              {isLoading ? 'Joining...' : 'Join'}
            </button>
          </form>
        </div>
      </div>

      <p className="qmoji-footer">Powered by SILICON @ Stanford</p>
    </div>
  );
};

export default Multiplayerlobby;