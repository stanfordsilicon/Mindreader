/*
 * QMoji Arcade client (TypeScript port for the Vite/React apps).
 *
 * Talks only to the arcade API's three things: room code, roster, language —
 * never gameplay data, which stays in each game's own Mongo cluster
 * untouched. Locally, requests go through this app's own dev server at
 * /arcade-api/v1/* (proxied server-side via vite.config.ts) because the
 * real API's CORS allowlist covers *.vercel.app and specific onrender.com
 * origins, not localhost. In production, requests go straight to the API.
 */

export interface ArcadePlayer {
  playerId: string;
  name: string;
  joinedAt: string;
}

export interface ArcadeRoom {
  code: string;
  language: string;
  playerId?: string;
  players: ArcadePlayer[];
  createdAt?: string;
}

import { normalizeLang } from "./i18n";

export interface ArcadeParams {
  room: string | null;
  lang: string | null;
  player: string | null;
  uiLang: string | null;
}

export interface ArcadeInit {
  room: ArcadeRoom;
  roomCode: string;
  lang: string;
  playerId: string | null;
  uiLang: string | null;
}

export class ArcadeError extends Error {
  code: "not_found" | "conflict" | "unknown";
  constructor(code: "not_found" | "conflict" | "unknown", message: string) {
    super(message);
    this.name = "ArcadeError";
    this.code = code;
  }
}

const PROD_API = "https://qmoji-arcade-api.vercel.app/api/v1";
const PROD_HOMESCREEN = "https://qmoji-2.vercel.app";
const LOCAL_HOMESCREEN = "http://localhost:5500";

