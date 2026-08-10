import { useState, useEffect } from 'react';
import Start from './Start';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');

type RoundResults = {
  round: number;
  emoji: string;
  results: Record<string, Record<string, number>>; // user_id -> { word: count }
  round_scores: Record<string, number>; // user_id -> points earned this round
  total_scores: Record<string, number>; // user_id -> running total
};

function SingleplayerGame() {
  const [showEmoji, setShowEmoji] = useState(false);
  const [currentEmoji, setCurrentEmoji] = useState('');
  const [keywords, setKeywords] = useState(['', '', '', '']);
  const [inputLanguage, setInputLanguage] = useState('English');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  useEffect(() => {
    let timer: number;
    if (showEmoji && timeLeft > 0 && !submitSuccess) {
      timer = window.setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [showEmoji, timeLeft, submitSuccess]);

  const handleRevealEmoji = async () => {
    setIsLoading(true);
    setError('');
    setSubmitSuccess(false);
    setRoundResults(null);

    try {
      const roomResponse = await fetch(`${API_BASE_URL}/create_room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: inputLanguage || 'en' }),
      });
      if (!roomResponse.ok) {
        throw new Error('Could not start a new room.');
      }

      const { emoji } = await roomResponse.json();
      setCurrentEmoji(emoji);
      setKeywords(['', '', '', '']);
      setTimeLeft(30);
      setShowEmoji(true);
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

  const handleKeywordChange = (index: number, value: string) => {
    setKeywords((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const fetchRoundResults = async () => {
    setIsLoadingResults(true);
    try {
      const response = await fetch(`${API_BASE_URL}/1/round_results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Could not load round results.');
      }
      const data: RoundResults = await response.json();
      setRoundResults(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : 'Failed to load round results.';
      setError(message);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const filledKeywords = keywords.filter((kw) => kw.trim() !== '');
    if (filledKeywords.length === 0) {
      setError('Please fill out at least one keyword before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/1/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: filledKeywords, user_id: getUserId() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save keywords.');
      }

      setSubmitSuccess(true);
      fetchRoundResults();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.';
      setError(`Database Error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTryAnother = () => {
    //setShowEmoji(false);
    //setCurrentEmoji('');
    //setKeywords(['', '', '', '']);
    //setTimeLeft(30);
    //setError('');
    //setSubmitSuccess(false);
    //setRoundResults(null);
    handleRevealEmoji();
  };

  const getUserId = () => {
    let id = localStorage.getItem('qmoji_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('qmoji_user_id', id);
    }
    return id;
  };

  return (
    <main className="qmoji-app">
      <header className="qmoji-header">
        <h1>QMoji</h1>
        <p>
          Describe the emoji with up to four keywords in 30 seconds!
          New game modes coming soon.
        </p>
        {!showEmoji && (
          <Start
            inputLanguage={inputLanguage}
            setInputLanguage={setInputLanguage}
            onReveal={handleRevealEmoji}
            isLoading={isLoading}
          />
        )}
      </header>

      {error && (
        <p className="qmoji-error" role="alert">
          {error}
        </p>
      )}

      {submitSuccess && (
        <p
          className="qmoji-success"
          role="alert"
          style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}
        >
          Successfully saved your keywords!
        </p>
      )}

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
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setSubmitSuccess(false)}
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

            <h3 style={{ textAlign: 'center', marginTop: 0, marginBottom: '4px' }}>
              How everyone answered {roundResults?.emoji ?? currentEmoji}
            </h3>

            {isLoadingResults ? (
              <p style={{ textAlign: 'center' }}>Loading results...</p>
            ) : roundResults ? (
              <>
                <p
                  style={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    color: '#2e7d32',
                    margin: '8px 0 16px',
                  }}
                >
                  +{roundResults.round_scores[getUserId()] ?? 0} points
                  {roundResults.total_scores[getUserId()] !== undefined && (
                    <span style={{ fontWeight: 500, color: '#555', display: 'block', fontSize: '0.85rem' }}>
                      total: {roundResults.total_scores[getUserId()]}
                    </span>
                  )}
                </p>

                {Object.entries(roundResults.results).map(([userId, words]) => {
                  const sortedWords = Object.entries(words).sort(([, a], [, b]) => b - a);
                  const maxCount = Math.max(...sortedWords.map(([, c]) => c), 1);

                  return (
                    <div key={userId} style={{ marginBottom: '20px' }}>
                      <strong>
                        {userId === getUserId() ? 'You' : `Player ${userId.slice(0, 6)}`}
                      </strong>
                      <ul style={{ listStyle: 'none', padding: 0, marginTop: '8px' }}>
                        {sortedWords.map(([word, count], index) => (
                          <li
                            key={word}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '6px',
                            }}
                          >
                            <div
                              style={{
                                position: 'relative',
                                background: '#eee',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                height: '28px',
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: `${(count / maxCount) * 100}%`,
                                  background: '#4CAF50',
                                  transition: 'width 0.4s ease',
                                  transitionDelay: `${index * 80}ms`,
                                }}
                              />
                              <span
                                style={{
                                  position: 'relative',
                                  padding: '0 10px',
                                  lineHeight: '28px',
                                  fontWeight: 500,
                                }}
                              >
                                {word}
                              </span>
                            </div>
                            <span
                              style={{
                                fontWeight: 'bold',
                                minWidth: '24px',
                                textAlign: 'right',
                              }}
                            >
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </>
            ) : (
              <p style={{ textAlign: 'center' }}>No results yet.</p>
            )}

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

      {!showEmoji ? (
        <section className="qmoji-stage" aria-live="polite">
          <button
            type="button"
            className="reveal-button"
            onClick={handleRevealEmoji}
            disabled={isLoading}
          >
            {isLoading ? 'Loading emoji...' : 'Show me an emoji!'}
          </button>
        </section>
      ) : (
        <div className="workspace-container">
          <section
            className="qmoji-stage"
            aria-live="polite"
            style={{ flexDirection: 'column', gap: '24px' }}
          >
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: timeLeft <= 5 ? '#b42318' : 'var(--text-h)',
                textAlign: 'center',
              }}
            >
              {timeLeft > 0 ? `Time remaining: ${timeLeft}s` : "Time's up!"}
            </div>
            <div className="emoji-display" aria-label="Random emoji">
              <span className="emoji" role="img">
                {currentEmoji}
              </span>
            </div>
          </section>

          <section className="keyword-panel" aria-labelledby="keyword-prompt">
            <h2
              id="keyword-prompt"
              style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}
            >
              What words come to mind for{' '}
              <span className="emoji-inline" aria-hidden="true" style={{ fontSize: '1.2em' }}>
                {currentEmoji}
              </span>
              ?
            </h2>

            <form className="keyword-form" onSubmit={handleSubmit}>
              <div className="keyword-grid">
                {keywords.map((keyword, index) => (
                  <label key={index} className="keyword-field">
                    Keyword {index + 1}
                    <input
                      type="text"
                      value={keyword}
                      placeholder={`Keyword ${index + 1}${inputLanguage.trim() ? ` (${inputLanguage.trim()})` : ''}`}
                      onChange={(event) => handleKeywordChange(index, event.target.value)}
                      autoComplete="off"
                      disabled={isSubmitting || submitSuccess || timeLeft === 0}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
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
                    {isSubmitting ? 'Saving...' : 'Submit Keywords'}
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleTryAnother}
                  style={{ flex: 1, margin: 0, width: submitSuccess ? '100%' : 'auto' }}
                >
                  Try another emoji
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default SingleplayerGame;