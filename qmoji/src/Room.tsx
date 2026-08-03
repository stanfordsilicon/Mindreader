import { useParams } from 'react-router-dom';

function Room() {
  const { roomId } = useParams();
  return <div>Room {roomId} coming soon.</div>;
}

export default Room;