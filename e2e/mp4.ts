// MP4 kutularından süreyi (mvhd) ve görüntü izinin ölçüsünü (tkhd) okur.
export function mp4Info(bytes: Uint8Array): { durationSeconds: number; width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  let durationSeconds = 0;
  let width = 0;
  let height = 0;
  const walk = (start: number, end: number) => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      let header = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(offset + 8));
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      const box = type(offset + 4);
      const body = offset + header;
      if (box === 'moov' || box === 'trak') walk(body, offset + size);
      if (box === 'mvhd') {
        const version = bytes[body];
        const timescale = view.getUint32(body + (version === 1 ? 20 : 12));
        const duration = version === 1 ? Number(view.getBigUint64(body + 24)) : view.getUint32(body + 16);
        durationSeconds = duration / timescale;
      }
      if (box === 'tkhd') {
        const trackWidth = view.getUint32(offset + size - 8) >> 16;
        const trackHeight = view.getUint32(offset + size - 4) >> 16;
        if (trackWidth > 0) {
          width = trackWidth;
          height = trackHeight;
        }
      }
      offset += size;
    }
  };
  walk(0, bytes.length);
  return { durationSeconds, width, height };
}