export function isLocal(): boolean {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

const API_BASE = isLocal() ? "/arcade-api/v1" : PROD_API;

export function homescreenUrl(): string {
  return isLocal() ? LOCAL_HOMESCREEN : PROD_HOMESCREEN;
}

// ---------------------------------------------------------------
// Local player identity — a stable UUID cached in localStorage so
// reloads and repeat visits reuse the same party member instead of
// cloning them (the API already dedupes join calls on playerId).
// ---------------------------------------------------------------
const ID_KEY = "qmoji.arcade.playerId";
const NAME_KEY = "qmoji.arcade.playerName";

// ---------------------------------------------------------------
// Bridge keys: each individual game (e.g. the Mindreader Room
// component) reads/writes its own identity under these keys via
// plain localStorage.getItem('qmoji_user_id') calls, completely
// unaware of the arcade layer's own ID_KEY/NAME_KEY above. If the
// arcade hands a player a `playerId` on launch but never writes it
// under the game's own keys, the game's join effect mints a brand
// new identity — same display name, different user_id — which is
// how the same person ends up as two separate roster entries.
// Every place that resolves/saves an arcade identity below also
// mirrors it into these keys so the two layers can never diverge.
// ---------------------------------------------------------------
const GAME_ID_KEY = "qmoji_user_id";
const GAME_NAME_KEY = "qmoji_username";

export function getSavedPlayerId(): string | null {
  try { return localStorage.getItem(ID_KEY); } catch { return null; }
}
export function savePlayerId(id: string | null | undefined): void {
  if (!id) return;
  try {
    localStorage.setItem(ID_KEY, id);
    // Mirror into the game's own key so Room.tsx's join effect
    // (which only ever reads GAME_ID_KEY) picks up the same identity
    // instead of generating a second one.
    localStorage.setItem(GAME_ID_KEY, id);
  } catch { /* storage unavailable */ }
}
export function getSavedPlayerName(): string {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
export function savePlayerName(name: string | null | undefined): void {
  if (!name) return;
  try {
    localStorage.setItem(NAME_KEY, name);
    // Mirror into the game's own key for the same reason as savePlayerId.
    localStorage.setItem(GAME_NAME_KEY, name);
  } catch { /* storage unavailable */ }
}
export function ensurePlayerId(): string {
  let id = getSavedPlayerId();
  if (!id) {
    id = crypto.randomUUID();
    savePlayerId(id);
  }
  return id;
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(API_BASE + path, options);
}

export async function createRoom(hostName: string, language?: string): Promise<ArcadeRoom> {
  const res = await apiFetch("/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName, language: language || "en" }),
  });
  if (!res.ok) throw new ArcadeError("unknown", "Could not create room");
  const room: ArcadeRoom = await res.json();
  savePlayerId(room.playerId);
  savePlayerName(hostName);
  return room;
}

export async function joinRoom(code: string, name: string, playerId?: string): Promise<ArcadeRoom> {
  const existingId = playerId || getSavedPlayerId();
  const body: Record<string, string> = { name };
  if (existingId) body.playerId = existingId;
  const res = await apiFetch(`/rooms/${encodeURIComponent(code.toUpperCase())}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 404) throw new ArcadeError("not_found", "No room with that code");
  if (res.status === 409) throw new ArcadeError("conflict", "Room is full, or that name is taken");
  if (!res.ok) throw new ArcadeError("unknown", "Could not join room");
  const room: ArcadeRoom = await res.json();
  savePlayerId(room.playerId);
  savePlayerName(name);
  return room;
}

export async function getRoom(code: string | null | undefined): Promise<ArcadeRoom | null> {
  if (!code) return null;
  const res = await apiFetch(`/rooms/${encodeURIComponent(code.toUpperCase())}`);
  if (!res.ok) return null;
  return res.json();
}

export async function setLanguage(code: string, language: string): Promise<Pick<ArcadeRoom, "code" | "language">> {
  const res = await apiFetch(`/rooms/${encodeURIComponent(code.toUpperCase())}/language`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) throw new ArcadeError("unknown", "Could not set language");
  return res.json();
}

// Lobby-only polling. Games fetch the room once on load and never poll,
// per the contract's explicit "don't poll from inside a game."
export function createPoller(code: string, onUpdate: (room: ArcadeRoom) => void, intervalMs = 3000) {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start(): void {
      if (timer) return;
      timer = setInterval(async () => {
        const fresh = await getRoom(code);
        if (fresh) onUpdate(fresh);
      }, intervalMs);
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export function readParams(): ArcadeParams {
  const params = new URLSearchParams(location.search);
  // uiLang was missing here. This file is a TypeScript port of the vanilla
  // arcade-client.js taken BEFORE uiLang existed, so the homescreen has been
  // sending the interface-language choice all along and this game dropped it
  // on the floor -- it never reached localStorage either, so it did not
  // survive to a later visit. `lang` (the gameplay/keyword language) and
  // `uiLang` (the interface language) are separate axes and must never merge.
  return {
    room: params.get("room"),
    lang: params.get("lang"),
    player: params.get("player"),
    uiLang: params.get("uiLang"),
  };
}

// Called once on load by every game. Returns null (never throws) when
// there's no room param or the lookup fails — the caller's existing
// standalone start screen is always the fallback, per the contract:
// "the arcade layer is an enhancement, not a dependency."
//
// IMPORTANT: this must be awaited BEFORE the game's own room/lobby
// component mounts. It resolves the canonical arcade identity for this
// player and mirrors it into the game's own localStorage keys
// (qmoji_user_id / qmoji_username) via savePlayerId/savePlayerName, so
// the game's own join logic reuses that identity instead of minting a
// second one under a different key. Skipping this call, or calling it
// after the game has already read its own keys, reintroduces the
// duplicate-join bug.
export async function initArcade(): Promise<ArcadeInit | null> {
  const params = readParams();
  if (!params.room) return null;
  const room = await getRoom(params.room);
  if (!room) return null;

  // Resolve one canonical id: prefer the id the arcade just handed us
  // in the URL, fall back to whatever we already had saved locally.
  const resolvedPlayerId = params.player || getSavedPlayerId();

  // savePlayerId/savePlayerName write to BOTH the arcade's own keys and
  // the game's keys (qmoji_user_id / qmoji_username), so this is the
  // single point where the two identity systems get reconciled.
  if (resolvedPlayerId) {
    savePlayerId(resolvedPlayerId);
  }

  const matched = room.players.find((p) => p.playerId === resolvedPlayerId);
  const resolvedName = matched?.name || getSavedPlayerName();
  if (resolvedName) {
    savePlayerName(resolvedName);
  }

  if (params.lang) {
    // Plumbing only for now: receive/store the ISO code so it round-trips
    // correctly. On-screen translation wiring lands in a later pass.
    try { localStorage.setItem("qmoji.lang", params.lang); } catch { /* storage unavailable */ }
    document.documentElement.lang = params.lang;
  }

  let normalizedUiLang: string | null = null;
  if (params.uiLang) {
    // Normalized before storing, never stored raw -- matching
    // arcade-client.js. A hand-typed "?uiLang=PT-BR" would otherwise poison
    // localStorage with a value every later lookup misses, and uiLang builds
    // a locale FILENAME, which is case-sensitive on Vercel but not on macOS.
    normalizedUiLang = normalizeLang(params.uiLang);
    try { localStorage.setItem("qmoji.uiLang", normalizedUiLang); } catch { /* storage unavailable */ }
  }

  return {
    room,
    roomCode: params.room,
    lang: params.lang || room.language,
    playerId: resolvedPlayerId ?? null,
    uiLang: normalizedUiLang,
  };
}

export function launchUrl(baseUrl: string, roomCode?: string, lang?: string, playerId?: string | null): string {
  const url = new URL(baseUrl);
  if (roomCode) url.searchParams.set("room", roomCode);
  if (lang) url.searchParams.set("lang", lang);
  if (playerId) url.searchParams.set("player", playerId);
  return url.toString();
}

export function backToHomescreenUrl(roomCode?: string, lang?: string, playerId?: string | null): string {
  return launchUrl(homescreenUrl(), roomCode, lang, playerId);
}