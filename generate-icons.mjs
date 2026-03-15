/**
 * Genereert icon-192.png en icon-512.png voor de PWA manifest.
 * Kleur: #E67E22 (oranje) met witte "LO" tekst.
 * Pure Node.js — geen extra packages nodig.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── PNG chunk helper ──────────────────────────────────────────────────────────
function chunk(type, data) {
  const t   = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}

// ── Solid-colour PNG with simple "LO" mark via pixel art ─────────────────────
function solidPNG(size, bg, fg, markFn) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3)
    row[0] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = markFn(x, y, size) ? fg : bg
      row[1 + x * 3]     = r
      row[1 + x * 3 + 1] = g
      row[1 + x * 3 + 2] = b
    }
    rows.push(row)
  }

  const raw  = Buffer.concat(rows)
  const idat = deflateSync(raw, { level: 6 })

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ── "LO" mark: rounded square badge + letter pixels ─────────────────────────
function loMark(x, y, size) {
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.38  // inner circle radius for letters

  // Normalise to -1..1
  const nx = (x - cx) / r
  const ny = (y - cy) / r

  // Rounded square background (the whole image is the icon background)
  // We just draw white "LO" letters in the centre

  // Simple pixel-art "L" and "O" at icon scale
  const u = nx + 0.55   // shift left half slightly left
  const v = ny          // centred vertically

  const thick = 0.18    // letter stroke width

  // "L": vertical bar on left + horizontal bar at bottom
  const inL = (
    (u >= -0.50 && u <= -0.50 + thick && v >= -0.55 && v <=  0.55) ||   // vertical
    (u >= -0.50 && u <=  0.00         && v >=  0.55 - thick && v <=  0.55) // bottom bar
  )

  // "O": hollow circle on right side
  const ox = nx - 0.32
  const oy = ny
  const dist = Math.sqrt(ox * ox + (oy * 1.0) ** 2)
  const inO = dist >= 0.28 && dist <= 0.28 + thick * 1.1

  return inL || inO
}

// Generate both sizes
const BG = [230, 126, 34]  // #E67E22
const FG = [255, 255, 255] // white

writeFileSync('public/icon-192.png', solidPNG(192, BG, FG, loMark))
writeFileSync('public/icon-512.png', solidPNG(512, BG, FG, loMark))
console.log('✓ public/icon-192.png')
console.log('✓ public/icon-512.png')
