import { useNavigate } from 'react-router-dom'

type StartValues = {
  inputLanguage: string;
  setInputLanguage: (value: string) => void;
  onReveal: () => void;
  isLoading: boolean;
};

function Start({ inputLanguage, setInputLanguage, onReveal, isLoading }: StartValues) {
  const navigate = useNavigate();
  const handleModeSelect = (mode: 'single' | 'multi') => {
    if (mode === 'single') {
      onReveal();
    } else if (mode === 'multi') {
      navigate('/multiplayer');
    } else {
        throw new Error('Neither singleplayer nor multiplayer selected.');
    }
  };

  return (
    <>
      <div className="language-selector">
        <label htmlFor="language-input">Language for your keywords?</label>
        <input
          id="language-input"
          value={inputLanguage}
          onChange={(e) => setInputLanguage(e.target.value)}
        />
      </div>

      <section className="qmoji-stage">
        <button onClick={() => handleModeSelect('single')} disabled={isLoading}>
          {isLoading ? 'Loading emoji...' : 'Singleplayer'}
        </button>
        <button onClick={() => handleModeSelect('multi')}>
          Multiplayer
        </button>
      </section>
    </>
  );
}

export default Start;