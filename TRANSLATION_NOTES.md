# Translation notes — Mindreader

Provenance for every hand-overridden string in `public/locales/*.overrides.json`.

**Nothing here has been checked by a native speaker.** Every row was written by
Claude from inspection of the DeepL output. The `Status` column records that and
must only become `human-verified` by someone who speaks the language.

Strings *not* listed are raw DeepL output — also unverified, but not known to be
wrong. Corrections belong in the `.overrides.json`, never the generated file.

Total overridden: **79** of 250 strings (50 keys x 5 languages).

## The systematic failure worth knowing about

`player_fallback_name` (`Player {id}`) was **wrong in all five languages** —
French turned it into `{id} des joueurs`, and the other four dropped the space
before the placeholder, rendering `Jugador4aa540`. Same missing-space failure
mode that hit `level_label` in OddMoji and `round_results_title` in Moji Mojo.
A short label ending in a placeholder is the shape that triggers it.

| Lang | Key | Why | Replacement | Status |
|---|---|---|---|---|
| `fr` | `player_fallback_name` | **Broken in all five.** French returned `{id} des joueurs` ("{id} of players"); the other four omitted the space, rendering `Jugador4aa540`. | `Joueur {id}` | claude-corrected, unverified |
| `fr` | `rounds_to_play_label` | Meaning shifted: all five rendered it as *how many rounds are LEFT*, a mid-game status. It is a pre-game setting. | `Combien de tours veux-tu jouer ?` | claude-corrected, unverified |
| `fr` | `keyword_language_label` | Rendered as *what language ARE your keywords in* rather than a choice being offered. | `Dans quelle langue tes mots-clés ?` | claude-corrected, unverified |
| `fr` | `leave_button` | `Saída` is the noun "exit"; this is a button, so it needs a verb. | `Quitter` | claude-corrected, unverified |
| `fr` | `join_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. Also formal and long for a button. | `Rejoindre` | claude-corrected, unverified |
| `fr` | `random_emoji_button` | Pluralised; the button picks one emoji. | `Emoji aléatoire` | claude-corrected, unverified |
| `fr` | `return_to_launch_pad_tooltip` | `rampe de lancement` disagreed with the rest of the suite, which uses `plate-forme de lancement`. | `Retour à la plate-forme de lancement` | claude-corrected, unverified |
| `fr` | `room_code_label` | `CODE DE CHAMBRE` is a *bedroom* code. The glossary pins room->salon but this string slipped past it. | `CODE DU SALON` | claude-corrected, unverified |
| `fr` | `back_to_arcade_button` | `Retour à la section « Arcade »` is three times the English; overflows. | `Retour à l'arcade` | claude-corrected, unverified |
| `fr` | `loading` | Matches the shorter form already adopted in the other games. | `CHARGEMENT` | claude-corrected, unverified |
| `fr` | `mode_multiplayer_desc` | Formal register; house style is informal (tu/tú/ты). | `Compare tes réponses avec tes amis` | claude-corrected, unverified |
| `fr` | `your_name_label` | Formal register; house style is informal (tu/tú/ты). | `Ton nom` | claude-corrected, unverified |
| `fr` | `choose_username_label` | Formal register; house style is informal (tu/tú/ты). | `Choisis un nom d'utilisateur` | claude-corrected, unverified |
| `fr` | `name_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Entre ton nom` | claude-corrected, unverified |
| `fr` | `username_placeholder` | Formal register; house style is informal (tu/tú/ты). | `entre ton nom d'utilisateur` | claude-corrected, unverified |
| `fr` | `error_enter_name` | Formal register; house style is informal (tu/tú/ты). | `Entre un nom.` | claude-corrected, unverified |
| `fr` | `error_username_before_room` | Formal register; house style is informal (tu/tú/ты). | `Entre un nom d'utilisateur avant de créer un salon.` | claude-corrected, unverified |
| `fr` | `error_enter_username` | Formal register; house style is informal (tu/tú/ты). | `Entre un nom d'utilisateur.` | claude-corrected, unverified |
| `fr` | `error_valid_room_id` | Formal register; house style is informal (tu/tú/ты). | `Entre un code de salon valide.` | claude-corrected, unverified |
| `fr` | `error_keyword_required` | Formal register; house style is informal (tu/tú/ты). | `Indique au moins un mot-clé avant de valider.` | claude-corrected, unverified |
| `fr` | `entering_button` | Russian `Ввод…` means data *input*, not entering a room. | `Entrée…` | claude-corrected, unverified |
| `es` | `player_fallback_name` | **Broken in all five.** French returned `{id} des joueurs` ("{id} of players"); the other four omitted the space, rendering `Jugador4aa540`. | `Jugador {id}` | claude-corrected, unverified |
| `es` | `rounds_to_play_label` | Meaning shifted: all five rendered it as *how many rounds are LEFT*, a mid-game status. It is a pre-game setting. | `¿Cuántas rondas quieres jugar?` | claude-corrected, unverified |
| `es` | `join_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. Also formal and long for a button. | `Entrar` | claude-corrected, unverified |
| `es` | `play_again_button` | `Volver a reproducir` is replaying a *video*. | `Volver a jugar` | claude-corrected, unverified |
| `es` | `error_enter_name` | Formal register; house style is informal (tu/tú/ты). | `Introduce un nombre.` | claude-corrected, unverified |
| `es` | `error_enter_username` | Formal register; house style is informal (tu/tú/ты). | `Introduce un nombre de usuario.` | claude-corrected, unverified |
| `es` | `error_keyword_required` | Formal register; house style is informal (tu/tú/ты). | `Introduce al menos una palabra clave antes de enviar.` | claude-corrected, unverified |
| `pt-br` | `player_fallback_name` | **Broken in all five.** French returned `{id} des joueurs` ("{id} of players"); the other four omitted the space, rendering `Jugador4aa540`. | `Jogador {id}` | claude-corrected, unverified |
| `pt-br` | `rounds_to_play_label` | Meaning shifted: all five rendered it as *how many rounds are LEFT*, a mid-game status. It is a pre-game setting. | `Quantas rodadas você quer jogar?` | claude-corrected, unverified |
| `pt-br` | `leave_button` | `Saída` is the noun "exit"; this is a button, so it needs a verb. | `Sair` | claude-corrected, unverified |
| `pt-br` | `join_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. Also formal and long for a button. | `Entrar` | claude-corrected, unverified |
| `pt-pt` | `player_fallback_name` | **Broken in all five.** French returned `{id} des joueurs` ("{id} of players"); the other four omitted the space, rendering `Jugador4aa540`. | `Jogador {id}` | claude-corrected, unverified |
| `pt-pt` | `rounds_to_play_label` | Meaning shifted: all five rendered it as *how many rounds are LEFT*, a mid-game status. It is a pre-game setting. | `Quantas rondas queres jogar?` | claude-corrected, unverified |
| `pt-pt` | `keyword_language_label` | Rendered as *what language ARE your keywords in* rather than a choice being offered. | `Em que idioma queres as palavras-chave?` | claude-corrected, unverified |
| `pt-pt` | `leave_button` | `Saída` is the noun "exit"; this is a button, so it needs a verb. | `Sair` | claude-corrected, unverified |
| `pt-pt` | `join_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. Also formal and long for a button. | `Entrar` | claude-corrected, unverified |
| `pt-pt` | `choose_username_label` | Formal register; house style is informal (tu/tú/ты). | `Escolhe um nome de utilizador` | claude-corrected, unverified |
| `pt-pt` | `name_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Introduz o teu nome` | claude-corrected, unverified |
| `pt-pt` | `username_placeholder` | Formal register; house style is informal (tu/tú/ты). | `introduz o teu nome de utilizador` | claude-corrected, unverified |
| `pt-pt` | `error_enter_name` | Formal register; house style is informal (tu/tú/ты). | `Introduz um nome.` | claude-corrected, unverified |
| `pt-pt` | `error_username_before_room` | Formal register; house style is informal (tu/tú/ты). | `Introduz um nome de utilizador antes de criar uma sala.` | claude-corrected, unverified |
| `pt-pt` | `error_enter_username` | Formal register; house style is informal (tu/tú/ты). | `Introduz um nome de utilizador.` | claude-corrected, unverified |
| `pt-pt` | `error_valid_room_id` | Formal register; house style is informal (tu/tú/ты). | `Introduz um ID de sala válido.` | claude-corrected, unverified |
| `pt-pt` | `error_keyword_required` | Formal register; house style is informal (tu/tú/ты). | `Preenche pelo menos uma palavra-chave antes de enviar.` | claude-corrected, unverified |
| `ru` | `player_fallback_name` | **Broken in all five.** French returned `{id} des joueurs` ("{id} of players"); the other four omitted the space, rendering `Jugador4aa540`. | `Игрок {id}` | claude-corrected, unverified |
| `ru` | `rounds_to_play_label` | Meaning shifted: all five rendered it as *how many rounds are LEFT*, a mid-game status. It is a pre-game setting. | `Сколько раундов сыграем?` | claude-corrected, unverified |
| `ru` | `keyword_language_label` | Rendered as *what language ARE your keywords in* rather than a choice being offered. | `На каком языке твои ключевые слова?` | claude-corrected, unverified |
| `ru` | `leave_button` | `Saída` is the noun "exit"; this is a button, so it needs a verb. | `Выйти` | claude-corrected, unverified |
| `ru` | `join_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. Also formal and long for a button. | `Войти` | claude-corrected, unverified |
| `ru` | `entering_button` | Russian `Ввод…` means data *input*, not entering a room. | `Вход…` | claude-corrected, unverified |
| `ru` | `loading_room` | Russian said *loading the page*, not the room. | `Загрузка комнаты...` | claude-corrected, unverified |
| `ru` | `random_emoji_button` | Pluralised; the button picks one emoji. | `Случайный смайлик` | claude-corrected, unverified |
| `ru` | `app_tagline` | Formal register; house style is informal (tu/tú/ты). | `Опиши смайлик, используя не более четырёх ключевых слов, за 30 секунд!` | claude-corrected, unverified |
| `ru` | `mode_multiplayer_desc` | Formal register; house style is informal (tu/tú/ты). | `Сравни свои ответы с ответами друзей` | claude-corrected, unverified |
| `ru` | `your_name_label` | Formal register; house style is informal (tu/tú/ты). | `Твоё имя` | claude-corrected, unverified |
| `ru` | `choose_username_label` | Formal register; house style is informal (tu/tú/ты). | `Выбери имя пользователя` | claude-corrected, unverified |
| `ru` | `name_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Введи своё имя` | claude-corrected, unverified |
| `ru` | `username_placeholder` | Formal register; house style is informal (tu/tú/ты). | `введи имя пользователя` | claude-corrected, unverified |
| `ru` | `error_enter_name` | Formal register; house style is informal (tu/tú/ты). | `Введи имя.` | claude-corrected, unverified |
| `ru` | `error_username_before_room` | Formal register; house style is informal (tu/tú/ты). | `Перед созданием комнаты введи имя пользователя.` | claude-corrected, unverified |
| `ru` | `error_enter_username` | Formal register; house style is informal (tu/tú/ты). | `Введи имя пользователя.` | claude-corrected, unverified |
| `ru` | `error_valid_room_id` | Formal register; house style is informal (tu/tú/ты). | `Введи действительный код комнаты.` | claude-corrected, unverified |
| `ru` | `error_keyword_required` | Formal register; house style is informal (tu/tú/ты). | `Перед отправкой введи хотя бы одно ключевое слово.` | claude-corrected, unverified |
| `ru` | `try_another_emoji_button` | Formal register; house style is informal (tu/tú/ты). | `Попробуй другой смайлик` | claude-corrected, unverified |

