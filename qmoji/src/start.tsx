iimport { useState } from "react";

export default function StartMenu() {
  const [players, setPlayers] = useState(1);
  const [language, setLanguage] = useState("Type your language here");

  const handleStart = async () => {
    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players, language }),
    });
    const data = await res.json();
    console.log(data);
  };

