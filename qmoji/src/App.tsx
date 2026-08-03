
import { Routes, Route } from 'react-router-dom';
import SingleplayerGame from './SingleplayerGame';
import Multiplayerlobby from './Multiplayerlobby';
import Room from './Room';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SingleplayerGame />} />
      <Route path="/multiplayer" element={<Multiplayerlobby />} />
      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
  );
}


export default App;
