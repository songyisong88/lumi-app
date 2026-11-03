// LUMI file-signature check: the first bytes of a file must match what its extension claims.
// Unknown or plain-text extensions are not checked here (returns true).
const b = (...x: number[]) => x
const at = (bytes: Uint8Array, sig: number[], off = 0) => sig.every((v, i) => bytes[off + i] === v)
const ascii = (bytes: Uint8Array, s: string, off = 0) => at(bytes, [...s].map((c) => c.charCodeAt(0)), off)

const ZIP = (x: Uint8Array) => at(x, b(0x50, 0x4b, 0x03, 0x04)) || at(x, b(0x50, 0x4b, 0x05, 0x06)) || at(x, b(0x50, 0x4b, 0x07, 0x08))
const OLE = (x: Uint8Array) => at(x, b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))
const FTYP = (x: Uint8Array) => ascii(x, 'ftyp', 4)
const RULES: Record<string, (x: Uint8Array) => boolean> = {
  png: (x) => at(x, b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
  jpg: (x) => at(x, b(0xff, 0xd8, 0xff)), jpeg: (x) => at(x, b(0xff, 0xd8, 0xff)),
  gif: (x) => ascii(x, 'GIF87a') || ascii(x, 'GIF89a'),
  webp: (x) => ascii(x, 'RIFF') && ascii(x, 'WEBP', 8),
  pdf: (x) => ascii(x, '%PDF-'),
  psd: (x) => ascii(x, '8BPS'),
  zip: ZIP, docx: ZIP, xlsx: ZIP, pptx: ZIP, epub: ZIP, jar: ZIP, apk: ZIP, aab: ZIP, ipa: ZIP, xapk: ZIP, procreate: ZIP, vsix: ZIP, xpi: ZIP,
  doc: OLE, xls: OLE, ppt: OLE, msi: OLE,
  '7z': (x) => at(x, b(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)),
  rar: (x) => ascii(x, 'Rar!\x1a\x07'),
  gz: (x) => at(x, b(0x1f, 0x8b)), tgz: (x) => at(x, b(0x1f, 0x8b)), unitypackage: (x) => at(x, b(0x1f, 0x8b)),
  mp4: FTYP, m4a: FTYP, mov: FTYP, m4v: FTYP,
  webm: (x) => at(x, b(0x1a, 0x45, 0xdf, 0xa3)), mkv: (x) => at(x, b(0x1a, 0x45, 0xdf, 0xa3)),
  mp3: (x) => ascii(x, 'ID3') || (x[0] === 0xff && (x[1] & 0xe0) === 0xe0),
  wav: (x) => ascii(x, 'RIFF') && ascii(x, 'WAVE', 8),
  ogg: (x) => ascii(x, 'OggS'), flac: (x) => ascii(x, 'fLaC'),
  ttf: (x) => at(x, b(0x00, 0x01, 0x00, 0x00)) || ascii(x, 'true'),
  otf: (x) => ascii(x, 'OTTO'), woff: (x) => ascii(x, 'wOFF'), woff2: (x) => ascii(x, 'wOF2'),
  exe: (x) => ascii(x, 'MZ'), dll: (x) => ascii(x, 'MZ'),
  dmg: () => true, // UDIF trailer is at the end; checked by the deep scan
}

export function extOf(name: string) { return (name.split('.').pop() ?? '').toLowerCase() }
export function signatureMatches(name: string, bytes: Uint8Array): boolean {
  const rule = RULES[extOf(name)]
  return rule ? rule(bytes) : true
}
