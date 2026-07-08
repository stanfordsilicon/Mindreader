import { useState } from 'react';
import { fetchRandomEmoji } from './api';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [showEmoji, setShowEmoji] = useState(false); // Whether the emoji is being displayed (starts as false, then becomes true when the emoji is revealed)
  const [currentEmoji, setCurrentEmoji] = useState(''); // The current emoji that is being displayed (starts as an empty string, then becomes the revealed emoji)
  const [keywords, setKeywords] = useState(['', '', '', '']); // The keywords that the user has entered (starts as a list of empty strings, then gets updated with the user's keywords)
  const [isLoading, setIsLoading] = useState(false); // Whether the emoji is being loaded (starts as false, then becomes true when the emoji is being loaded)
  const [isSubmitting, setIsSubmitting] = useState(false); // Whether the data is being saved to the database
  const [submitSuccess, setSubmitSuccess] = useState(false); // Whether the data was successfully saved
  const [error, setError] = useState(''); // Will display an error message if the emoji can't be loaded or saved

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
      const emoji = await fetchRandomEmoji(); // Fetches a random emoji from the server
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
    
    // Basic validation to ensure all keywords are filled
    if (keywords.some(kw => kw.trim() === '')) {
      setError('Please fill out all four keywords before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Call the Supabase RPC function to increment the counts for each keyword
      const { error: supabaseError } = await supabase
        .rpc('increment_keyword_counts', {
          p_emoji: currentEmoji,
          p_keywords: keywords
        });

      if (supabaseError) throw supabaseError;

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
            {isLoading ? 'Loading emoji...' : 'Show me an emoji!'}
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

      {submitSuccess && (
        <p className="qmoji-success" role="alert" style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}>
          Successfully saved your keywords!
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

          <form className="keyword-form" onSubmit={handleSubmit}>
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
                    disabled={isSubmitting || submitSuccess}
                  />
                </label>
              ))}
            </div>
            {!submitSuccess && (
              <button 
                type="submit" 
                className="submit-button" 
                disabled={isSubmitting}
                style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {isSubmitting ? 'Saving...' : 'Submit Keywords'}
              </button>
            )}
          </form>

          <button
            type="button"
            className="secondary-button"
            onClick={handleTryAnother}
            style={{ marginTop: '1rem' }}
          >
            Try another emoji
          </button>
        </section>
      )}
    </main>
  );
}

export default App;
