const PHRASES = [
  { label: 'I need help', text: 'I need help with this task.' },
  { label: 'Please repeat', text: 'Please repeat what you said.' },
  { label: 'Thank you', text: 'Thank you for your patience.' },
]

export default function PhraseButtons({ onPhrase, disabled }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="w-full text-center text-xs font-medium uppercase tracking-wide text-zinc-400 sm:w-auto">
        Quick phrases
      </span>
      {PHRASES.map((p) => (
        <button
          key={p.label}
          type="button"
          disabled={disabled}
          onClick={() => onPhrase(p.text)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
