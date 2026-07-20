type startValues = {
  inputLanguage: string;
  setInputLanguage: (value: string) => void;
  onReveal: () => void;
  isLoading: boolean;
};

function start({ inputLanguage, setInputLanguage, onReveal, isLoading }: startValues) {
  const handleModeSelect = (mode: 'single' | 'multi') => {
    if (mode === 'single') {
      onReveal();
    } else {
      // The multiplayer routing
      // navigate('multiplayer')
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

export default start;