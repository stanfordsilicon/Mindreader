
import { Routes, Route } from 'react-router-dom';
import SingleplayerGame from './SingleplayerGame';
import MultiplayerLobby from './MultiplayerLobby';
import Room from './Room';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SingleplayerGame />} />
      <Route path="/multiplayer" element={<MultiplayerLobby />} />
      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
  );
}


export default App;
