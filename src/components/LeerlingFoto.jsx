import { useState, useEffect } from 'react'

export default function LeerlingFoto({ leerling, size = 12 }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!leerling.fotoBlob) return
    const url = URL.createObjectURL(new Blob([leerling.fotoBlob]))
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [leerling.fotoBlob])

  return (
    <div className={`w-${size} h-${size} rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center`}>
      {imgSrc
        ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
        : <span className="text-xl text-gray-400">👤</span>
      }
    </div>
  )
}
