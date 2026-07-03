import { useState, useCallback } from "react";
import { Minus, Plus, Loader2, ArrowRight } from "lucide-react";

// --- Config -----------------------------------------------------------

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 8;

// Backend endpoint that receives the session config.
// Adjust to match your Python server (e.g. FastAPI/Flask route).
const START_ENDPOINT = "/api/start";

const LANGUAGE_SUGGESTIONS = [
  "English",
  "Español",
  "Français",
  "Deutsch",
  "Português",
  "Italiano",
  "日本語",
  "한국어",
];

// --- Types --------------------------------------------------------------

interface StartMenuProps {
  /** Called after the backend confirms the session was created. */
  onStart?: (session: StartSessionResponse) => void;
}

interface StartSessionRequest {
  players: number;
  language: string;
}

interface StartSessionResponse {
  session_id: string;
  players: number;
  language: string;
}

// --- Component ------------------------------------------------------------

export default function StartMenu({ onStart }: StartMenuProps) {
  const [players, setPlayers] = useState(2);
  const [language, setLanguage] = useState("English");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decrement = () => setPlayers((p) => Math.max(MIN_PLAYERS, p - 1));
  const increment = () => setPlayers((p) => Math.min(MAX_PLAYERS, p + 1));

  const handleStart = useCallback(async () => {
    const trimmedLanguage = language.trim();
    if (!trimmedLanguage) {
      setError("Enter a language before starting.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const payload: StartSessionRequest = {
      players,
      language: trimmedLanguage,
    };

    try {
      const res = await fetch(START_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data: StartSessionResponse = await res.json();
      onStart?.(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the server. Try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [players, language, onStart]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-neutral-50 tracking-tight">
          New Session
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Set up players and language to begin.
        </p>

        {/* Player count */}
        <div className="mt-8">
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Players
          </label>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
            <button
              type="button"
              onClick={decrement}
              disabled={players <= MIN_PLAYERS}
              aria-label="Decrease player count"
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Minus size={16} />
            </button>

            <span className="min-w-[3ch] text-center text-lg font-medium tabular-nums text-neutral-50">
              {players}
            </span>

            <button
              type="button"
              onClick={increment}
              disabled={players >= MAX_PLAYERS}
              aria-label="Increase player count"
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="mt-5">
          <label htmlFor="language" className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Language
          </label>
          <input
            id="language"
            list="language-suggestions"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. English"
            className="mt-2 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-50 placeholder-neutral-600 outline-none transition focus:border-neutral-500"
          />
          <datalist id="language-suggestions">
            {LANGUAGE_SUGGESTIONS.map((lang) => (
              <option key={lang} value={lang} />
            ))}
          </datalist>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={isLoading}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-50 px-4 py-2.5 font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Starting…
            </>
          ) : (
            <>
              Start
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}