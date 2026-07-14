import { useState } from "react";

export default function StartMenu() {
  const [Seconds_per_round, setSeconds_per_round] = useState(10);
  const [language, setLanguage] = useState("Type your language here");
  const [players] = useState<string[]>([]);

  const handleStart = async () => {
    const res = await fetch("/", {
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
        value={Seconds_per_round}
        onChange={(e) => setSeconds_per_round(Number(e.target.value))}
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

