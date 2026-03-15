/**
 * Toont de inhoud van één panel (bv. Opwarming, Oefening 1, …).
 * Tekst wordt weergegeven met behoud van witruimte/newlines.
 */
export default function LesPanel({ title, content }) {
  if (!content) return null

  return (
    <section className="bg-white rounded-2xl shadow p-4 mb-4">
      <h3 className="font-bold text-brand text-base mb-2 uppercase tracking-wide">
        {title}
      </h3>
      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
        {content}
      </p>
    </section>
  )
}
