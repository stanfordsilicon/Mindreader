import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SingleplayerGame from './SingleplayerGame';
import Multiplayerlobby from './Multiplayerlobby';
import Room from './Room';
import { initArcade, backToHomescreenUrl } from './arcade';
import './App.css';

const BACKEND_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

// QMoji Arcade: party continuity from the homescreen. Enhancement only —
// if there's no ?room= or the lookup fails, this never fires and every
// route behaves exactly as it does standalone.
function useArcadeAutoJoin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [backParams, setBackParams] = useState<{ roomCode?: string; lang?: string; playerId?: string | null }>({});

  useEffect(() => {
    let cancelled = false;

    initArcade().then(async (arcade) => {
      if (cancelled || !arcade) return;
      setBackParams({ roomCode: arcade.roomCode, lang: arcade.lang, playerId: arcade.playerId });

      // Only auto-route a fresh landing on "/" — don't hijack someone
      // already mid-flow on /multiplayer or /room/:id.
      if (location.pathname !== '/') return;

      const me = arcade.room.players.find((p) => p.playerId === arcade.playerId);
      if (!me) return; // raw game link, not routed through the homescreen — leave the normal Start screen up

      const code = arcade.roomCode;
      let userId = localStorage.getItem('qmoji_user_id');
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('qmoji_user_id', userId);
      }

      const doJoin = () =>
        fetch(`${BACKEND_URL}/${code}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: me.name, user_id: userId }),
        });

      try {
        let joinRes = await doJoin();
        if (joinRes.status === 404) {
          // First arcade player to reach this game — seed a room under the
          // party's own code instead of a random one (one code, sourced
          // from the URL, not a second parallel room-code system).
          const createRes = await fetch(`${BACKEND_URL}/create_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: arcade.lang || 'en', single_player_only: false, room_id: code }),
          });
          if (!createRes.ok) return; // arcade layer is an enhancement — leave the standalone Start screen up
          joinRes = await doJoin();
        }
        if (!joinRes.ok) return;

        localStorage.setItem('qmoji_username', me.name);
        localStorage.setItem('qmoji_current_room', code);
        navigate(`/room/${code}`);
      } catch {
        // Backend unreachable — arcade layer is an enhancement, not a
        // dependency. Leave the standalone Start screen up.
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return backParams;
}

// Mirrors qmoji/app.js's own launchGame() transition (fade in "LOADING…"
// with a bar-fill, then navigate after a beat) so leaving a game feels
// like the same continuous arcade as entering one, instead of an instant
// jump cut -- see App.css's .arcade-loading-screen for the shared styling.
function useLaunchpadTransition() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [fillWidth, setFillWidth] = useState('0%');

  const navigateToLaunchpad = (href: string) => {
    setIsLeaving(true);
    requestAnimationFrame(() => setFillWidth('100%'));
    setTimeout(() => {
      window.location.href = href;
    }, 650);
  };

  const overlay = (
    <div className={`arcade-loading-screen${isLeaving ? ' is-visible' : ''}`} aria-hidden={!isLeaving}>
      <p className="arcade-loading-text">
        LOADING<span className="arcade-loading-dots">...</span>
      </p>
      <div className="arcade-loading-bar">
        <div className="arcade-loading-bar-fill" style={{ width: fillWidth }} />
      </div>
    </div>
  );

  return { navigateToLaunchpad, overlay };
}

export default function App() {
  const arcadeBackParams = useArcadeAutoJoin();
  const { navigateToLaunchpad, overlay } = useLaunchpadTransition();

  return (
    <>
      {overlay}
      <button
        type="button"
        className="back-to-launchpad"
        title="Return to launch pad"
        onClick={() => {
          navigateToLaunchpad(
            backToHomescreenUrl(arcadeBackParams.roomCode, arcadeBackParams.lang, arcadeBackParams.playerId)
          );
        }}
      >
        ← RETURN TO LAUNCH PAD
      </button>
      <Routes>
        <Route path="/" element={<SingleplayerGame />} />
        <Route path="/multiplayer" element={<Multiplayerlobby />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </>
  );
}
