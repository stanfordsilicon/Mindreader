import { useState, useEffect } from 'react';
import Start from './Start';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'https://exquisite-courage-production.up.railway.app/').replace(/\/$/, '');

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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save keywords.');
      }

      setSubmitSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save to database.';
      setError(`Database Error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTryAnother = () => {
    setShowEmoji(false);
    setCurrentEmoji('');
    setKeywords(['', '', '', '']);
    setTimeLeft(30);
    setError('');
    setSubmitSuccess(false);
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
        <h1>Welcome to Qmoji! !Testing!!!!</h1>
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