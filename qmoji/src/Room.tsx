import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import Podium from './podium';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  'https://exquisite-courage-production.up.railway.app/'
).replace(/\/$/, '');

const POLL_INTERVAL_MS = 2000;
const ROUND_SECONDS = 30;
const COUNTDOWN_START = 3;
const AUTO_START_DELAY_MS = 24000;

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

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // ---- Room state ----

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [roundResults, setRoundResults] =
    useState<RoundResults | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const userId = localStorage.getItem('qmoji_user_id');
  const username = localStorage.getItem('qmoji_username');

  // ---- Playing state ----

  const [keywords, setKeywords] = useState([
    '',
    '',
    '',
    '',
  ]);

  const [timeLeft, setTimeLeft] =
    useState(ROUND_SECONDS);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [phase, setPhase] = useState<
    'waiting' | 'countdown' | 'playing' | 'results'
  >('waiting');

  const [countdownValue, setCountdownValue] =
    useState<number | null>(null);

  const [revealedPlayerId, setRevealedPlayerId] =
    useState<string | null>(null);

  // ---- Timer visuals ----

  const timerProgress = Math.max(
    0,
    Math.min(1, timeLeft / ROUND_SECONDS),
  );

  const timerDegrees = timerProgress * 360;

  const timerColor =
    timeLeft <= 5
      ? '#e02020'
      : timeLeft <= 15
        ? '#f5c542'
        : '#48d35a';

  // ---- Result reveal state ----

  const [revealedCount, setRevealedCount] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealPlayers, setRevealPlayers] =
    useState<Player[]>([]);

  // ---- Next-round countdown state ----

  const [nextRoundCountdown, setNextRoundCountdown] =
    useState(
      Math.ceil(AUTO_START_DELAY_MS / 1000),
    );

  // ---- Refs ----

  const revealTimerRef = useRef<number | null>(null);
  const playerAdvanceTimerRef =
    useRef<number | null>(null);

  const pollRef = useRef<number | null>(null);

  const lastRoundRef = useRef<number>(0);

  const autoStartTimerRef =
    useRef<number | null>(null);

  const hasJoinedRef = useRef(false);

  // Prevent automatic submission more than once
  // for the same round.
  const autoSubmittedRoundRef =
    useRef<number | null>(null);

  // Prevent multiple requests for results for
  // the same round.
  const resultsRequestedRoundRef =
    useRef<number | null>(null);

  // ---- Host ----

  const isHost = Boolean(
    roomState?.players[0]?.user_id &&
      roomState.players[0].user_id === userId,
  );

  // ---- Player name helper ----

  const getPlayerName = useCallback(
    (id: string) => {
      if (id === userId) return 'You';

      const match = roomState?.players.find(
        (p) => p.user_id === id,
      );

      return (
        match?.name ??
        `Player ${id.slice(0, 6)}`
      );
    },
    [roomState, userId],
  );

  // ============================================================
  // Navigation & joining
  // ============================================================

  useEffect(() => {
    if (!roomId || !userId || !username) {
      navigate('/multiplayer');
    }
  }, [
    roomId,
    userId,
    username,
    navigate,
  ]);

  useEffect(() => {
    if (
      !roomId ||
      !userId ||
      !username ||
      hasJoined ||
      hasJoinedRef.current
    ) {
      return;
    }

    hasJoinedRef.current = true;

    const join = async () => {
      try {
        // Check whether we're already in the room.
        try {
          const stateRes = await fetch(
            `${API_BASE_URL}/${roomId}/state`,
          );

          if (stateRes.ok) {
            const state: RoomState =
              await stateRes.json();

            if (
              state.players.some(
                (p) => p.user_id === userId,
              )
            ) {
              setRoomState(state);
              setHasJoined(true);
              return;
            }
          }
        } catch {
          // Fall through to normal join.
        }

        const res = await fetch(
          `${API_BASE_URL}/${roomId}/join`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username,
              user_id: userId,
            }),
          },
        );

        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({}));

          throw new Error(
            data.error ||
              'Failed to join room.',
          );
        }

        setHasJoined(true);
      } catch (err: any) {
        setError(
          err.message ||
            'Error joining the room.',
        );

        hasJoinedRef.current = false;
      }
    };

    join();
  }, [
    roomId,
    userId,
    username,
    hasJoined,
  ]);

  // ============================================================
  // Polling / room state
  // ============================================================

  const fetchState = useCallback(async () => {
    if (!roomId) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/${roomId}/state`,
      );

      if (res.status === 404) {
        setError('Room no longer exists.');
        return;
      }

      if (!res.ok) {
        throw new Error(
          'Error fetching room state.',
        );
      }

      const data: RoomState =
        await res.json();

      // Detect a new round.
      if (
        data.round >
        lastRoundRef.current
      ) {
        lastRoundRef.current = data.round;

        // Reset automatic submission guard.
        autoSubmittedRoundRef.current =
          null;

        // Reset result request guard.
        resultsRequestedRoundRef.current =
          null;

        // Reset round UI.
        setKeywords([
          '',
          '',
          '',
          '',
        ]);

        setSubmitSuccess(false);
        setShowResults(false);
        setRoundResults(null);

        setTimeLeft(ROUND_SECONDS);

        if (data.state === 'playing') {
          setPhase('countdown');
          setCountdownValue(
            COUNTDOWN_START,
          );
        } else {
          setPhase('waiting');
        }
      }

      setRoomState(data);
    } catch (err: any) {
      setError(
        err.message ||
          'Error updating room state.',
      );
    }
  }, [roomId]);

  useEffect(() => {
    if (!hasJoined) return;

    fetchState();

    pollRef.current =
      window.setInterval(
        fetchState,
        POLL_INTERVAL_MS,
      );

    return () => {
      if (pollRef.current) {
        window.clearInterval(
          pollRef.current,
        );
      }
    };
  }, [
    hasJoined,
    fetchState,
  ]);

  // ============================================================
  // 3 → 2 → 1 countdown
  // ============================================================

  useEffect(() => {
    if (
      phase !== 'countdown' ||
      countdownValue === null
    ) {
      return;
    }

    if (countdownValue > 0) {
      const timer = window.setTimeout(
        () => {
          setCountdownValue(
            (prev) =>
              prev !== null
                ? prev - 1
                : null,
          );
        },
        1000,
      );

      return () =>
        window.clearTimeout(timer);
    }

    setPhase('playing');
    setTimeLeft(ROUND_SECONDS);
  }, [
    phase,
    countdownValue,
  ]);

  // ============================================================
  // Fetch results
  // ============================================================

  const fetchRoundResults =
    useCallback(async () => {
      if (!roomId) return;

      const currentRound =
        roomState?.round;

      // Don't request the same round twice.
      if (
        currentRound !== undefined &&
        resultsRequestedRoundRef.current ===
          currentRound
      ) {
        return;
      }

      if (currentRound !== undefined) {
        resultsRequestedRoundRef.current =
          currentRound;
      }

      setIsLoadingResults(true);

      try {
        const res = await fetch(
          `${API_BASE_URL}/${roomId}/round_results`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
          },
        );

        if (!res.ok) {
          throw new Error(
            'Could not load round results.',
          );
        }

        const data: RoundResults =
          await res.json();

        setRoundResults(data);
        setShowResults(true);
        setPhase('results');
      } catch (err: any) {
        // Allow another attempt if loading
        // results failed.
        if (
          currentRound !== undefined &&
          resultsRequestedRoundRef.current ===
            currentRound
        ) {
          resultsRequestedRoundRef.current =
            null;
        }

        setError(
          err.message ||
            'Failed to load round results.',
        );
      } finally {
        setIsLoadingResults(false);
      }
    }, [
      roomId,
      roomState?.round,
    ]);

  // ============================================================
  // Keyword submission
  //
  // Used by:
  // 1. Manual "Enter word" button
  // 2. Automatic timeout submission
  // ============================================================

  const submitKeywords =
    useCallback(
      async (automatic = false) => {
        if (!roomId || !userId) {
          return;
        }

        const filled = keywords
          .map((keyword) =>
            keyword.trim(),
          )
          .filter(
            (keyword) => keyword !== '',
          );

        // If the timer expires and the user
        // entered nothing, proceed directly
        // to results.
        if (filled.length === 0) {
          if (automatic) {
            await fetchRoundResults();
          }

          return;
        }

        setIsSubmitting(true);
        setError('');

        try {
          const res = await fetch(
            `${API_BASE_URL}/${roomId}/submit`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                keywords: filled,
                user_id: userId,
              }),
            },
          );

          if (!res.ok) {
            const data =
              await res
                .json()
                .catch(() => ({}));

            throw new Error(
              data.error ||
                'Failed to submit keywords.',
            );
          }

          setSubmitSuccess(true);

          // Update submitted_count.
          await fetchState();

          // Timeout submission should move
          // directly to results.
          if (automatic) {
            await fetchRoundResults();
          }
        } catch (err: any) {
          // If automatic submission failed,
          // allow it to be attempted again.
          if (
            automatic &&
            roomState?.round !==
              undefined
          ) {
            autoSubmittedRoundRef.current =
              null;
          }

          setError(
            err.message ||
              'Error submitting keywords.',
          );
        } finally {
          setIsSubmitting(false);
        }
      },
      [
        roomId,
        userId,
        keywords,
        roomState?.round,
        fetchState,
        fetchRoundResults,
      ],
    );

  // ============================================================
  // 30-second round timer
  // ============================================================

  useEffect(() => {
    if (phase !== 'playing') {
      return;
    }

    if (timeLeft > 0) {
      const timer = window.setTimeout(
        () => {
          setTimeLeft((prev) =>
            Math.max(0, prev - 1),
          );
        },
        1000,
      );

      return () =>
        window.clearTimeout(timer);
    }

    const currentRound =
      roomState?.round;

    if (currentRound === undefined) {
      return;
    }

    const alreadySubmitted =
      roomState.submitted_user_ids.includes(
        userId ?? '',
      );

    // The user manually submitted before
    // the timer expired.
    if (alreadySubmitted) {
      if (
        !roundResults ||
        roundResults.round !==
          currentRound
      ) {
        fetchRoundResults();
      }

      return;
    }

    // Already attempted automatic submission
    // for this round.
    if (
      autoSubmittedRoundRef.current ===
      currentRound
    ) {
      return;
    }

    // Lock immediately BEFORE submitting.
    // This prevents React re-renders from
    // triggering multiple requests.
    autoSubmittedRoundRef.current =
      currentRound;

    submitKeywords(true);
  }, [
    phase,
    timeLeft,
    roomState?.round,
    roomState?.submitted_user_ids,
    userId,
    roundResults,
    submitKeywords,
    fetchRoundResults,
  ]);

  // ============================================================
  // Fetch results early if everyone submitted
  // ============================================================

  useEffect(() => {
    if (
      phase !== 'playing' ||
      !roomState ||
      roomState.total_players <= 0
    ) {
      return;
    }

    if (
      roomState.submitted_count ===
      roomState.total_players &&
      (!roundResults ||
        roundResults.round !==
          roomState.round)
    ) {
      fetchRoundResults();
    }
  }, [
    phase,
    roomState,
    roundResults,
    fetchRoundResults,
  ]);

  // ============================================================
  // Automatic next round
  // ============================================================

  useEffect(() => {
    if (
      !showResults ||
      !isHost ||
      roomState?.state !== 'playing'
    ) {
      return;
    }

    if (autoStartTimerRef.current) {
      window.clearTimeout(
        autoStartTimerRef.current,
      );
    }

    autoStartTimerRef.current =
      window.setTimeout(() => {
        handleStartRound();
      }, AUTO_START_DELAY_MS);

    return () => {
      if (autoStartTimerRef.current) {
        window.clearTimeout(
          autoStartTimerRef.current,
        );

        autoStartTimerRef.current = null;
      }
    };
  }, [
    showResults,
    isHost,
    roomState?.state,
  ]);

  // ============================================================
  // Next-round countdown
  // ============================================================

  useEffect(() => {
    if (
      !showResults ||
      !isHost ||
      roomState?.state !== 'playing'
    ) {
      return;
    }

    setNextRoundCountdown(
      Math.ceil(
        AUTO_START_DELAY_MS / 1000,
      ),
    );

    const interval =
      window.setInterval(() => {
        setNextRoundCountdown(
          (prev) => {
            if (prev <= 1) {
              window.clearInterval(
                interval,
              );

              return 0;
            }

            return prev - 1;
          },
        );
      }, 1000);

    return () =>
      window.clearInterval(interval);
  }, [
    showResults,
    isHost,
    roomState?.state,
  ]);

  // ============================================================
  // Reset result reveal
  // ============================================================

  useEffect(() => {
    if (
      showResults &&
      roomState
    ) {
      setRevealPlayers(
        roomState.players,
      );

      setRevealIndex(0);
      setRevealedCount(0);

      setRevealedPlayerId(
        roomState.players[0]
          ?.user_id || null,
      );
    }
  }, [
    showResults,
    roundResults?.round,
  ]);

  // ============================================================
  // Sequential result reveal
  // ============================================================

  useEffect(() => {
    if (
      !showResults ||
      !roundResults
    ) {
      return;
    }

    if (
      revealIndex >=
      revealPlayers.length
    ) {
      return;
    }

    const currentPlayer =
      revealPlayers[revealIndex];

    setRevealedPlayerId(
      currentPlayer.user_id,
    );

    setRevealedCount(0);

    const answers =
      roundResults.results?.[
        currentPlayer.user_id
      ] || {};

    const totalKeywords =
      Math.min(
        4,
        Object.keys(answers).length,
      );

    const goToNextPlayer = () => {
      playerAdvanceTimerRef.current =
        window.setTimeout(() => {
          setRevealIndex(
            (i) => i + 1,
          );
        }, 3600);
    };

    if (totalKeywords === 0) {
      goToNextPlayer();
    } else {
      let count = 0;

      revealTimerRef.current =
        window.setInterval(() => {
          count += 1;

          setRevealedCount(count);

          if (
            count >= totalKeywords
          ) {
            if (
              revealTimerRef.current
            ) {
              window.clearInterval(
                revealTimerRef.current,
              );

              revealTimerRef.current =
                null;
            }

            goToNextPlayer();
          }
        }, 1500);
    }

    return () => {
      if (
        revealTimerRef.current
      ) {
        window.clearInterval(
          revealTimerRef.current,
        );

        revealTimerRef.current =
          null;
      }

      if (
        playerAdvanceTimerRef.current
      ) {
        window.clearTimeout(
          playerAdvanceTimerRef.current,
        );

        playerAdvanceTimerRef.current =
          null;
      }
    };
  }, [
    revealIndex,
    showResults,
    roundResults,
    revealPlayers,
  ]);

  // ============================================================
  // Start round
  // ============================================================

  const handleStartRound =
    useCallback(async () => {
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
          const data =
            await res
              .json()
              .catch(() => ({}));

          if (
            data.state === 'ended'
          ) {
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
            data.error ||
              'Failed to fetch new emoji.',
          );
        }

        await fetchState();
      } catch (err: any) {
        setError(
          err.message ||
            'Error fetching new emoji.',
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [
      roomId,
      fetchState,
    ]);

  // ============================================================
  // Keyword input
  // ============================================================

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

  // ============================================================
  // Manual submission
  // ============================================================

  const handleSubmit = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    if (!roomId || !userId) {
      return;
    }

    const filled = keywords.filter(
      (k) => k.trim() !== '',
    );

    if (filled.length === 0) {
      setError(
        'Please fill out at least one keyword before submitting.',
      );

      return;
    }

    await submitKeywords(false);
  };

  // ============================================================
  // Leave room
  // ============================================================

  const handleLeave = async () => {
    if (roomId && userId) {
      try {
        await fetch(
          `${API_BASE_URL}/${roomId}/leave`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
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

    localStorage.removeItem(
      'qmoji_current_room',
    );

    navigate('/multiplayer');
  };

  // ============================================================
  // Derived scoreboard state
  // ============================================================

  const alreadySubmitted =
    roomState?.submitted_user_ids.includes(
      userId ?? '',
    ) ?? false;

  const sortedScoreboard =
    roomState
      ? [...roomState.players]
          .map((p) => ({
            ...p,
            score:
              roomState.scores[
                p.user_id
              ] ?? 0,
          }))
          .sort(
            (a, b) =>
              b.score - a.score,
          )
      : [];

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="qmoji-card">
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

        .qmoji-round-timer {
          transition:
            background 0.4s linear,
            transform 0.2s ease;
        }

        .qmoji-round-timer:hover {
          transform: scale(1.01);
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

        @keyframes qmoji-timer-pulse {
          0%, 100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.025);
          }
        }

        .qmoji-timer-danger {
          animation: qmoji-timer-pulse 0.8s ease-in-out infinite;
        }
      `}</style>

      <h1 className="qmoji-title">
        Mindreader
      </h1>

      <p className="qmoji-subtitle">
        Describe the emoji with up to four
        keywords in 30 seconds!
      </p>

      {error && (
        <div
          style={{
            color: '#ffb4a8',
            background:
              'rgba(192,57,43,0.25)',
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

      {submitSuccess &&
        !showResults && (
          <p
            style={{
              color:
                'var(--qmoji-green-bright)',
              fontWeight: 'bold',
              textAlign: 'center',
              fontSize: '0.8rem',
            }}
          >
            Successfully saved your
            keywords!
          </p>
        )}

      {/* ======================================================
          ROUND RESULTS MODAL
          ====================================================== */}

      {showResults && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Round results"
          onClick={() =>
            setShowResults(false)
          }
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
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
              onClick={() =>
                setShowResults(false)
              }
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                border: 'none',
                background:
                  'transparent',
                fontSize: '1.1rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px',
                color:
                  'var(--qmoji-ink)',
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
              Round{' '}
              {roundResults?.round}{' '}
              Results
            </h3>

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
              <p
                style={{
                  textAlign: 'center',
                }}
              >
                Loading results...
              </p>
            ) : roundResults ? (
              <>
                {/* Answer reveal */}

                <div
                  style={{
                    marginBottom: '24px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'center',
                      alignItems:
                        'center',
                      gap: '6px',
                      marginBottom:
                        '12px',
                      flexWrap:
                        'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontWeight:
                          'bold',
                        fontSize:
                          '0.9rem',
                      }}
                    >
                      Let's see what
                    </span>

                    <span
                      style={{
                        padding:
                          '4px 8px',
                        borderRadius:
                          '4px',
                        fontSize:
                          '0.9rem',
                        fontWeight:
                          'bold',
                        color:
                          'var(--qmoji-ink)',
                      }}
                    >
                      {getPlayerName(
                        revealedPlayerId ||
                          '',
                      )}
                    </span>

                    <span
                      style={{
                        fontWeight:
                          'bold',
                        fontSize:
                          '0.9rem',
                      }}
                    >
                      answered...
                    </span>
                  </div>

                  <div className="qmoji-answer-grid">
                    {Object.entries(
                      roundResults
                        .results?.[
                        revealedPlayerId ||
                          ''
                      ] || {},
                    )
                      .slice(
                        0,
                        revealedCount,
                      )
                      .map(
                        ([
                          keyword,
                          score,
                        ]) => (
                          <div
                            key={keyword}
                            className={`qmoji-answer-card ${
                              score >
                              0
                                ? 'correct'
                                : ''
                            }`}
                          >
                            {keyword}
                          </div>
                        ),
                      )}

                    {Array.from({
                      length: Math.max(
                        0,
                        4 -
                          revealedCount,
                      ),
                    }).map(
                      (_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="qmoji-answer-card empty"
                        >
                          ?
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Round leaderboard */}

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
                      ([, a], [, b]) =>
                        b - a,
                    )
                    .map(
                      (
                        [
                          id,
                          score,
                        ],
                        index,
                      ) => (
                        <div
                          key={id}
                          className={`qmoji-score-row ${
                            index === 0
                              ? 'leader'
                              : ''
                          }`}
                        >
                          <span>
                            {index ===
                            0
                              ? '👑 '
                              : ''}
                            {getPlayerName(
                              id,
                            )}
                          </span>

                          <span>
                            +{score}
                          </span>
                        </div>
                      ),
                    )}
                </div>

                {/* Total scores */}

                <div
                  style={{
                    margin:
                      '4px 0',
                  }}
                >
                  {Object.entries(
                    roundResults.total_scores,
                  )
                    .sort(
                      ([, a], [, b]) =>
                        b - a,
                    )
                    .map(
                      (
                        [
                          id,
                          total,
                        ],
                        index,
                      ) => (
                        <p
                          key={id}
                          style={{
                            fontSize:
                              '0.7rem',
                            opacity:
                              0.7,
                            textAlign:
                              'center',
                            margin:
                              '2px 0',
                          }}
                        >
                          {index +
                            1}
                          .{' '}
                          {getPlayerName(
                            id,
                          )}
                          : {total}
                        </p>
                      ),
                    )}
                </div>

                {/* Next round countdown */}

                {isHost &&
                  roomState?.state ===
                    'playing' && (
                    <p
                      style={{
                        textAlign:
                          'center',
                        fontSize:
                          '0.7rem',
                        marginTop: 12,
                      }}
                    >
                      Next round in{' '}
                      {
                        nextRoundCountdown
                      }
                      s...
                    </p>
                  )}

                {roomState?.state ===
                  'ended' && (
                  <p
                    style={{
                      textAlign:
                        'center',
                      fontWeight:
                        'bold',
                      color:
                        'var(--qmoji-ink)',
                    }}
                  >
                    🏆 Game Over –
                    Final Scores
                  </p>
                )}
              </>
            ) : (
              <p
                style={{
                  textAlign:
                    'center',
                  fontSize:
                    '0.8rem',
                }}
              >
                No results yet.
              </p>
            )}

            {isHost &&
              roomState?.state ===
                'playing' && (
                <button
                  type="button"
                  className="qmoji-btn qmoji-btn-green"
                  onClick={
                    handleStartRound
                  }
                  disabled={
                    isSubmitting
                  }
                  style={{
                    marginTop:
                      '10px',
                  }}
                >
                  {isSubmitting
                    ? 'Loading...'
                    : 'Next round'}
                </button>
              )}
          </div>
        </div>
      )}

      {/* ======================================================
          MAIN ROOM STATES
          ====================================================== */}

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
          {/* ==================================================
              WAITING ROOM
              ================================================== */}

          {roomState.state ===
            'waiting' && (
            <div className="qmoji-panel-yellow">
              <h3>
                Waiting for all players...
              </h3>

              <div className="qmoji-pill-row">
                {roomState.players.map(
                  (p, index) => (
                    <span
                      key={p.user_id}
                      className={`qmoji-pill ${
                        index === 0
                          ? 'host'
                          : ''
                      }`}
                    >
                      {p.name}
                      {p.user_id ===
                      userId
                        ? ' (you)'
                        : ''}
                    </span>
                  ),
                )}
              </div>

              {isHost ? (
                <button
                  className="qmoji-btn qmoji-btn-green"
                  onClick={
                    handleStartRound
                  }
                  disabled={
                    isSubmitting
                  }
                  style={{
                    marginTop: 8,
                  }}
                >
                  {isSubmitting
                    ? 'Starting...'
                    : 'Start'}
                </button>
              ) : (
                <button
                  className="qmoji-btn qmoji-btn-red"
                  onClick={
                    handleLeave
                  }
                  style={{
                    marginTop: 8,
                  }}
                >
                  Leave
                </button>
              )}

              <p
                style={{
                  fontSize:
                    '0.65rem',
                  textAlign:
                    'center',
                  marginTop: 10,
                  opacity: 0.8,
                }}
              >
                <strong>
                  {roomId}
                </strong>
              </p>
            </div>
          )}

          {/* ==================================================
              ACTIVE ROUND
              ================================================== */}

          {roomState.state ===
            'playing' && (
            <div>
              {/* 3 → 2 → 1 */}

              {phase ===
                'countdown' &&
                countdownValue !==
                  null &&
                countdownValue > 0 && (
                  <div
                    style={{
                      fontSize:
                        '4rem',
                      textAlign:
                        'center',
                      marginBottom:
                        16,
                      fontFamily:
                        'var(--font-display)',
                    }}
                  >
                    {
                      countdownValue
                    }
                  </div>
                )}

              {phase ===
                'playing' && (
                <>
                  {/* ========================================
                      CIRCULAR TIMER + EMOJI
                      ======================================== */}

                  <div
                    className={
                      timeLeft <= 5
                        ? 'qmoji-round-timer qmoji-timer-danger'
                        : 'qmoji-round-timer'
                    }
                    role="timer"
                    aria-label={`${
                      timeLeft
                    } seconds remaining`}
                    style={{
                      position:
                        'relative',
                      width:
                        'min(375px, 80vw)',
                      aspectRatio:
                        '1',
                      margin:
                        '20px auto 24px',
                      borderRadius:
                        '50%',
                      background:
                        `conic-gradient(
                          ${timerColor} 0deg ${timerDegrees}deg,
                          rgba(255,255,255,0.16) ${timerDegrees}deg 360deg
                        )`,
                      display:
                        'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                    }}
                  >
                    {/* Inner circle */}

                    <div
                      style={{
                        width:
                          'calc(100% - 12px)',
                        height:
                          'calc(100% - 12px)',
                        borderRadius:
                          '50%',
                        background:
                          'var(--qmoji-purple, #5b1b61)',
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        position:
                          'relative',
                      }}
                    >
                      {/* Emoji */}

                      <div
                        style={{
                          fontSize:
                            'clamp(5rem, 15vw, 7rem)',
                          lineHeight: 1,
                          userSelect:
                            'none',
                        }}
                      >
                        {
                          roomState.emoji
                        }
                      </div>

                      {/* Timer text */}

                      <div
                        style={{
                          position:
                            'absolute',
                          bottom:
                            '19%',
                          fontFamily:
                            'var(--font-display)',
                          fontSize:
                            '1rem',
                          fontWeight:
                            'bold',
                          color:
                            timerColor,
                          transition:
                            'color 0.3s ease',
                        }}
                      >
                        {timeLeft >
                        0
                          ? `${timeLeft}s`
                          : 'Submitting...'}
                      </div>
                    </div>
                  </div>

                  {/* Submission count */}

                  <p
                    style={{
                      textAlign:
                        'center',
                      fontSize:
                        '0.7rem',
                      opacity: 0.8,
                      marginBottom:
                        14,
                    }}
                  >
                    {
                      roomState.submitted_count
                    }{' '}
                    /{' '}
                    {
                      roomState.total_players
                    }{' '}
                    players have
                    submitted
                  </p>

                  {/* ========================================
                      KEYWORD INPUT
                      ======================================== */}

                  {!alreadySubmitted ? (
                    <form
                      onSubmit={
                        handleSubmit
                      }
                      onKeyDown={(
                        e: React.KeyboardEvent<HTMLFormElement>,
                      ) => {
                        if (
                          e.key ===
                          'Enter'
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <div
                        className="qmoji-word-grid"
                        style={{
                          marginBottom:
                            14,
                        }}
                      >
                        {keywords.map(
                          (
                            kw,
                            i,
                          ) => (
                            <input
                              key={i}
                              type="text"
                              className="qmoji-input"
                              value={
                                kw
                              }
                              placeholder={`Keyword ${
                                i +
                                1
                              }`}
                              onChange={(
                                e,
                              ) =>
                                handleKeywordChange(
                                  i,
                                  e
                                    .target
                                    .value,
                                )
                              }
                              disabled={
                                isSubmitting ||
                                timeLeft ===
                                  0
                              }
                            />
                          ),
                        )}
                      </div>

                      <button
                        type="submit"
                        className="qmoji-btn qmoji-btn-green"
                        disabled={
                          isSubmitting ||
                          timeLeft ===
                            0
                        }
                      >
                        {isSubmitting
                          ? 'Saving...'
                          : 'Enter word'}
                      </button>
                    </form>
                  ) : (
                    <p
                      style={{
                        textAlign:
                          'center',
                        fontStyle:
                          'italic',
                        fontSize:
                          '0.75rem',
                        opacity:
                          0.8,
                      }}
                    >
                      Your words
                      are locked
                      in!
                    </p>
                  )}
                </>
              )}

              {/* ==========================================
                  LIVE SCOREBOARD
                  ========================================== */}

              {phase ===
                'playing' && (
                <div
                  style={{
                    marginTop: 20,
                  }}
                >
                  {sortedScoreboard.map(
                    (
                      p,
                      index,
                    ) => (
                      <div
                        key={
                          p.user_id
                        }
                        className={`qmoji-score-row ${
                          index === 0
                            ? 'leader'
                            : ''
                        }`}
                      >
                        <span>
                          {index ===
                          0
                            ? '👑 '
                            : ''}
                          {
                            p.name
                          }
                          {p.user_id ===
                          userId
                            ? ' (you)'
                            : ''}
                        </span>

                        <span>
                          {
                            p.score
                          }
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              GAME OVER
              ================================================== */}

          {roomState.state ===
            'ended' && (
            <Podium
              players={
                sortedScoreboard
              }
              onPlayAgain={
                handleStartRound
              }
              onLeave={
                handleLeave
              }
            />
          )}
        </>
      )}

      <p className="qmoji-footer">
        Powered by SILICON @ Stanford
      </p>
    </div>
  );
}
