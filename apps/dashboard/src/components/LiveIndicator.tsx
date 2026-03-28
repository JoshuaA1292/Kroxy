'use client';

export function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-40" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
      </span>
      <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
