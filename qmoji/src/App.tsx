import { useState } from 'react';
import { fetchRandomEmoji } from './api';
import './App.css';

function App() {
  const [showEmoji, setShowEmoji] = useState(false);
  const [currentEmoji, setCurrentEmoji] = useState('');
  const [keywords, setKeywords] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRevealEmoji = async () => {
    setIsLoading(true);
    setError('');

    try {
      const emoji = await fetchRandomEmoji();
      setCurrentEmoji(emoji);
      setKeywords(['', '', '', '']);
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

  const handleTryAnother = () => {
    setShowEmoji(false);
    setCurrentEmoji('');
    setKeywords(['', '', '', '']);
    setError('');
  };

  return (
    <main className="qmoji-app">
      <header className="qmoji-header">
        <h1>Qmoji</h1>
        <p>
          Click the button to reveal an emoji, then describe it with four
          keywords.
        </p>
      </header>

      <section className="qmoji-stage" aria-live="polite">
        {!showEmoji ? (
          <button
            type="button"
            className="reveal-button"
            onClick={handleRevealEmoji}
            disabled={isLoading}
          >
            {isLoading ? 'Loading emoji...' : 'Show me an emoji'}
          </button>
        ) : (
          <div className="emoji-display" aria-label="Random emoji">
            <span className="emoji" role="img">
              {currentEmoji}
            </span>
          </div>
        )}
      </section>

      {error && (
        <p className="qmoji-error" role="alert">
          {error}
        </p>
      )}

      {showEmoji && (
        <section className="keyword-panel" aria-labelledby="keyword-prompt">
          <h2 id="keyword-prompt">Describe this emoji</h2>
          <p className="keyword-prompt">
            What four words come to mind for{' '}
            <span className="emoji-inline" aria-hidden="true">
              {currentEmoji}
            </span>
            ?
          </p>

          <form className="keyword-form" onSubmit={(event) => event.preventDefault()}>
            <div className="keyword-grid">
              {keywords.map((keyword, index) => (
                <label key={index} className="keyword-field">
                  Keyword {index + 1}
                  <input
                    type="text"
                    value={keyword}
                    placeholder={`Keyword ${index + 1}`}
                    onChange={(event) =>
                      handleKeywordChange(index, event.target.value)
                    }
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
          </form>

          <button
            type="button"
            className="secondary-button"
            onClick={handleTryAnother}
          >
            Try another emoji
          </button>
        </section>
      )}
    </main>
  );
}

export default App;
