import PageHead from "../components/PageHead.jsx";

export default function HowToUse() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <PageHead title="How to use TrustHire" description="Quick-start guide to running verifications and understanding Deep Think mode." />
      <div>
        <h1 className="text-4xl font-bold mb-3">How to use TrustHire</h1>
        <p className="text-muted">Two minutes to your first verification.</p>
      </div>
      <ol className="space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card p-6">
            <div className="text-xs uppercase tracking-widest text-accent">Step {i + 1}</div>
            <h3 className="text-lg font-semibold mt-1">{s.title}</h3>
            <p className="text-sm text-muted mt-2">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="card p-6">
        <h3 className="font-semibold">Normal vs Deep Think</h3>
        <p className="text-sm text-muted mt-2">
          Normal mode runs the eight core signals in under a second. Deep Think adds recruiter footprint, WHOIS drill-down and multi-source complaint aggregation — use it when a posting feels off.
        </p>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Paste a company name or job URL", body: "The engine accepts either. URLs are scraped; names are resolved via search." },
  { title: "Pick Normal or Deep Think", body: "Normal is fast; Deep Think is thorough. Deep runs count against a separate quota." },
  { title: "Read the Trust Score and breakdown", body: "Each of the eight parameters is shown with evidence and reasoning." },
  { title: "Export as PDF or file in a group", body: "Organize verifications into named groups; export well-formatted PDF audits." },
];