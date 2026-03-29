export default function DemoMode({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        enabled
          ? 'bg-indigo-600 text-white hover:bg-indigo-500'
          : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`h-2 w-2 rounded-full ${enabled ? 'animate-pulse bg-white' : 'bg-zinc-300'}`}
        aria-hidden
      />
      Demo Mode
    </button>
  )
}
