import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';


export const Multiplayerlobby: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');

  // State management
  const language = (location.state as { language?: string } | null)?.language || 'English';
  const [username, setUsername] = useState<string>('');
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Helper to store user session locally so Room.tsx can use it
  const saveUserSession = (roomId: string, name: string) => {
    // Generate or reuse a unique user ID for submissions
    let userId = localStorage.getItem('qmoji_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('qmoji_user_id', userId);
    }

    localStorage.setItem('qmoji_username', name);
    localStorage.setItem('qmoji_current_room', roomId);
  };

  // Handle Room Creation
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

      if (!response.ok) {
        throw new Error('Failed to create room.');
      }

      const data: { room_id: string; emoji: string } = await response.json();

      saveUserSession(data.room_id, username.trim());
      
      // Route player to Room component
      navigate(`/room/${data.room_id}`);
    } catch (err: any) {
      setError(err.message || 'Error connecting to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Joining an Existing Room
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
      // Validate that room exists on backend before routing
      const response = await fetch(`${API_BASE_URL}/${formattedRoomId}/state`);
      
      if (response.status === 404) {
        throw new Error('Room not found. Check your Room ID.');
      }
      
      if (!response.ok) {
        throw new Error('Error validating room state.');
      }

      saveUserSession(formattedRoomId, username.trim());

      // Route player to Room component
      navigate(`/room/${formattedRoomId}`);
    } catch (err: any) {
      setError(err.message || 'Error joining the room.');
    } finally {
      setIsLoading(false);
    }
  };
// below is more vibecoded
  return (
    <div className="lobby-container" style={{ maxWidth: '420px', margin: '3rem auto', padding: '1rem' }}>
      <h1>Qmoji Multiplayer</h1>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', border: '1px solid red' }}>
          {error}
        </div>
      )}

      {/* Profile Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Choose Username:
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. EmojiMaster99"
          disabled={isLoading}
          style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
        />
      </div>

      <hr style={{ margin: '1.5rem 0' }} />

      {/* Action 1: Create Room */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>Host a Game</h3>
        <button 
          onClick={handleCreateRoom} 
          disabled={isLoading}
          style={{ width: '100%', padding: '0.75rem', cursor: 'pointer' }}
        >
          {isLoading ? 'Creating...' : 'Create New Room'}
        </button>
      </section>

      {/* Action 2: Join Room */}
      <section>
        <h3>Join Existing Room</h3>
        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="Enter 4-letter Room Code"
            maxLength={4}
            disabled={isLoading}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
          />
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ width: '100%', padding: '0.75rem', cursor: 'pointer' }}
          >
            {isLoading ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Multiplayerlobby;