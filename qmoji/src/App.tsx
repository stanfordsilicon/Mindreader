import { useState, useEffect } from 'react';
import { fetchRandomEmoji } from './api';
import { supabase } from './supabaseClient';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

function App() {
  const [showEmoji, setShowEmoji] = useState(false); // Whether the emoji is being displayed (starts as false, then becomes true when the emoji is revealed)
  const [currentEmoji, setCurrentEmoji] = useState(''); // The current emoji that is being displayed (starts as an empty string, then becomes the revealed emoji)
  const [keywords, setKeywords] = useState(['', '', '', '']); // The keywords that the user has entered (starts as a list of empty strings, then gets updated with the user's keywords)
  const [inputLanguage, setInputLanguage] = useState('English'); // The language the user will be inputting keywords in
  const [isLoading, setIsLoading] = useState(false); // Whether the emoji is being loaded (starts as false, then becomes true when the emoji is being loaded)
  const [isSubmitting, setIsSubmitting] = useState(false); // Whether the data is being saved to the database
  const [submitSuccess, setSubmitSuccess] = useState(false); // Whether the data was successfully saved
  const [error, setError] = useState(''); // Will display an error message if the emoji can't be loaded or saved
  const [timeLeft, setTimeLeft] = useState(30); // Timer that limits how long users have to enter keywords

  /* The useEffect hook handles the countdown timer functionality.
  When the emoji is displayed and the time left is greater than 0, it decreases the time by 1 every second.
  It stops counting down if the user successfully submits their keywords.
  */
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

  /* The "handleRevealEmoji" function handles the functionality of the "Show me an emoji!" button. When clicked,
  it will set the loading state to true, clear any error messages, and then try to fetch a random emoji.
  If the emoji loads successfully, then the user will be able to see the emoji and enter keywords to describe it.
  If the emoji fails to load, then an error message will be displayed.
  */
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

      const emoji = await fetchRandomEmoji();
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

  /* The "handleKeywordChange" function handles the functionality of the keyword input fields. 
  When the user types in a keyword, it will update the "keywords" state with the new keyword.
  The "index" parameter is the index of the keyword that is being updated, 
  and the "value" parameter is the new value of the keyword. The function creates a new list with the updated keyword,
  and then updates the "keywords" state with the new list.
  */
  const handleKeywordChange = (index: number, value: string) => {
    setKeywords((prev) => {
      const next = [...prev]; // Creates a new list with the updated keyword
      next[index] = value; // Updates the keyword at the specified index with the new value
      return next; 
    });
  };

  /* The "handleSubmit" function saves the emoji and keywords to the Supabase database. */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const filledKeywords = keywords.filter(kw => kw.trim() !== '');
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
        body: JSON.stringify({ keywords: filledKeywords }),
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

  /* The "handleTryAnother" function handles the functionality of the "Try another emoji" button.
  When the button is clicked, it will reset the "showEmoji", "currentEmoji", "keywords", and "error" states to their initial values.
  This will allow the user to reveal a new emoji and enter new keywords.
  */
  const handleTryAnother = () => {
    setShowEmoji(false);
    setCurrentEmoji('');
    setKeywords(['', '', '', '']);
    setTimeLeft(30);
    setError('');
    setSubmitSuccess(false);
  };

  /* The "return" statement returns the rendered UI of the game. 
  It includes the header, the stage, the error message, and the keyword panel.
  The header includes the title and the brief description of the game.
  The stage includes the button to reveal an emoji and the emoji that is being displayed.
  The error message is displayed if there is an error with the emoji (e.g. the emoji can't be loaded).
  The keyword panel includes the prompt to describe the emoji, the input fields for the keywords, and the button to describe another emoji.
  */
  return (
    <main className="qmoji-app">
      <header className="qmoji-header">
        <h1>Welcome to Qmoji!</h1>
        <p>
          Describe the emoji with up to four keywords in 30 seconds! 
          New game modes coming soon.
        </p>
        {!showEmoji && (
          <div className="language-selector" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="language-input" style={{ fontSize: '0.95rem', color: 'var(--text-h)' }}>
              What language will you be using for your keywords?
            </label>
            <input
              id="language-input"
              type="text"
              value={inputLanguage}
              onChange={(e) => setInputLanguage(e.target.value)}
              placeholder="e.g. English, Spanish, etc."
              style={{ 
                padding: '10px 14px', 
                borderRadius: '10px', 
                border: '1px solid var(--border)', 
                background: 'var(--bg)', 
                color: 'var(--text-h)', 
                font: 'inherit',
                textAlign: 'center',
                minWidth: '240px'
              }}
            />
          </div>
        )}
      </header>

      {error && (
        <p className="qmoji-error" role="alert">
          {error}
        </p>
      )}

      {submitSuccess && (
        <p className="qmoji-success" role="alert" style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}>
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
          <section className="qmoji-stage" aria-live="polite" style={{ flexDirection: 'column', gap: '24px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timeLeft <= 5 ? '#b42318' : 'var(--text-h)', textAlign: 'center' }}>
              {timeLeft > 0 ? `Time remaining: ${timeLeft}s` : "Time's up!"}
            </div>
            <div className="emoji-display" aria-label="Random emoji">
              <span className="emoji" role="img">
                {currentEmoji}
              </span>
            </div>
          </section>

          <section className="keyword-panel" aria-labelledby="keyword-prompt">
            <h2 id="keyword-prompt" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
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
                      onChange={(event) =>
                        handleKeywordChange(index, event.target.value)
                      }
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
                    style={{ flex: 1, padding: '12px 24px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '999px', cursor: 'pointer', font: 'inherit', fontWeight: 500 }}
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

export default App;
