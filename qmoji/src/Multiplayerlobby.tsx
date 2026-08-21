import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  readParams,
  initArcade,
  getSavedPlayerName,
  backToHomescreenUrl,
  type ArcadeRoom,
} from './arcade'; // adjust path if your arcade client lives elsewhere

export const Multiplayerlobby: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const API_BASE_URL = (
    import.meta.env.VITE_API_URL ?? 'https://qmoji-webapp.onrender.com'
  ).replace(/\/$/, '');

  const language = (location.state as { language?: string } | null)?.language || 'English';

  const [username, setUsername] = useState<string>('');
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ---- Arcade transfer state ----
  const [arcadeMode, setArcadeMode] = useState(false);
  const [arcadeRoom, setArcadeRoom] = useState<ArcadeRoom | null>(null);
  const [arcadeLang, setArcadeLang] = useState('en');
  const [arcadePlayerId, setArcadePlayerId] = useState<string | null>(null);
  const [checkingArcade, setCheckingArcade] = useState(true);

  // On mount: detect arcade launch params
  useEffect(() => {
    const params = readParams();
    if (!params.room) {
      setCheckingArcade(false);
      return;
    }

    initArcade()
      .then((init) => {
        if (init) {
          setArcadeMode(true);
          setArcadeRoom(init.room);
          setArcadeLang(init.lang);
          setArcadePlayerId(init.playerId);

          // Pre-fill username from arcade roster or previous local save
          const me = init.room.players.find((p) => p.playerId === init.playerId);
          const savedName = getSavedPlayerName();
          setUsername(me?.name || savedName || '');

          // Sync arcade identity into Mindreader's localStorage keys
          if (init.playerId) {
            localStorage.setItem('qmoji_user_id', init.playerId);
          }
        }
      })
      .catch(() => {
        // Silent fail — fallback to standalone lobby
      })
      .finally(() => setCheckingArcade(false));
  }, []);

  const saveUserSession = (roomId: string, name: string) => {
    let userId = localStorage.getItem('qmoji_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('qmoji_user_id', userId);
    }
    localStorage.setItem('qmoji_username', name);
    localStorage.setItem('qmoji_current_room', roomId);
  };

  // ---- Arcade: enter the room ----
  const handleArcadeEnter = async () => {
    if (!arcadeRoom || !username.trim()) {
      setError('Please enter a name.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      // Seed the Mindreader backend with the arcade room code (idempotent)
      const res = await fetch(`${API_BASE_URL}/create_room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: arcadeLang,
          room_id: arcadeRoom.code,
          single_player_only: false,
        }),
      });
      if (!res.ok) throw new Error('Failed to prepare room.');

      saveUserSession(arcadeRoom.code, username.trim());
      navigate(`/room/${arcadeRoom.code}`);
    } catch (err: any) {
      setError(err.message || 'Error entering room.');
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Standalone handlers (unchanged) ----
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

  // ---- Render: loading state ----
  if (checkingArcade) {
    return (
      <div className="qmoji-card">
        <p style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: 40 }}>Loading…</p>
      </div>
    );
  }

  // ============================================================
  // ARCADE TRANSFER SCREEN
  // ============================================================
  if (arcadeMode && arcadeRoom) {
    return (
      <div className="qmoji-card">
        <div className="qmoji-header-row">
          <button
            className="qmoji-icon-btn"
            onClick={() => {
              window.location.href = backToHomescreenUrl(
                arcadeRoom.code,
                arcadeLang,
                arcadePlayerId
              );
            }}
            aria-label="Back to Arcade"
          >
            ↩
          </button>
        </div>

        <h1 className="qmoji-title">Mindreader</h1>
        <p className="qmoji-subtitle">Arcade Room Connected</p>

        {error && (
          <div
            style={{
              color: '#ffb4a8',
              background: 'rgba(192,57,43,0.25)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: '14px',
              fontSize: '0.75rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Room info panel */}
        <div
          className="qmoji-panel-yellow"
          style={{ textAlign: 'center', marginBottom: 18 }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              opacity: 0.7,
              marginBottom: 6,
              letterSpacing: 1,
            }}
          >
            ROOM CODE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              letterSpacing: 4,
              marginBottom: 14,
              color: 'var(--qmoji-ink)',
            }}
          >
            {arcadeRoom.code}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 20,
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <span>
              <span style={{ opacity: 0.6 }}>Language: </span>
              {arcadeLang.toUpperCase()}
            </span>
            <span>
              <span style={{ opacity: 0.6 }}>Players: </span>
              {arcadeRoom.players.length}
            </span>
          </div>
        </div>

        {/* Player roster preview */}
        <div style={{ marginBottom: 16 }}>
          <div className="qmoji-pill-row" style={{ justifyContent: 'center' }}>
            {arcadeRoom.players.map((p) => (
              <span key={p.playerId} className="qmoji-pill">
                {p.name}
              </span>
            ))}
          </div>
        </div>

        <div className="qmoji-field">
          <label>Your Name</label>
          <input
            type="text"
            className="qmoji-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            disabled={isLoading}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            className="qmoji-btn qmoji-btn-red"
            onClick={() => {
              window.location.href = backToHomescreenUrl(
                arcadeRoom.code,
                arcadeLang,
                arcadePlayerId
              );
            }}
          >
            Back to Arcade
          </button>
          <button
            className="qmoji-btn qmoji-btn-green"
            onClick={handleArcadeEnter}
            disabled={isLoading}
          >
            {isLoading ? 'Entering…' : 'Enter Game'}
          </button>
        </div>

        <p className="qmoji-footer">Powered by SILICON @ Stanford</p>
      </div>
    );
  }

  // ============================================================
  // STANDALONE LOBBY (original — runs when NOT from arcade)
  // ============================================================
  return (
    <div className="qmoji-card">
      <div className="qmoji-header-row">
        <button
          className="qmoji-icon-btn"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          ↩
        </button>
      </div>

      <h1 className="qmoji-title">Mindreader</h1>
      <p className="qmoji-subtitle">
        Describe the emoji with up to four keywords in 30 seconds!
      </p>

      {error && (
        <div
          style={{
            color: '#ffb4a8',
            background: 'rgba(192,57,43,0.25)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: '14px',
            fontSize: '0.75rem',
          }}
        >
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 18,
        }}
      >
        <div className="qmoji-panel-yellow">
          <h3>Create Room</h3>
          <button
            className="qmoji-btn qmoji-btn-green"
            onClick={handleCreateRoom}
            disabled={isLoading}
          >
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
              style={{
                marginBottom: 10,
                textAlign: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
              }}
            />
            <button
              type="submit"
              className="qmoji-btn qmoji-btn-green"
              disabled={isLoading}
            >
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