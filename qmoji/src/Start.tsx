import { useNavigate } from 'react-router-dom';

type StartValues = {
  inputLanguage: string;
  setInputLanguage: (value: string) => void;
  maxRounds: number;
  setMaxRounds: (value: number) => void;
  onReveal: () => void;
  isLoading: boolean;
};

// Available round-count choices.
const ROUND_OPTIONS = [5, 10, 16];

function Start({
  inputLanguage,
  setInputLanguage,
  maxRounds,
  setMaxRounds,
  onReveal,
  isLoading,
}: StartValues) {
  const navigate = useNavigate();

  // Choose which game mode to open.
  const handleModeSelect = (
    mode: 'single' | 'multi',
  ) => {
    if (mode === 'single') {
      onReveal();
    } else if (mode === 'multi') {
      // Pass the selected language to multiplayer.
      navigate('/multiplayer', {
        state: { language: inputLanguage },
      });
    } else {
      throw new Error(
        'Neither singleplayer nor multiplayer selected.',
      );
    }
  };

  return (
    <>
      {/* Keyword language setting. */}
      <div className="qmoji-field">
        <label htmlFor="language-input">
          Language for your keywords?
        </label>

        <input
          id="language-input"
          className="qmoji-input"
          value={inputLanguage}
          onChange={(e) =>
            setInputLanguage(e.target.value)
          }
        />
      </div>

      {/* Number of rounds setting. */}
      <div className="qmoji-field">
        <label htmlFor="rounds-select">
          Rounds to play?
        </label>

        <select
          id="rounds-select"
          className="qmoji-select"
          value={maxRounds}
          onChange={(e) =>
            setMaxRounds(Number(e.target.value))
          }
          disabled={isLoading}
        >
          {ROUND_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} rounds
            </option>
          ))}
        </select>
      </div>

      {/* Game-mode selection. */}
      <div className="qmoji-mode-grid">

        <button
          className="qmoji-mode-card multi"
          onClick={() =>
            handleModeSelect('multi')
          }
        >
          <h4>Multiplayer</h4>
          <p>Match guesses with friends</p>
        </button>
      </div>
    </>
  );
}

export default Start;
