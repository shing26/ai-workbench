import { FlaskConical } from 'lucide-react';
import { isMockAgentsEnabled } from '../../lib/mockAgents';

export default function MockBadge() {
  if (!isMockAgentsEnabled()) return null;
  return (
    <span
      data-mock-badge
      title="MOCK_ALL_AGENTS enabled — external I/O is mocked, storage stays real"
      className="flex h-6 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 text-[9px] font-medium text-amber-300"
    >
      <FlaskConical size={10} />
      Mock mode
    </span>
  );
}
