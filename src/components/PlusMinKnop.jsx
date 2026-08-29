export default function PlusMinKnop({ value, min = 0, max, step = 1, onChange }) {
  function plus()  { onChange(Math.min(max, Math.round((value + step) * 100) / 100)) }
  function minus() { onChange(Math.max(min, Math.round((value - step) * 100) / 100)) }

  return (
    <div className="flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={minus} className="flex-1 py-3 text-2xl font-bold text-red-500 active:bg-red-50" aria-label="min">−</button>
      <span className="w-16 text-center text-lg font-bold" style={{ color: '#2C3E50' }}>
        {value % 1 === 0 ? value : value.toFixed(1)}
        {max != null && <span className="text-xs text-gray-400 font-normal">/{max}</span>}
      </span>
      <button onClick={plus} className="flex-1 py-3 text-2xl font-bold text-green-500 active:bg-green-50" aria-label="plus">+</button>
    </div>
  )
}
