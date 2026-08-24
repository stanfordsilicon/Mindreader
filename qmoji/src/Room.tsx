import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  'https://exquisite-courage-production.up.railway.app/'
).replace(/\/$/, '');

const POLL_INTERVAL_MS = 2000;
const ROUND_SECONDS = 20;
const COUNTDOWN_START = 3;
const AUTO_START_DELAY_MS = 24000; // 24 seconds

type Player = {
  user_id: string;
  name: string;
};

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

type RoundResults = {
  round: number;
  emoji: string;
  results: Record<string, Record<string, number>>;
  round_scores: Record<string, number>;
  total_scores: Record<string, number>;
};

/** Defensive deduplication — keeps the first occurrence of each user_id. */
function dedupePlayers(players: Player[]): Player[] {
  return [...new Map(players.map((p) => [p.user_id, p])).values()];
}

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // ---- Room state ----

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const userId = localStorage.getItem('qmoji_user_id');
  const username = localStorage.getItem('qmoji_username');

  // ---- Playing state ----

  const [keywords, setKeywords] = useState(['', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Frontend adds countdown/results phases to the backend room states.
  const [phase, setPhase] = useState<
    'waiting' | 'countdown' | 'playing' | 'results'
  >('waiting');

  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [revealedPlayerId, setRevealedPlayerId] = useState<string | null>(null);

  // ---- Result reveal state ----

  const [revealedCount, setRevealedCount] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);

  // Snapshot players so polling doesn't restart the reveal sequence.
  const [revealPlayers, setRevealPlayers] = useState<Player[]>([]);

  // ---- Next-round countdown state ----
  const [nextRoundCountdown, setNextRoundCountdown] = useState(
    Math.ceil(AUTO_START_DELAY_MS / 1000),
  );

  // Refs hold timers without causing re-renders.
  const revealTimerRef = useRef<number | null>(null);
  const playerAdvanceTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastRoundRef = useRef<number>(0);
  const autoStartTimerRef = useRef<number | null>(null);
  const hasJoinedRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const keywordsRef = useRef(keywords);

  // Keep keywordsRef in sync so the timer effect can read latest keywords
  // without adding 'keywords' to the effect dependency array.
  useEffect(() => {
    keywordsRef.current = keywords;
  }, [keywords]);

  // ---- Derived, deduplicated state (defensive) ----
  const players = roomState ? dedupePlayers(roomState.players) : [];
  const submittedUserIds = roomState
    ? [...new Set(roomState.submitted_user_ids)]
    : [];
  const totalPlayers = players.length;

  // The first player in the list is treated as the host.
  const isHost = Boolean(
    players[0]?.user_id && players[0].user_id === userId,
  );

  const getPlayerName = useCallback(
    (id: string) => {
      if (id === userId) return 'You';
      const match = players.find((p) => p.user_id === id);
      return match?.name ?? `Player ${id.slice(0, 6)}`;
    },
    [players, userId],
  );

  // ---- Navigation & joining ----

  useEffect(() => {
    if (!roomId || !userId || !username) {
      navigate('/multiplayer');
    }
  }, [roomId, userId, username, navigate]);

  useEffect(() => {
    if (!roomId || !userId || !username || hasJoined || hasJoinedRef.current) return;

    hasJoinedRef.current = true; // lock

    const join = async () => {
      try {
        // Belt-and-suspenders check: if this user_id is already in the
        // room's roster, don't call /join again.
        try {
          const stateRes = await fetch(`${API_BASE_URL}/${roomId}/state`);
          if (stateRes.ok) {
            const state: RoomState = await stateRes.json();
            if (state.players.some((p) => p.user_id === userId)) {
              setRoomState(state);
              setHasJoined(true);
              return;
            }
          }
        } catch {
          // fall through to normal join
        }

        const res = await fetch(`${API_BASE_URL}/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            user_id: userId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to join room.');
        }

        setHasJoined(true);
      } catch (err: any) {
        setError(err.message || 'Error joining the room.');
        hasJoinedRef.current = false; // unlock on error so they can retry
      }
    };

    join();
  }, [roomId, userId, username, hasJoined]);

  // ---- Polling / room state ----

  const fetchState = useCallback(async () => {
    if (!roomId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/${roomId}/state`);

      if (res.status === 404) {
        setError('Room no longer exists.');
        return;
      }

      if (!res.ok) {
        throw new Error('Error fetching room state.');
      }

      const data: RoomState = await res.json();

      // Detect a new round and reset round-specific UI.
      if (data.round > lastRoundRef.current) {
        lastRoundRef.current = data.round;

        setKeywords(['', '', '', '']);
        setSubmitSuccess(false);
        setShowResults(false);
        setRoundResults(null);
        autoSubmittedRef.current = false; // reset for new round

        if (data.state === 'playing') {
          setPhase('countdown');
          setCountdownValue(COUNTDOWN_START);
        } else {
          setPhase('waiting');
        }
      }

      setRoomState(data);
    } catch (err: any) {
      setError(err.message || 'Error updating room state.');
    }
  }, [roomId]);

  // Poll the backend every 2 seconds while the player is in the room.
  useEffect(() => {
    if (!hasJoined) return;

    fetchState();

    pollRef.current = window.setInterval(
      fetchState,
      POLL_INTERVAL_MS,
    );

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [hasJoined, fetchState]);

  // ---- Countdown timer ----

  // Count down 3 → 2 → 1 before starting the round.
  useEffect(() => {
    if (
      phase !== 'countdown' ||
      countdownValue === null
    ) {
      return;
    }

    if (countdownValue > 0) {
      const timer = setTimeout(() => {
        setCountdownValue((prev) =>
          prev !== null ? prev - 1 : null,
        );
      }, 1000);

      return () => clearTimeout(timer);
    }

    setPhase('playing');
    setTimeLeft(ROUND_SECONDS);
  }, [phase, countdownValue]);

  // ---- Fetch results (declared BEFORE the timer effect that uses it) ----

  const fetchRoundResults = useCallback(async () => {
    if (!roomId) return;

    setIsLoadingResults(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/${roomId}/round_results`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!res.ok) {
        throw new Error('Could not load round results.');
      }

      const data: RoundResults = await res.json();

      setRoundResults(data);
      setShowResults(true);
      setPhase('results');
    } catch (err: any) {
      setError(err.message || 'Failed to load round results.');
    } finally {
      setIsLoadingResults(false);
    }
  }, [roomId]);

  // ---- Round timer ----

  // Count down the round and fetch results when time expires.
  // Auto-submit any filled keywords if the user hasn't submitted manually.
  useEffect(() => {
    if (phase !== 'playing') return;

    if (timeLeft > 0) {
      const timer = setTimeout(
        () => setTimeLeft((prev) => prev - 1),
        1000,
      );

      return () => clearTimeout(timer);
    }

    // Time expired
    const alreadySubmitted =
      roomState?.submitted_user_ids.includes(userId ?? '') ?? false;

    if (
      !alreadySubmitted &&
      !autoSubmittedRef.current &&
      roomId &&
      userId
    ) {
      autoSubmittedRef.current = true;
      const filled = keywordsRef.current.filter(
        (k) => k.trim() !== '',
      );

      if (filled.length > 0) {
        fetch(`${API_BASE_URL}/${roomId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: filled,
            user_id: userId,
          }),
        })
          .then(() => {
            if (
              !roundResults ||
              roundResults.round !== roomState?.round
            ) {
              fetchRoundResults();
            }
          })
          .catch(() => {
            if (
              !roundResults ||
              roundResults.round !== roomState?.round
            ) {
              fetchRoundResults();
            }
          });
        return;
      }
    }

    if (
      !roundResults ||
      roundResults.round !== roomState?.round
    ) {
      fetchRoundResults();
    }
  }, [
    phase,
    timeLeft,
    roomState?.round,
    roundResults,
    fetchRoundResults,
    roomId,
    userId,
  ]);

  // Fetch results early if everyone has already submitted.
  useEffect(() => {
    if (
      phase === 'playing' &&
      roomState &&
      roomState.submitted_count === totalPlayers &&
      totalPlayers > 0 &&
      (!roundResults ||
        roundResults.round !== roomState.round)
    ) {
      fetchRoundResults();
    }
  }, [phase, roomState, totalPlayers, roundResults, fetchRoundResults]);

  // ---- Automatic next round ----

  // Host automatically starts another round after the results are shown.
  useEffect(() => {
    if (
      showResults &&
      isHost &&
      roomState?.state === 'playing'
    ) {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
      }

      autoStartTimerRef.current = window.setTimeout(() => {
        handleStartRound();
      }, AUTO_START_DELAY_MS);

      return () => {
        if (autoStartTimerRef.current) {
          clearTimeout(autoStartTimerRef.current);
          autoStartTimerRef.current = null;
        }
      };
    }
  }, [showResults, isHost, roomState?.state]);

  // ---- Next-round live countdown ----
  useEffect(() => {
    if (!showResults || !isHost || roomState?.state !== 'playing') return;

    setNextRoundCountdown(Math.ceil(AUTO_START_DELAY_MS / 1000));

    const interval = window.setInterval(() => {
      setNextRoundCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showResults, isHost, roomState?.state]);

  // ---- Reset result reveal ----

  // Start the reveal from the first player when new results open.
  useEffect(() => {
    if (showResults && roomState) {
      setRevealPlayers(players);
      setRevealIndex(0);
      setRevealedCount(0);
      setRevealedPlayerId(
        players[0]?.user_id || null,
      );
    }

    // Don't restart the sequence on normal polling updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, roundResults?.round]);

  // ---- Sequential result reveal ----

  // Reveal each player's keywords one at a time, then move to the next player.
  useEffect(() => {
    if (!showResults || !roundResults) {
      return;
    }

    if (revealIndex >= revealPlayers.length) {
      return;
    }

    const currentPlayer = revealPlayers[revealIndex];

    setRevealedPlayerId(currentPlayer.user_id);
    setRevealedCount(0);

    const answers =
      roundResults.results?.[currentPlayer.user_id] || {};

    const totalKeywords = Math.min(
      4,
      Object.keys(answers).length,
    );

    const goToNextPlayer = () => {
      playerAdvanceTimerRef.current = window.setTimeout(() => {
        setRevealIndex((i) => i + 1);
      }, 3600);
    };

    if (totalKeywords === 0) {
      goToNextPlayer();
    } else {
      let count = 0;

      revealTimerRef.current = window.setInterval(() => {
        count += 1;
        setRevealedCount(count);

        if (count >= totalKeywords) {
          if (revealTimerRef.current) {
            clearInterval(revealTimerRef.current);
            revealTimerRef.current = null;
          }

          goToNextPlayer();
        }
      }, 1500);
    }

    // Clean up reveal timers when the sequence changes/stops.
    return () => {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }

      if (playerAdvanceTimerRef.current) {
        clearTimeout(playerAdvanceTimerRef.current);
        playerAdvanceTimerRef.current = null;
      }
    };
  }, [
    revealIndex,
    showResults,
    roundResults,
    revealPlayers,
  ]);

  // ---- Start round ----

  const handleStartRound = useCallback(async () => {
    if (!roomId) return;

    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/${roomId}/start_round`,
        {
          method: 'POST',
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (data.state === 'ended') {
          setRoomState((prev) =>
            prev
              ? {
                  ...prev,
                  state: 'ended',
                }
              : prev,
          );

          setShowResults(false);
          return;
        }

        throw new Error(
          data.error || 'Failed to fetch new emoji.',
        );
      }

      await fetchState();
    } catch (err: any) {
      setError(err.message || 'Error fetching new emoji.');
    } finally {
      setIsSubmitting(false);
    }
  }, [roomId, fetchState]);

  // ---- Keyword submission ----

  const handleKeywordChange = (
    index: number,
    value: string,
  ) => {
    setKeywords((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomId || !userId) return;

    // Ignore empty keyword fields.
    const filled = keywords.filter(
      (k) => k.trim() !== '',
    );

    if (filled.length === 0) {
      setError(
        'Please fill out at least one keyword before submitting.',
      );
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSubmitSuccess(false);

    try {
      const res = await fetch(
        `${API_BASE_URL}/${roomId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keywords: filled,
            user_id: userId,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        throw new Error(
          data.error || 'Failed to submit keywords.',
        );
      }

      setSubmitSuccess(true);
      await fetchState();
    } catch (err: any) {
      setError(err.message || 'Error submitting keywords.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Leave room ----

  const handleLeave = async () => {
    if (roomId && userId) {
      try {
        await fetch(
          `${API_BASE_URL}/${roomId}/leave`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
            }),
          },
        );
      } catch (err) {
        console.error(
          'Failed to notify backend on leave:',
          err,
        );
      }
    }

    localStorage.removeItem('qmoji_current_room');
    navigate('/multiplayer');
  };

  // ---- Derived scoreboard state ----

  const alreadySubmitted =
    userId ? submittedUserIds.includes(userId) : false;

  const sortedScoreboard = players
    .map((p) => ({
      ...p,
      score: roomState?.scores[p.user_id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  // ---- Render ----

  return (
    <div className="qmoji-card">
      {/* Inline styles for the answer reveal grid. */}
      <style>{`
        .qmoji-answer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          max-width: 280px;
          margin: 10px auto;
        }

        .qmoji-answer-card {
          background: #ffffff;
          color: #333;
          padding: 20px 0;
          border-radius: 8px;
          text-align: center;
          font-weight: bold;
          font-size: 1.1rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.2s ease;
          animation: qmoji-pop 0.25s ease-out;
        }

        .qmoji-answer-card.correct {
          background: #75d979;
          color: #000;
          box-shadow: 0 0 0 2px rgba(0, 255, 0, 0.2);
        }

        .qmoji-answer-card.empty {
          background: #e0e0e0;
          color: #999;
        }

        @keyframes qmoji-pop {
          from {
            transform: scale(0.7);
            opacity: 0;
          }

          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      <h1 className="qmoji-title">Mindreader</h1>

      <p className="qmoji-subtitle">
        Describe the emoji with up to four keywords!
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
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {submitSuccess && !showResults && (
        <p
          style={{
            color: 'var(--qmoji-green-bright)',
            fontWeight: 'bold',
            textAlign: 'center',
            fontSize: '0.8rem',
          }}
        >
          Successfully saved your keywords!
        </p>
      )}

      {/* ---- Round results modal ---- */}

      {showResults && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Round results"
          onClick={() => setShowResults(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="qmoji-panel-yellow"
            style={{
              width: '100%',
              maxWidth: '380px',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow:
                '0 12px 40px rgba(0,0,0,0.35)',
            }}
          >
            <button
              type="button"
              onClick={() => setShowResults(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                border: 'none',
                background: 'transparent',
                fontSize: '1.1rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px',
                color: 'var(--qmoji-ink)',
              }}
            >
              ✕
            </button>

            <h3
              style={{
                textAlign: 'center',
                marginTop: 0,
                marginBottom: '8px',
              }}
            >
              Round {roundResults?.round} Results
            </h3>

            {/* Show the emoji prominently in the results. */}
            <div
              style={{
                fontSize: '3.5rem',
                textAlign: 'center',
                marginBottom: '16px',
                lineHeight: 1,
              }}
            >
              {roundResults?.emoji}
            </div>

            {isLoadingResults ? (
              <p style={{ textAlign: 'center' }}>
                Loading results...
              </p>
            ) : roundResults ? (
              <>
                {/* ---- Answer reveal ---- */}

                <div style={{ marginBottom: '24px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                      }}
                    >
                      Let's see what
                    </span>

                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        color: 'var(--qmoji-ink)',
                      }}
                    >
                      {getPlayerName(revealedPlayerId || '')}
                    </span>

                    <span
                      style={{
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                      }}
                    >
                      answered...
                    </span>
                  </div>

                  <div className="qmoji-answer-grid">
                    {Object.entries(
                      roundResults.results?.[
                        revealedPlayerId || ''
                      ] || {},
                    )
                      .slice(0, revealedCount)
                      .map(([keyword, score]) => (
                        <div
                          key={keyword}
                          className={`qmoji-answer-card ${
                            score > 0 ? 'correct' : ''
                          }`}
                        >
                          {keyword}
                        </div>
                      ))}

                    {/* Keep the 2x2 layout while cards are being revealed. */}
                    {Array.from({
                      length: Math.max(
                        0,
                        4 - revealedCount,
                      ),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="qmoji-answer-card empty"
                      >
                        ?
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---- Round leaderboard ---- */}

                <div
                  style={{
                    borderTop:
                      '1px solid rgba(0,0,0,0.1)',
                    paddingTop: '16px',
                  }}
                >
                  {Object.entries(
                    roundResults.round_scores,
                  )
                    .sort(
                      ([, a], [, b]) => b - a,
                    )
                    .map(
                      ([id, score], index) => (
                        <div
                          key={id}
                          className={`qmoji-score-row ${
                            index === 0
                              ? 'leader'
                              : ''
                          }`}
                        >
                          <span>
                            {index === 0 ? '👑 ' : ''}
                            {getPlayerName(id)}
                          </span>

                          <span>+{score}</span>
                        </div>
                      ),
                    )}
                </div>

                {/* ---- Total scores / game status ---- */}

                <div style={{ margin: '4px 0' }}>
                  {Object.entries(
                    roundResults.total_scores,
                  )
                    .sort(
                      ([, a], [, b]) => b - a,
                    )
                    .map(
                      ([id, total], index) => (
                        <p
                          key={id}
                          style={{
                            fontSize: '0.7rem',
                            opacity: 0.7,
                            textAlign: 'center',
                            margin: '2px 0',
                          }}
                        >
                          {index + 1}. {getPlayerName(id)}: {total}
                        </p>
                      ),
                    )}
                </div>

                {isHost &&
                  roomState?.state === 'playing' && (
                    <p
                      style={{
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        marginTop: 12,
                      }}
                    >
                      Next round in{' '}
                      {nextRoundCountdown}
                      s...
                    </p>
                  )}

                {roomState?.state === 'ended' && (
                  <p
                    style={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: 'var(--qmoji-ink)',
                    }}
                  >
                    🏆 Game Over – Final Scores
                  </p>
                )}
              </>
            ) : (
              <p
                style={{
                  textAlign: 'center',
                  fontSize: '0.8rem',
                }}
              >
                No results yet.
              </p>
            )}

            {isHost &&
              roomState?.state === 'playing' && (
                <button
                  type="button"
                  className="qmoji-btn qmoji-btn-green"
                  onClick={handleStartRound}
                  disabled={isSubmitting}
                  style={{ marginTop: '10px' }}
                >
                  {isSubmitting
                    ? 'Loading...'
                    : 'Next round'}
                </button>
              )}
          </div>
        </div>
      )}

      {/* ---- Main room states ---- */}

      {!roomState ? (
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.8rem',
          }}
        >
          Loading room...
        </p>
      ) : (
        <>
          {/* ---- Waiting room ---- */}

          {roomState.state === 'waiting' && (
            <div className="qmoji-panel-yellow">
              <h3>Waiting for all players...</h3>

              <div className="qmoji-pill-row">
                {players.map((p, index) => (
                  <span
                    key={p.user_id}
                    className={`qmoji-pill ${
                      index === 0 ? 'host' : ''
                    }`}
                  >
                    {p.name}
                    {p.user_id === userId
                      ? ' (you)'
                      : ''}
                  </span>
                ))}
              </div>

              {isHost ? (
                <button
                  className="qmoji-btn qmoji-btn-green"
                  onClick={handleStartRound}
                  disabled={isSubmitting}
                  style={{ marginTop: 8 }}
                >
                  {isSubmitting
                    ? 'Starting...'
                    : 'Start'}
                </button>
              ) : (
                <button
                  className="qmoji-btn qmoji-btn-red"
                  onClick={handleLeave}
                  style={{ marginTop: 8 }}
                >
                  Leave
                </button>
              )}

              <p
                style={{
                  fontSize: '0.65rem',
                  textAlign: 'center',
                  marginTop: 10,
                  opacity: 0.8,
                }}
              >
                Share room code{' '}
                <strong>{roomId}</strong> with friends
              </p>
            </div>
          )}

          {/* ---- Active round ---- */}

          {roomState.state === 'playing' && (
            <div>
              {/* Show 3 → 2 → 1 before the emoji appears. */}
              {phase === 'countdown' &&
                countdownValue !== null &&
                countdownValue > 0 && (
                  <div
                    style={{
                      fontSize: '4rem',
                      textAlign: 'center',
                      marginBottom: 16,
                      fontFamily:
                        'var(--font-display)',
                    }}
                  >
                    {countdownValue}
                  </div>
                )}

              {phase === 'playing' && (
                <>
                  <div
                    style={{
                      fontFamily:
                        'var(--font-display)',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      marginBottom: 14,
                      color:
                        timeLeft <= 5
                          ? '#ff8a75'
                          : timeLeft <= 15
                            ? 'var(--qmoji-yellow)'
                            : 'var(--qmoji-white)',
                    }}
                  >
                    {timeLeft > 0
                      ? `${timeLeft}s`
                      : "Time's up!"}
                  </div>

                  <div
                    style={{
                      fontSize: '4rem',
                      textAlign: 'center',
                      marginBottom: 16,
                    }}
                  >
                    {roomState.emoji}
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gap: '8px', marginBottom: 16 }}>
                      {keywords.map((kw, i) => (
                        <input
                          key={i}
                          type="text"
                          className="qmoji-input"
                          placeholder={`Keyword ${i + 1}`}
                          value={kw}
                          onChange={(e) => handleKeywordChange(i, e.target.value)}
                          disabled={alreadySubmitted || isSubmitting}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="qmoji-btn qmoji-btn-green"
                      disabled={alreadySubmitted || isSubmitting}
                    >
                      {alreadySubmitted ? 'Submitted' : isSubmitting ? 'Saving...' : 'Submit'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}