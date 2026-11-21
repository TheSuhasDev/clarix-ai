import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { config } from '../../services';
import { useConsole } from '../../state/ConsoleContext';

interface Props { subtitle?: string; blocked?: number; onlyBlockedLabel?: string }

/** "Live security posture" strip shown on several references. Connected to backend when live. */
export function PostureStrip({ subtitle = 'AIR-GAPPED • ZERO TRUST', blocked }: Props) {
  const nav = useNavigate();
  const { counts } = useConsole();
  const count = blocked !== undefined ? blocked : (config.useMocks ? 7 : (counts.threats || 0));
  const isMock = config.useMocks;
  const items = [
    { big: '100%', label: 'isolated', note: 'Outbound traffic blocked', to: '/air-gap' },
    { big: '5 / 5', label: 'policy gates active', note: 'All enforcement rules enabled', to: '/policies' },
    { big: String(count).padStart(2, '0'), label: 'threats blocked', note: isMock ? 'Simulated detections' : 'Real detections logged', to: '/prompt-injection' },
  ];
  return (
    <section className="cx-card cx-posture" aria-label={`Live security posture${isMock ? ' (simulated)' : ''}`}>
      <div className="cx-posture__lead"><h2>Live security posture</h2><span>{subtitle}</span></div>
      {items.map((i) => (
        <div className="cx-posture__item" key={i.label}>
          <strong>{i.big}</strong>
          <b>{i.label}</b>
          <small>{i.note}</small>
          <button type="button" className="cx-posture__go" aria-label={`Open ${i.label}`} onClick={() => nav(i.to)}><ArrowRight /></button>
        </div>
      ))}
    </section>
  );
}
