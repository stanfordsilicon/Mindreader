import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';

type Player = {
  user_id: string;
  name: string;
  score: number;
};

type PodiumProps = {
  players: Player[];
  onPlayAgain: () => void;
  onLeave: () => void;
};
type PodiumProps = {
  players: Player[];
  onPlayAgain: () => void;
  onLeave: () => void;
  isRestarting?: boolean;
};

export default function Podium({ players, onPlayAgain, onLeave, isRestarting = false }: PodiumProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [blocksGrown, setBlocksGrown] = useState(false);
  const [crownsShown, setCrownsShown] = useState(false);
  const [lbVisible, setLbVisible] = useState(false);
  const [btnsVisible, setBtnsVisible] = useState(false);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);

  const rankData = [
    { rank: 2, player: top3[1], height: 140, color: '#c0c0c0', dark: '#a0a0a0' },
    { rank: 1, player: top3[0], height: 200, color: '#ffd700', dark: '#daa520' },
    { rank: 3, player: top3[2], height: 100, color: '#cd7f32', dark: '#8b4513' },
  ];

  // Confetti
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#ffd700', '#ffec8b', '#c0c0c0', '#7ed3d8', '#6fd94a', '#ff6b6b', '#ffa500'];
    const particles: {
      x: number; y: number; size: number; speedY: number; speedX: number;
      rotation: number; rotSpeed: number; color: string; opacity: number; decay: number;
    }[] = [];

    let anim: number;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (particles.length < 120) {
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: -20,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 4 - 2,
            rotation: Math.random() * 360,
            rotSpeed: Math.random() * 8 - 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 1,
            decay: Math.random() * 0.008 + 0.003,
          });
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.01) * 0.5;
        p.rotation += p.rotSpeed;
        p.opacity -= p.decay;
        if (p.opacity <= 0 || p.y > canvas.height + 20) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      anim = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Staggered animation sequence
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 200);
    const t2 = setTimeout(() => setBlocksGrown(true), 1000);
    const t3 = setTimeout(() => setCrownsShown(true), 1800);
    const t4 = setTimeout(() => setLbVisible(true), 2200);
    const t5 = setTimeout(() => setBtnsVisible(true), 2800);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #3a1a34 0%, #5b2a52 40%, #241021 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, color: 'white', overflow: 'hidden',
      zIndex: 100,
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 1,
      }} />

      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: '1.4rem', textAlign: 'center',
        marginBottom: 8, zIndex: 10,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-20px)',
        transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        textShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
        🏆 GAME OVER 🏆
      </h1>

      <p style={{
        fontSize: '0.85rem', marginBottom: 40, zIndex: 10,
        opacity: visible ? 0.85 : 0, transition: 'opacity 0.6s ease 0.3s',
      }}>{t('final_results_heading')}</p>

      {/* Podium */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 40, zIndex: 10 }}>
        {rankData.map((r, i) => (
          <div key={r.rank} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(60px)',
            transition: `all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.15}s`,
          }}>
            <div style={{
              width: r.rank === 1 ? 80 : 64,
              height: r.rank === 1 ? 80 : 64,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${r.color} 0%, ${r.dark} 100%)`,
              border: `${r.rank === 1 ? 5 : 4}px solid ${r.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: r.rank === 1 ? '2.2rem' : '1.8rem',
              marginBottom: 8,
              boxShadow: `0 ${r.rank === 1 ? 8 : 6}px ${r.rank === 1 ? 30 : 20}px ${r.color}40`,
              position: 'relative',
              animation: r.rank === 1 ? 'qmoji-float 3s ease-in-out infinite' : undefined,
            }}>
              {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}
              <div style={{
                position: 'absolute', top: r.rank === 1 ? -22 : -18,
                fontSize: r.rank === 1 ? '1.6rem' : '1.2rem',
                opacity: crownsShown ? 1 : 0,
                transform: crownsShown ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-20deg)',
                transition: `all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${r.rank === 1 ? 0.2 : 0}s`,
              }}>
                👑
              </div>
            </div>

            <div style={{
              fontWeight: 700, fontSize: r.rank === 1 ? '0.9rem' : '0.8rem',
              marginBottom: 4, textAlign: 'center', maxWidth: 110,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: r.color,
            }}>
              {r.player?.name ?? '—'}
            </div>

            <div style={{
              fontFamily: 'var(--font-display)', fontSize: r.rank === 1 ? '0.75rem' : '0.65rem',
              color: r.color, marginBottom: 8,
            }}>
              {r.player?.score ?? 0}
            </div>

            <div style={{
              width: r.rank === 1 ? 100 : 90,
              height: blocksGrown ? r.height : 0,
              background: `linear-gradient(180deg, ${r.dark} 0%, ${r.color} 100%)`,
              borderRadius: '8px 8px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 -4px 15px ${r.color}30`,
              position: 'relative', overflow: 'hidden',
              transition: `height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.2 + 0.3}s`,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: r.rank === 1 ? '1.8rem' : '1.4rem',
                color: 'rgba(255,255,255,0.25)',
              }}>
                {r.rank}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Full leaderboard */}
      <div style={{
        width: '100%', maxWidth: 340, zIndex: 10,
        opacity: lbVisible ? 1 : 0,
        transform: lbVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 0.6s ease',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16,
          backdropFilter: 'blur(10px)',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontSize: '0.6rem',
            textAlign: 'center', margin: '0 0 14px', opacity: 0.8,
          }}>{t('full_leaderboard_heading')}</h3>

          {sorted.map((p, idx) => (
            <div key={p.user_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', marginBottom: idx < sorted.length - 1 ? 6 : 0,
              background: idx === 0 ? 'rgba(255,215,0,0.12)'
                : idx === 1 ? 'rgba(192,192,192,0.1)'
                : idx === 2 ? 'rgba(205,127,50,0.1)'
                : 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              opacity: lbVisible ? 1 : 0,
              transform: lbVisible ? 'translateX(0)' : 'translateX(-20px)',
              transition: `all 0.4s ease ${idx * 0.1}s`,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: idx < 3 ? 700 : 400 }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.55rem',
                  color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.5)',
                  minWidth: 28,
                }}>
                  #{idx + 1}
                </span>
                {p.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '0.6rem',
                color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.6)',
              }}>
                {p.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 24, zIndex: 10,
        opacity: btnsVisible ? 1 : 0,
        transform: btnsVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.5s ease',
      }}>
        <button className="qmoji-btn qmoji-btn-red" onClick={onLeave}>{t('leave_button')}</button>
        <button
          className="qmoji-btn qmoji-btn-green"
          onClick={onPlayAgain}
          disabled={isRestarting}
        >
          {isRestarting ? 'Restarting...' : t('play_again_button')}
        </button>
      </div>

      <style>{`
        @keyframes qmoji-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}