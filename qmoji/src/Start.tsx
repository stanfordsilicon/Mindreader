import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useT } from './i18n';
import { readParams } from './arcade'; // adjust path to your arcade client file

type StartValues = {
  inputLanguage: string;
  setInputLanguage: (value: string) => void;
  maxRounds: number;
  setMaxRounds: (value: number) => void;
  onReveal: () => void;
  isLoading: boolean;
};

const ROUND_OPTIONS = [5, 10, 16];

function Start({
  inputLanguage,
  setInputLanguage,
  maxRounds,
  setMaxRounds,
  onReveal,
  isLoading,
}: StartValues) {
  const t = useT();
  const navigate = useNavigate();

  // Arcade redirect: if launched with ?room=..., go straight to multiplayer lobby
  useEffect(() => {
    const params = readParams();
    if (params.room) {
      navigate(`/multiplayer${window.location.search}`);
    }
  }, [navigate]);

  const handleModeSelect = (mode: 'single' | 'multi') => {
    if (mode === 'single') {
      onReveal();
    } else if (mode === 'multi') {
      navigate('/multiplayer', {
        state: { language: inputLanguage },
      });
    } else {
      throw new Error('Neither singleplayer nor multiplayer selected.');
    }
  };

  return (
    <>
      <div className="qmoji-field">
        <label htmlFor="language-input">{t('keyword_language_label')}</label>
        <input
          id="language-input"
          className="qmoji-input"
          value={inputLanguage}
          onChange={(e) => setInputLanguage(e.target.value)}
        />
      </div>

      <div className="qmoji-field">
        <label htmlFor="rounds-select">{t('rounds_to_play_label')}</label>
        <select
          id="rounds-select"
          className="qmoji-select"
          value={maxRounds}
          onChange={(e) => setMaxRounds(Number(e.target.value))}
          disabled={isLoading}
        >
          {ROUND_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} rounds
            </option>
          ))}
        </select>
      </div>

      <div className="qmoji-mode-grid">
        <button
          className="qmoji-mode-card multi"
          onClick={() => handleModeSelect('multi')}
        >
          <h4>{t('mode_multiplayer')}</h4>
          <p>{t('mode_multiplayer_desc')}</p>
        </button>
      </div>
    </>
  );
}

export default Start;