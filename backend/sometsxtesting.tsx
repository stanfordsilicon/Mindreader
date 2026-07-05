import { useState } from "react";

export default function StartMenu() {
  const [players, setPlayers] = useState(2);
  const [language, setLanguage] = useState("English");

  const handleStart = async () => {
    const res = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players, language }),
    });
    const data = await res.json();
    console.log(data);
  };

  return (
    <div>
      <input
        type="number"
        value={players}
        onChange={(e) => setPlayers(Number(e.target.value))}
      />
      <input
        type="text"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      />
      <button onClick={handleStart}>Start</button>
    </div>
  );
}