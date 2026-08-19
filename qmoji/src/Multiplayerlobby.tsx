import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const Multiplayerlobby: React.FC = () => {
  // navigate() lets us push the user to a new route programmatically (e.g. after creating a room)
  const navigate = useNavigate();
  // location gives us access to whatever state was passed in when routing to this page
  const location = useLocation();

  // Fall back to the deployed backend if no env var is set (e.g. local dev without a .env)
  // The trailing slash is stripped so we don't end up with double slashes when building URLs below
  const API_BASE_URL = (import.meta.env.VITE_API_URL ?? ' https://qmoji-webapp.onrender.com').replace(/\/$/, '');

  // Language gets passed in via route state from the previous screen (language select)
  // Defaults to English if the user landed here directly without going through that screen
  const language = (location.state as { language?: string } | null)?.language || 'English';

  // Player's chosen display name
  const [username, setUsername] = useState<string>('');
  // Room code typed into the "Join Room" input
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  // Holds any user-facing error message (empty string = no error shown)
  const [error, setError] = useState<string>('');
  // Tracks whether a create/join request is in flight, used to disable inputs and show loading text
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Persists the player's identity locally so refreshing the room page doesn't kick them out
  const saveUserSession = (roomId: string, name: string) => {
    // Check if this browser already has an anonymous id saved from a previous visit
    let userId = localStorage.getItem('qmoji_user_id');
    if (!userId) {
      // First time on this device - generate a stable anonymous id
      userId = crypto.randomUUID();
      localStorage.setItem('qmoji_user_id', userId);
    }
    // Save/update the username and which room they're currently in
    localStorage.setItem('qmoji_username', name);
    localStorage.setItem('qmoji_current_room', roomId);
  };

  // Called when the user clicks "Create"
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    // Don't let them create a room without a username
    if (!username.trim()) {
      setError('Please enter a username before creating a room.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // POST to the backend to spin up a new room
      const response = await fetch(`${API_BASE_URL}/create_room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // single_player_only is false here since this is the multiplayer lobby
        body: JSON.stringify({ language, single_player_only: false }),
      });
      if (!response.ok) throw new Error('Failed to create room.');
      // Backend returns the new room's id (and an emoji, unused here)
      const data: { room_id: string; emoji: string } = await response.json();
      saveUserSession(data.room_id, username.trim());
      // Send the user into the newly created room
      navigate(`/room/${data.room_id}`);
    } catch (err: any) {
      // Show whatever error message we got, or a generic fallback
      setError(err.message || 'Error connecting to the server.');
    } finally {
      // Always turn off the loading state, whether it succeeded or failed
      setIsLoading(false);
    }
  };

  // Called when the user submits the "Join Room" form
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    // Both fields are required to join
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!joinRoomId.trim()) {
      setError('Please enter a valid Room ID.');
      return;
    }
    // Room IDs are stored/served uppercase, so normalize before hitting the API
    const formattedRoomId = joinRoomId.trim().toUpperCase();
    setIsLoading(true);
    setError('');
    try {
      // Hitting /state first just to confirm the room exists before navigating there
      const response = await fetch(`${API_BASE_URL}/${formattedRoomId}/state`);
      if (response.status === 404) throw new Error('Room not found. Check your Room ID.');
      if (!response.ok) throw new Error('Error validating room state.');
      saveUserSession(formattedRoomId, username.trim());
      // Room exists, safe to navigate into it
      navigate(`/room/${formattedRoomId}`);
    } catch (err: any) {
      setError(err.message || 'Error joining the room.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="qmoji-card">
      {/* Back button - just navigates to the previous page in history */}
      <div className="qmoji-header-row">
        <button className="qmoji-icon-btn" onClick={() => navigate(-1)} aria-label="Back">↩</button>
      </div>

      <h1 className="qmoji-title">Mindreader</h1>
      <p className="qmoji-subtitle">Describe the emoji with up to four keywords in 30 seconds!</p>

      {/* Error banner - only renders when there's an error message to show */}
      {error && (
        <div style={{ color: '#ffb4a8', background: 'rgba(192,57,43,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: '14px', fontSize: '0.75rem' }}>
          {error}
        </div>
      )}

      {/* Username input, shared by both create and join flows */}
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

      {/* Two-column layout: create a new room on the left, join an existing one on the right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
        {/* Create Room panel */}
        <div className="qmoji-panel-yellow">
          <h3>Create Room</h3>
          <button className="qmoji-btn qmoji-btn-green" onClick={handleCreateRoom} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>

        {/* Join Room panel */}
        <div className="qmoji-panel-yellow">
          <h3>Join Room</h3>
          <form onSubmit={handleJoinRoom}>
            {/* Room code input, auto-uppercased and capped at 4 characters */}
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