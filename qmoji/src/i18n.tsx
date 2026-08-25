// i18n runtime for Mindreader.
//
// Same contract as the vanilla games (Moji Mojo, Emoji Munchers), different
// mechanism. Those scan the DOM for [data-i18n] after load; that fights
// React's rendering model, so here the string table lives in a context and
// components read it through the useT() hook. What is deliberately IDENTICAL
// across every game in the suite:
//
//   - locale files at public/locales/<lang>.json, snake_case keys
//   - per-key fallback to English (a key missing from fr.json renders the
//     English string, never the raw key)
//   - <lang>.overrides.json for human corrections, merged by
//     scripts/translate.mjs, never written to by it
//   - normalizeLang(), including the bare "pt" -> "pt-br" alias
//   - nothing renders until the table has loaded
//
// LANGUAGE CODES are lowercase-with-hyphens everywhere -- filenames, URL
// params, localStorage values, comparisons. A code becomes a filename, and
// while macOS is case-insensitive the Vercel build environment is not: a
// file named pt-BR.json works locally and 404s in production.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Strings = Record<string, string>;

// Interface languages are lowercase-hyphen. Two normalizations matter:
// underscores to hyphens (pt_BR -> pt-br), and the bare "pt" alias -- the
// QMoji 2.0 homescreen's picker only offers generic "pt", but the only
// Portuguese locale files that exist are pt-br and pt-pt, so bare "pt"
// resolves to Brazilian Portuguese rather than 404ing back to English.
// There is deliberately no pt.json.
//
// Kept byte-for-byte equivalent to normalizeLang() in the vanilla games'
// public/i18n.js and public/arcade-client.js. If this changes, change those.
export function normalizeLang(code: string | null | undefined): string {
  if (!code) return '';
  const lang = String(code).trim().toLowerCase().replace(/_/g, '-');
  if (lang === 'pt') return 'pt-br';
  return lang;
}

// Preferred interface language, by precedence: ?uiLang -> localStorage
// -> "en". This is what the player asked for, normalized -- not necessarily
// what exists. Availability is decided by whether locales/<lang>.json
// actually loads, not by checking a baked-in list, so adding a language is
// just adding a file.
//
// Read straight from the URL rather than waiting on arcade.ts's async
// initArcade(), so the first paint already uses the language this game was
// launched with instead of catching up on a later visit.
export function resolveI18nLang(): string {
  try {
    const fromUrl = normalizeLang(new URLSearchParams(location.search).get('uiLang'));
    if (fromUrl) return fromUrl;
    const fromStorage = normalizeLang(localStorage.getItem('qmoji.uiLang'));
    if (fromStorage) return fromStorage;
  } catch {
    /* localStorage/URL access can throw in some embedded contexts */
  }
  return 'en';
}

async function loadLocale(lang: string): Promise<Strings> {
  const res = await fetch(`locales/${encodeURIComponent(lang)}.json`);
  if (!res.ok) throw new Error(`locale ${lang} -> HTTP ${res.status}`);
  return (await res.json()) as Strings;
}

interface I18nValue {
  lang: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function makeT(active: Strings, en: Strings) {
  return (key: string, vars?: Record<string, string | number>) => {
    // Per-key fallback: a key the active language is missing renders the
    // English string, never the raw key.
    let text = active[key] ?? en[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) text = text.split(`{${k}}`).join(String(vars[k]));
    }
    return text;
  };
}

// Loads English (always, as the per-key fallback) plus the resolved
// language, and renders nothing until both have settled. Rendering earlier
// would paint raw snake_case keys for a frame -- the React equivalent of
// the other games hiding <body> behind a class until their table arrives.
// A "loading" word is not an option: it would itself need translating
// before translations exist.
//
// Never throws. A missing or malformed locale degrades to English; a
// missing English file degrades to raw keys -- still a usable, if ugly,
// UI rather than a permanently blank page.
export function I18nProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<I18nValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let en: Strings = {};
      try {
        en = await loadLocale('en');
      } catch (e) {
        console.error('i18n: could not load English strings --', (e as Error).message);
      }
      const want = resolveI18nLang();
      let active = en;
      let lang = 'en';
      if (want !== 'en') {
        try {
          active = await loadLocale(want);
          lang = want;
        } catch (e) {
          // Not an error -- asking for a language nobody has translated yet
          // is a normal thing for a URL to do. English is the answer.
          console.info('i18n: falling back to English --', (e as Error).message);
        }
      }
      if (!cancelled) setValue({ lang, t: makeT(active, en) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Throws if used outside the provider -- that would silently render raw
// keys, which is exactly the failure this runtime exists to prevent.
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useT() {
  return useI18n().t;
}
