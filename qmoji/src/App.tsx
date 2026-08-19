import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SingleplayerGame from './SingleplayerGame';
import Multiplayerlobby from './Multiplayerlobby';
import Room from './Room';
import { initArcade, backToHomescreenUrl } from './arcade';
import './App.css';

// Where the game's backend lives - falls back to localhost for local dev
const BACKEND_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

// QMoji Arcade: party continuity from the homescreen. Enhancement only —
// if there's no ?room= or the lookup fails, this never fires and every
// route behaves exactly as it does standalone.
function useArcadeAutoJoin() {
  const navigate = useNavigate();
  const location = useLocation();
  // Params needed to build the "return to launchpad" link later, filled in once arcade init resolves
  const [backParams, setBackParams] = useState<{ roomCode?: string; lang?: string; playerId?: string | null }>({});

  useEffect(() => {
    // Guards against setting state after the component has unmounted (e.g. fast navigation away)
    let cancelled = false;

    initArcade().then(async (arcade) => {
      // Bail out if we unmounted mid-request, or if there's no arcade context at all
      if (cancelled || !arcade) return;
      setBackParams({ roomCode: arcade.roomCode, lang: arcade.lang, playerId: arcade.playerId });

      // Only auto-route a fresh landing on "/" — don't hijack someone
      // already mid-flow on /lmultiplayer or /room/:id.
      if (location.pathname !== '/') return;

      // Confirm this player is actually part of the arcade room (not just a random visitor)
      const me = arcade.room.players.find((p) => p.playerId === arcade.playerId);
      if (!me) return; // raw game link, not routed through the homescreen — leave the normal Start screen up

      const code = arcade.roomCode;

      // Reuse this device's saved id, or create one if this is the first visit
      let userId = localStorage.getItem('qmoji_user_id');
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('qmoji_user_id', userId);
      }

      // Attempts to join the room under this arcade's room code
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
          // Room now exists, retry the join
          joinRes = await doJoin();
        }
        // Give up quietly if the join still failed after the retry
        if (!joinRes.ok) return;

        // Success - save session locally and drop the player straight into the room
        localStorage.setItem('qmoji_username', me.name);
        localStorage.setItem('qmoji_current_room', code);
        navigate(`/room/${code}`);
      } catch {
        // Backend unreachable — arcade layer is an enhancement, not a
        // dependency. Leave the standalone Start screen up.
      }
    });

    // Cleanup function - runs when the component unmounts
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
  // Whether the loading overlay should currently be shown
  const [isLeaving, setIsLeaving] = useState(false);
  // Current width of the progress bar fill, animated from 0% to 100%
  const [fillWidth, setFillWidth] = useState('0%');

  // Kicks off the fade-out/loading-bar animation, then hard-navigates once it's done
  const navigateToLaunchpad = (href: string) => {
    setIsLeaving(true);
    // Wait a frame before animating the fill so the transition actually renders instead of jumping instantly
    requestAnimationFrame(() => setFillWidth('100%'));
    // Give the bar-fill animation time to play before leaving the page
    setTimeout(() => {
      window.location.href = href;
    }, 650);
  };

  // The loading overlay itself - only visible while isLeaving is true
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
  // Handles silently joining an arcade room on load, if applicable
  const arcadeBackParams = useArcadeAutoJoin();
  // Handles the loading-screen transition when leaving back to the launchpad
  const { navigateToLaunchpad, overlay } = useLaunchpadTransition();

  return (
    <>
      {/* Loading overlay, only visible mid-transition */}
      {overlay}

      {/* Persistent button to exit back to the arcade launchpad, present on every route */}
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

      {/* Main app routes: single-player start screen, multiplayer lobby, and the room itself */}
      <Routes>
        <Route path="/" element={<SingleplayerGame />} />
        <Route path="/multiplayer" element={<Multiplayerlobby />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </>
  );
}