import { useState, useEffect } from 'react'

// Statische classes (i.p.v. `w-${size}`) — Tailwind's JIT-scanner leest enkel
// letterlijke class-namen in de broncode, dynamische template literals worden
// niet herkend en genereren dus geen CSS.
const SIZE_CLASSES = {
  8: 'w-8 h-8',
  10: 'w-10 h-10',
  11: 'w-11 h-11',
  12: 'w-12 h-12',
  16: 'w-16 h-16',
}

export default function LeerlingFoto({ leerling, size = 12 }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  return (
    <div className={`${SIZE_CLASSES[size] ?? SIZE_CLASSES[12]} rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center`}>
      {imgSrc
        ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
        : <span className="text-xl text-gray-400">👤</span>
      }
    </div>
  )
}
