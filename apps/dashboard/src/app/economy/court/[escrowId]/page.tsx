import { ArbitrationViewer } from '../../../../components/ArbitrationViewer';

interface Props {
  params: { escrowId: string };
}

export default function ArbitrationPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-black text-white p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Arbitration Case</h1>
        <p className="font-mono text-zinc-500 text-sm mt-1 break-all">{params.escrowId}</p>
      </div>

      <ArbitrationViewer escrowId={params.escrowId} />
    </main>
  );
}
