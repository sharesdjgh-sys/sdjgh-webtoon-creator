/** PNGs are already compressed; store them in a dependency-free UTF-8 ZIP. */
export async function webtoonArchive(files: { name: string; blob: Blob }[]): Promise<Blob> {
  if (files.length > 65535) throw new Error("ZIP 파일 수가 너무 많습니다.");
  const local: BlobPart[] = [], central: BlobPart[] = [];
  let offset = 0, centralSize = 0;
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const names = new Set<string>();
  for (const file of files) {
    if (!file.name || /[\\/]/.test(file.name) || [...file.name].some(c => c.charCodeAt(0) < 32) || names.has(file.name)) throw new Error("ZIP 파일 이름이 올바르지 않습니다.");
    names.add(file.name);
    const name = new TextEncoder().encode(file.name);
    if (name.length > 65535 || file.blob.size >= 0xffffffff) throw new Error("ZIP 파일이 너무 큽니다.");
    const data = new Uint8Array(await file.blob.arrayBuffer());
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); header.set(name, 30);
    local.push(header, file.blob);
    const entry = new Uint8Array(46 + name.length), e = new DataView(entry.buffer);
    e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true);
    e.setUint16(8, 0x0800, true); e.setUint16(14, 33, true);
    e.setUint32(16, crc, true); e.setUint32(20, data.length, true); e.setUint32(24, data.length, true);
    e.setUint16(28, name.length, true); e.setUint32(42, offset, true); entry.set(name, 46);
    central.push(entry); offset += header.length + data.length; centralSize += entry.length;
    if (offset + centralSize + 22 >= 0xffffffff) throw new Error("원고가 너무 큽니다. 화를 나누어 다운로드해주세요.");
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: "application/zip" });
}

export function webtoonFilename(title: string) {
  const clean = [...title].map(c => c.charCodeAt(0) < 32 ? "-" : c).join("");
  return (clean.replace(/[<>:"/\\|?*]/g, "-").trim().slice(0, 80).replace(/[. ]+$/g, "") || "webtoon");
}