| `fr` | `rounds_option` | French used `séries` against the glossary's `tour`; Russian `{n} раунды` is the wrong case for a count. | `{n} tours` | claude-corrected, unverified |
| `fr` | `session_complete_detail` | **Placeholder read as a name in all five** — `les tours d'{maxRounds}`, `las rondas de {maxRounds}`, `раунды игры {maxRounds}`. | `Tu as terminé {maxRounds} tours. Lance une nouvelle session pour rejouer.` | claude-corrected, unverified |
| `fr` | `loading_emoji` | Pluralised; one emoji is being loaded. | `Chargement de l'emoji...` | claude-corrected, unverified |
| `fr` | `show_emoji_button` | Adjusted to informal register. | `Montre-moi un emoji !` | claude-corrected, unverified |
| `es` | `session_complete_detail` | **Placeholder read as a name in all five** — `les tours d'{maxRounds}`, `las rondas de {maxRounds}`, `раунды игры {maxRounds}`. | `Has terminado {maxRounds} rondas. Empieza otra sesión para volver a jugar.` | claude-corrected, unverified |
| `es` | `loading_emoji` | Pluralised; one emoji is being loaded. | `Cargando emoji...` | claude-corrected, unverified |
| `pt-br` | `session_complete_detail` | **Placeholder read as a name in all five** — `les tours d'{maxRounds}`, `las rondas de {maxRounds}`, `раунды игры {maxRounds}`. | `Você terminou {maxRounds} rodadas. Comece outra sessão para jogar de novo.` | claude-corrected, unverified |
| `pt-br` | `loading_emoji` | Pluralised; one emoji is being loaded. | `Carregando emoji...` | claude-corrected, unverified |
| `pt-pt` | `session_complete_detail` | **Placeholder read as a name in all five** — `les tours d'{maxRounds}`, `las rondas de {maxRounds}`, `раунды игры {maxRounds}`. | `Terminaste {maxRounds} rondas. Começa outra sessão para jogares de novo.` | claude-corrected, unverified |
| `pt-pt` | `loading_emoji` | Pluralised; one emoji is being loaded. | `A carregar emoji...` | claude-corrected, unverified |
| `ru` | `rounds_option` | French used `séries` against the glossary's `tour`; Russian `{n} раунды` is the wrong case for a count. | `{n} раундов` | claude-corrected, unverified |
| `ru` | `session_complete_detail` | **Placeholder read as a name in all five** — `les tours d'{maxRounds}`, `las rondas de {maxRounds}`, `раунды игры {maxRounds}`. | `Ты прошёл {maxRounds} раундов. Начни новую сессию, чтобы сыграть ещё раз.` | claude-corrected, unverified |
| `ru` | `loading_emoji` | Pluralised; one emoji is being loaded. | `Загрузка смайлика...` | claude-corrected, unverified |
| `ru` | `show_emoji_button` | Adjusted to informal register. | `Покажи мне смайлик!` | claude-corrected, unverified |

## Reviewed / not reviewed

All 250 strings were read once against their English. Priority went to meaning
(a button that says the wrong thing, a placeholder that renders glued to a word),
then to register consistency. Idiomatic quality beyond that is unexamined, and no
native speaker has seen any of it.
