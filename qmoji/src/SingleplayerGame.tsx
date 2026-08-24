//This is the singleplayergame which is like a battle royale between all possible singlegamemode players, not in development for now, but it will work
import { useState, useEffect } from 'react';
import Start from './Start';
import { canStartNextRound } from './roundUtils.js';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  'https://exquisite-courage-production.up.railway.app/'
).replace(/\/$/, '');

// Shape of the results returned by the backend.
type RoundResults = {
  round: number;
  emoji: string;
  results: Record<string, Record<string, number>>; // user_id -> { word: count }
  round_scores: Record<string, number>; // user_id -> points this round
  total_scores: Record<string, number>; // user_id -> running total
};

function SingleplayerGame() {
  // ---- Game state ----

  const [showEmoji, setShowEmoji] = useState(false);
  const [currentEmoji, setCurrentEmoji] = useState('');
  const [keywords, setKeywords] = useState(['', '', '', '']);
  const [inputLanguage, setInputLanguage] = useState('English');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');

  // ---- Timer & rounds ----

  const [timeLeft, setTimeLeft] = useState(30);
  const [roundResults, setRoundResults] =
    useState<RoundResults | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const [maxRounds, setMaxRounds] = useState(16);
  const [roundCount, setRoundCount] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  // ---- 30-second countdown ----

  // Pause the timer after submission so the user can view results.
  useEffect(() => {
    let timer: number;

    if (
      showEmoji &&
      timeLeft > 0 &&
      !submitSuccess
    ) {
      timer = window.setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [showEmoji, timeLeft, submitSuccess]);

  // ---- Get/reveal a new emoji ----

  const handleRevealEmoji = async () => {
    // Reset the game if the user starts again after completing it.
    if (gameComplete) {
      setGameComplete(false);
      setRoundCount(0);
    }

    // Prevent starting beyond the selected round limit.
    if (
      !canStartNextRound(
        roundCount,
        maxRounds,
        submitSuccess,
      )
    ) {
      setGameComplete(true);
      setShowEmoji(false);
      setCurrentEmoji('');
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');
    setSubmitSuccess(false);
    setRoundResults(null);

    try {
      // The backend creates a room and returns a random emoji.
      const roomResponse = await fetch(
        `${API_BASE_URL}/create_room`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            language: inputLanguage || 'en',
          }),
        },
      );

      if (!roomResponse.ok) {
        throw new Error(
          'Could not start a new room.',
        );
      }

      const { emoji } = await roomResponse.json();

      // Reset everything needed for the new round.
      setCurrentEmoji(emoji);
      setKeywords(['', '', '', '']);
      setTimeLeft(30);
      setShowEmoji(true);
      setRoundCount((prev) => prev + 1);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : 'Could not load an emoji from the server.';

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Keyword input ----

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

  // ---- Fetch round results ----

  const fetchRoundResults = async () => {
    setIsLoadingResults(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/1/round_results`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          'Could not load round results.',
        );
      }

      const data: RoundResults =
        await response.json();

      setRoundResults(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load round results.';

      setError(message);
    } finally {
      setIsLoadingResults(false);
    }
  };

  // ---- Submit keywords ----

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    // Don't allow submission beyond the round limit.
    if (roundCount >= maxRounds) {
      setGameComplete(true);
      setShowEmoji(false);
      setCurrentEmoji('');
      return;
    }

    // Remove empty keyword fields.
    const filledKeywords = keywords.filter(
      (kw) => kw.trim() !== '',
    );

    if (filledKeywords.length === 0) {
      setError(
        'Please fill out at least one keyword before submitting.',
      );
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Send the user's answers to the backend.
      const response = await fetch(
        `${API_BASE_URL}/1/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keywords: filledKeywords,
            user_id: getUserId(),
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to save keywords.',
        );
      }

      // Submission succeeded, so show the results modal.
      setSubmitSuccess(true);
      fetchRoundResults();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save to database.';

      setError(`Database Error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Start another round ----

  const handleTryAnother = () => {
    if (roundCount >= maxRounds) {
      setGameComplete(true);
      setShowEmoji(false);
      setCurrentEmoji('');
      return;
    }

    handleRevealEmoji();
  };

  // ---- Persistent user ID ----

  // Create a local ID once so the backend can identify this player.
  const getUserId = () => {
    let id = localStorage.getItem('qmoji_user_id');

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(
        'qmoji_user_id',
        id,
      );
    }

    return id;
  };

  // ---- Render ----

  return (
    <main className="qmoji-app">
      <header className="qmoji-header">
        <h1>Mindreader</h1>

        <p>
          Describe the emoji with up to four keywords in 30 seconds!
        </p>

        {/* Show language/round setup before the game starts. */}
        {!showEmoji && (
          <Start
            inputLanguage={inputLanguage}
            setInputLanguage={setInputLanguage}
            onReveal={handleRevealEmoji}
            isLoading={isLoading}
            maxRounds={maxRounds}
            setMaxRounds={setMaxRounds}
          />
        )}
      </header>

      {/* Display API or validation errors. */}
      {error && (
        <p
          className="qmoji-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Confirm that the keywords were saved. */}
      {submitSuccess && (
        <p
          className="qmoji-success"
          role="alert"
          style={{
            color: 'green',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          Successfully saved your keywords!
        </p>
      )}

      {/* ---- Results modal ---- */}

      {submitSuccess && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Round results"
          onClick={() => setSubmitSuccess(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
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
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow:
                '0 12px 40px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            {/* Close the results modal. */}
            <button
              type="button"
              onClick={() =>
                setSubmitSuccess(false)
              }
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                border: 'none',
                background: 'transparent',
                fontSize: '1.25rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px',
              }}
            >
              ✕
            </button>

            <h3
              style={{
                textAlign: 'center',
                marginTop: 0,
                marginBottom: '4px',
              }}
            >
              How everyone answered{' '}
              {roundResults?.emoji ??
                currentEmoji}
            </h3>

            {isLoadingResults ? (
              <p style={{ textAlign: 'center' }}>
                Loading results...
              </p>
            ) : roundResults ? (
              <>
                {/* Show this round's points and running total. */}
                <p
                  style={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    color: '#2e7d32',
                    margin: '8px 0 16px',
                  }}
                >
                  +
                  {roundResults.round_scores[
                    getUserId()
                  ] ?? 0}{' '}
                  🏆

                  {roundResults.total_scores[
                    getUserId()
                  ] !== undefined && (
                    <span
                      style={{
                        fontWeight: 500,
                        color: '#555',
                        display: 'block',
                        fontSize: '0.85rem',
                      }}
                    >
                      total:{' '}
                      {
                        roundResults.total_scores[
                          getUserId()
                        ]
                      }
                    </span>
                  )}
                </p>

                {/* Display each player's answers as bars. */}
                {Object.entries(
                  roundResults.results,
                ).map(
                  ([userId, words]) => {
                    const sortedWords =
                      Object.entries(words).sort(
                        ([, a], [, b]) =>
                          b - a,
                      );

                    const maxCount = Math.max(
                      ...sortedWords.map(
                        ([, c]) => c,
                      ),
                      1,
                    );

                    return (
                      <div
                        key={userId}
                        style={{
                          marginBottom: '20px',
                        }}
                      >
                        <strong>
                          {userId ===
                          getUserId()
                            ? 'You'
                            : `Player ${userId.slice(
                                0,
                                6,
                              )}`}
                        </strong>

                        <ul
                          style={{
                            listStyle: 'none',
                            padding: 0,
                            marginTop: '8px',
                          }}
                        >
                          {sortedWords.map(
                            (
                              [word, count],
                              index,
                            ) => (
                              <li
                                key={word}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns:
                                    '1fr auto',
                                  alignItems:
                                    'center',
                                  gap: '8px',
                                  marginBottom:
                                    '6px',
                                }}
                              >
                                <div
                                  style={{
                                    position:
                                      'relative',
                                    background:
                                      '#eee',
                                    borderRadius:
                                      '6px',
                                    overflow:
                                      'hidden',
                                    height: '28px',
                                  }}
                                >
                                  {/* Bar width represents how often the word was chosen. */}
                                  <div
                                    style={{
                                      position:
                                        'absolute',
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: `${
                                        (count /
                                          maxCount) *
                                        100
                                      }%`,
                                      background:
                                        '#4CAF50',
                                      transition:
                                        'width 0.4s ease',
                                      transitionDelay: `${
                                        index *
                                        80
                                      }ms`,
                                    }}
                                  />

                                  <span
                                    style={{
                                      position:
                                        'relative',
                                      padding:
                                        '0 10px',
                                      lineHeight:
                                        '28px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {word}
                                  </span>
                                </div>

                                <span
                                  style={{
                                    fontWeight:
                                      'bold',
                                    minWidth:
                                      '24px',
                                    textAlign:
                                      'right',
                                  }}
                                >
                                  {count}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    );
                  },
                )}
              </>
            ) : (
              <p
                style={{
                  textAlign: 'center',
                }}
              >
                No results yet.
              </p>
            )}

            {/* Close results and start another round. */}
            <button
              type="button"
              onClick={handleTryAnother}
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                font: 'inherit',
                fontWeight: 500,
                marginTop: '8px',
              }}
            >
              Try another emoji
            </button>
          </div>
        </div>
      )}

      {/* ---- Before an emoji is revealed ---- */}

      {!showEmoji ? (
        <section
          className="qmoji-stage"
          aria-live="polite"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {gameComplete ? (
            <>
              <h2 style={{ margin: 0 }}>
                Session complete
              </h2>

              <p style={{ margin: 0 }}>
                You finished {maxRounds} rounds.
                Start another session to play
                again.
              </p>
            </>
          ) : (

          )}
        </section>
      ) : (
        <div className="workspace-container">
          {/* ---- Emoji and timer ---- */}

          <section
            className="qmoji-stage"
            aria-live="polite"
            style={{
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color:
                  timeLeft <= 5
                    ? '#b42318'
                    : 'var(--text-h)',
                textAlign: 'center',
              }}
            >
              {timeLeft > 0
                ? `Time remaining: ${timeLeft}s`
                : "Time's up!"}
            </div>

            <div
              className="emoji-display"
              aria-label="Random emoji"
            >
              <span
                className="emoji"
                role="img"
              >
                {currentEmoji}
              </span>
            </div>
          </section>

          {/* ---- Keyword input ---- */}

          <section
            className="keyword-panel"
            aria-labelledby="keyword-prompt"
          >
            <h2
              id="keyword-prompt"
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              What words come to mind for{' '}
              <span
                className="emoji-inline"
                aria-hidden="true"
                style={{
                  fontSize: '1.2em',
                }}
              >
                {currentEmoji}
              </span>
              ?
            </h2>

            <form
              className="keyword-form"
              onSubmit={handleSubmit}
            >
              <div className="keyword-grid">
                {keywords.map(
                  (keyword, index) => (
                    <label
                      key={index}
                      className="keyword-field"
                    >
                      Keyword {index + 1}

                      <input
                        type="text"
                        value={keyword}
                        placeholder={`Keyword ${
                          index + 1
                        }${
                          inputLanguage.trim()
                            ? ` (${inputLanguage.trim()})`
                            : ''
                        }`}
                        onChange={(event) =>
                          handleKeywordChange(
                            index,
                            event.target.value,
                          )
                        }
                        autoComplete="off"
                        disabled={
                          isSubmitting ||
                          submitSuccess ||
                          timeLeft === 0
                        }
                      />
                    </label>
                  ),
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '24px',
                }}
              >
                {!submitSuccess && (
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontWeight: 500,
                    }}
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : 'Submit Keywords'}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default SingleplayerGame;
