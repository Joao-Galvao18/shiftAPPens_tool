/* mp4.js — H.264 video, encoded with WebCodecs and muxed here.

   MediaRecorder can sometimes produce an MP4, but it times frames by the wall
   clock and offers no real control over quality, which is why the WebM path
   has to pre-render everything and feed it at a measured cadence. VideoEncoder
   has neither problem: frames carry their own timestamps and the bitrate is
   ours to set. What it does not do is write a file, so the container is built
   here — ftyp, moov, mdat, nothing fragmented.

   Two things H.264 insists on, and both are handled before encoding starts:
   dimensions must be even, and the file must store frames in decode order. No
   browser encoder emits B-frames today, so decode order and presentation order
   agree; the muxer checks that the timestamps really did come back in order and
   refuses rather than writing a file that plays its frames shuffled.
*/
(function (g) {
  'use strict';

  const TE = new TextEncoder();
  const TIMESCALE = 90000;      // divides evenly by every frame rate offered

  /* ---------- boxes ---------- */

  function cat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let i = 0;
    for (const p of parts) { out.set(p, i); i += p.length; }
    return out;
  }
  const u8 = (...v) => new Uint8Array(v);
  const u16 = v => new Uint8Array([(v >> 8) & 255, v & 255]);
  const u32 = v => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
  const zeros = n => new Uint8Array(n);

  function box(type, ...parts) {
    const body = cat(parts);
    return cat([u32(body.length + 8), TE.encode(type), body]);
  }
  function full(type, version, flags, ...parts) {
    return box(type, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);
  }

  // the identity matrix every file carries
  const MATRIX = cat([u32(0x00010000), u32(0), u32(0),
                      u32(0), u32(0x00010000), u32(0),
                      u32(0), u32(0), u32(0x40000000)]);

  function moovFor(o, chunkOffset) {
    const n = o.sizes.length;
    const duration = n * o.delta;

    const avcC = box('avcC', o.description);
    const avc1 = box('avc1',
      zeros(6), u16(1),                       // reserved, data_reference_index
      u16(0), u16(0), zeros(12),              // pre_defined, reserved
      u16(o.width), u16(o.height),
      u32(0x00480000), u32(0x00480000),       // 72dpi
      u32(0), u16(1),                         // reserved, frame_count
      zeros(32),                              // compressorname
      u16(0x0018), u16(0xFFFF),               // depth, pre_defined = -1
      avcC);

    const stbl = box('stbl',
      full('stsd', 0, 0, u32(1), avc1),
      full('stts', 0, 0, u32(1), u32(n), u32(o.delta)),
      full('stss', 0, 0, u32(o.keys.length), cat(o.keys.map(u32))),
      full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      full('stsz', 0, 0, u32(0), u32(n), cat(o.sizes.map(u32))),
      full('stco', 0, 0, u32(1), u32(chunkOffset)));

    return box('moov',
      full('mvhd', 0, 0, u32(0), u32(0), u32(TIMESCALE), u32(duration),
        u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2)),
      box('trak',
        full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(duration),
          zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX,
          u32(o.width << 16), u32(o.height << 16)),
        box('mdia',
          full('mdhd', 0, 0, u32(0), u32(0), u32(TIMESCALE), u32(duration), u16(0x55C4), u16(0)),
          full('hdlr', 0, 0, u32(0), TE.encode('vide'), zeros(12), TE.encode('StrokeTool\0')),
          box('minf',
            full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
            box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
            stbl))));
  }

  function fileFrom(o) {
    const ftyp = box('ftyp', TE.encode('isom'), u32(0x200),
      TE.encode('isom'), TE.encode('iso2'), TE.encode('avc1'), TE.encode('mp41'));
    // the moov's own length does not depend on the offset VALUE, only on its
    // presence, so measure it once and then write it again knowing where mdat lands
    const probe = moovFor(o, 0);
    const offset = ftyp.length + probe.length + 8;
    const moov = moovFor(o, offset);
    const mdatHead = cat([u32(o.payload.length + 8), TE.encode('mdat')]);
    return new Blob([ftyp, moov, mdatHead, o.payload], { type: 'video/mp4' });
  }

  /* ---------- encoding ---------- */

  /* Picked widest-first: a clip can exceed High 4.0 at 1080p60 and would be
     rejected, so ask the browser which of these it will actually take. */
  const CODECS = ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.640028',
                  'avc1.4D4028', 'avc1.42E028'];

  function available() {
    return typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
  }

  async function pickCodec(cfg) {
    for (const codec of CODECS) {
      try {
        const r = await VideoEncoder.isConfigSupported(Object.assign({}, cfg, { codec: codec }));
        if (r && r.supported) return codec;
      } catch (e) { /* try the next one */ }
    }
    return null;
  }

  /* draw is called with (index) and returns a canvas for that frame */
  async function encode(opts) {
    if (!available()) throw new Error('this browser has no H.264 encoder (WebCodecs)');

    const width = opts.width - (opts.width % 2);      // H.264 wants even dimensions
    const height = opts.height - (opts.height % 2);
    const fps = opts.fps;
    const total = opts.frames;
    const delta = Math.round(TIMESCALE / fps);
    const base = { width: width, height: height, bitrate: opts.bitrate, framerate: fps };

    const codec = await pickCodec(base);
    if (!codec) throw new Error('no H.264 profile this browser accepts at ' + width + '×' + height);

    const chunks = [];
    let description = null;
    let failed = null;

    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (!description && meta && meta.decoderConfig && meta.decoderConfig.description) {
          description = new Uint8Array(meta.decoderConfig.description);
        }
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ data: data, key: chunk.type === 'key', ts: chunk.timestamp });
      },
      error: e => { failed = e; }
    });

    enc.configure(Object.assign({ codec: codec, avc: { format: 'avc' },
      latencyMode: 'quality', hardwareAcceleration: 'no-preference' }, base));

    const us = 1e6 / fps;
    const keyEvery = Math.max(1, Math.round(fps));     // a keyframe a second, plus the first
    for (let i = 0; i < total; i++) {
      if (failed) throw failed;
      const canvas = await opts.draw(i, width, height);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * us), duration: Math.round(us) });
      enc.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();
      if (opts.onStep) opts.onStep(i + 1, total);
      // let the encoder drain so a long clip does not pile up in memory
      if (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 0));
      else await new Promise(r => setTimeout(r, 0));
    }

    await enc.flush();
    enc.close();
    if (failed) throw failed;
    if (!chunks.length) throw new Error('the encoder produced no frames');
    if (!description) throw new Error('the encoder gave no H.264 parameter sets');

    // decode order must be storage order; today no browser reorders, but a file
    // written from shuffled chunks would play its frames out of sequence
    for (let i = 1; i < chunks.length; i++) {
      if (chunks[i].ts < chunks[i - 1].ts) throw new Error('the encoder reordered frames');
    }

    const keys = [];
    const sizes = [];
    chunks.forEach((c, i) => { sizes.push(c.data.length); if (c.key) keys.push(i + 1); });
    if (!keys.length) keys.push(1);

    return fileFrom({
      width: width, height: height, delta: delta,
      description: description, sizes: sizes, keys: keys,
      payload: cat(chunks.map(c => c.data))
    });
  }

  g.MP4 = { available: available, encode: encode };
})(window);
