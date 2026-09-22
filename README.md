# OFFSET — multi-stroke image builder

Upload an image, get concentric offset strokes that follow its silhouette, at any
canvas size, with the stroke weight staying proportionally identical everywhere.

## Run it

Double-click `index.html`, or serve it:

```bash
python -m http.server 5178
```

then open <http://localhost:5178>. (The server path is the one that's been tested;
use it if your browser restricts local files.)

No build step, no dependencies.

## How the effect works

1. **Silhouette** — the image is reduced to a binary mask, taken from its alpha
   channel or from a luminance threshold. Enclosed holes can be flood-filled, and
   the outline can be blurred to merge nearby shapes into one organic blob (that's
   what makes separate letters read as a single sticker).
2. **Signed distance field** — an exact Euclidean distance transform
   (Felzenszwalb–Huttenlocher, O(n)) gives every pixel its distance to the
   silhouette. This is why the strokes are smooth offsets rather than jagged
   pixel-traced outlines.
3. **Bands** — distance ranges are mapped to colours through a lookup table, so
   stroke count, weight, gap, offset and per-stroke growth are all just numbers
   applied to that field. Three samples along the field gradient anti-alias the
   edges.
4. **Vector export** — marching squares extracts the iso-contour at each band
   boundary, and the loops become real SVG paths.

## Why stroke weight matches at every size

Every spatial parameter is stored as a **percentage of a basis dimension**, not in
pixels:

```
px = percent / 100 × unit        unit = f(canvas width, canvas height)
```

`Scale strokes to` picks the basis — short side (default), long side, width,
height, or diagonal. Preview and export run the same code with a different
`unit`, so a 2.4% stroke is 25.9px on a 1080 post, 59.5px on A4 at 300dpi and
47.3px on a 3m banner: identical proportion, correct physical size.

Measured across a 8× range (540 / 1080 / 4320px), a 2.4% stroke rendered at
2.31–2.45% of canvas width; the residual is sub-pixel scanline quantisation.

Short side is the default basis because it keeps weights stable when the aspect
ratio changes. Switch to long side or diagonal if you want strokes to grow on
wide formats.

## Controls

**Canvas** — format presets (IG, A-series, posters, banner, sticker), px/mm/inch
with DPI, background colour, stroke basis, preview quality.

**Image placement** — contain/cover, *frame on cut-out*, scale, X/Y offset, rotate,
flip. Offsets are percentages too, so framing survives a format change.

*Frame on cut-out* measures Fit and Scale against the bounding box of the
non-transparent pixels instead of the file's own edges. Cut-out PNGs usually carry
a lot of empty margin — the bundled example is 1080×810 but its subject occupies
only 513×659 — which otherwise makes Scale mean "how big is the file" rather than
"how big is the subject". It does nothing for images without transparency.

**Silhouette** — shape source, threshold, invert, fill holes, smooth outline,
expand/contract. *Auto* means the alpha channel: a cut-out gets strokes around
the subject, and an ordinary opaque photo gets them around the picture's own
rectangle. Dark and light pixel thresholds are there when you want them, but they
are no longer what an upload silently falls back to.

**Strokes** — count, weight, gap, offset from image, per-stroke growth multiplier,
an editable colour list that cycles, separate colours for the offset gap / the
gaps between strokes / the area behind the image, and inward strokes.

**Image treatment** — photo / 1-bit threshold / flat silhouette / hidden.
Brightness, contrast, saturation, posterize, invert. For 1-bit: threshold, ink and
paper colours, which tone the ink covers, and dithering (ordered 4×4, ordered 8×8,
Floyd–Steinberg, random noise, and a proper halftone screen with adjustable angle
and dot shape) with a dot size that also scales with the canvas.
*Clip image to silhouette* keeps the dither off a photo's opaque background.

**Background removal** — one button. It builds a small palette of backdrop
colours from the whole border ring rather than averaging the four corners, picks
its threshold from how far those border pixels actually scatter, and grows inward
from the edges so a colour that also appears inside the subject survives. Where
the backdrop is graded it follows it locally — each step must be close to the
pixel it came from, capped so a chain of small steps cannot drift across the
picture — instead of widening the global threshold, which is what used to let a
gradient swallow the subject. Edges get partial alpha across a soft band, and
leftover specks are folded back into the background.

Measured against the bundled cut-out composited over four backdrops: flat 99%
removed / 85% of subject kept, gradient 99% / 99.6%, two-tone 99% / 80%, busy
texture 58% / 100% — it refuses rather than eating the subject when the backdrop
is too noisy to key.

**Presets** — save the current stroke look under a name and use it again. On the
published link these live in the artifact's shared database, so everyone on the
team sees everyone's; opened as a local file there is no such store and they fall
back to this browser's localStorage, which the panel says plainly rather than
pretending they are shared. A preset carries the whole Strokes tab plus the
background colour the palette was chosen against. Only the author's id is stored,
never their name — names differ per viewer and go stale, so they are resolved at
render time.

**Drawing** — eight brushes (marker, pen, scribble, calligraphy, chalk, spray,
dashed, highlighter), any colour, on a layer above the artwork, in its own tab.
Chalk and spray stamp a deterministic grain, calligraphy varies its width with
the direction of travel, and pen keeps hard mitred joins. Nib width is a percentage of the basis dimension like everything else, and
strokes are stored in normalised canvas coordinates, so a scribble drawn on the
1200px preview comes out at the same proportion on an 8000px banner. Ctrl+Z undoes
the last stroke.

**Grain** — amount, size, mono/colour, and the noise seed.

The *seed* is the starting number for the random-pattern generator, used only by
the grain overlay and the **Random noise** dither mode. Both are deterministic: the
same seed always draws the same speckle, which is why the preview and the export
agree instead of re-rolling. Change it to reshuffle. With grain at 0 and the dither
set to anything but Random noise, the seed does nothing.

**Export** — PNG at 0.5×–4× the canvas size, or SVG with the strokes as vector
paths (the image itself stays raster inside the SVG, at full export resolution).

## Layout

Canvas format and background sit above three tabs:

**Strokes** — count, weight, gap, offset, growth and inward strokes; the colour
list and the colours for gaps, offset and behind the image; and the silhouette
controls, since their only job is to shape the strokes.

**Image** — alignment, placement, background removal, treatment and grain.

**Drawing** — brush type, colour, nib width, undo and clear.

An upload arrives untouched: the whole picture, at 100%, with no cropping to the
cut-out and no processing. Background removal, clipping and treatment are things
you turn on afterwards.

Click the picture to pick it up — that shows its frame and four corner handles.
Drag to move, pull a handle to scale, or use the wheel to zoom about the pointer.
Click off it, or press Escape, to put it down. The sliders and the artboard drive the
same numbers, so either works.

Dragging used to cost about a second a frame, because moving the picture moves
the silhouette and the distance transform had to run again. It doesn't now: the
strokes and the artwork translate WITH the picture and the background is a flat
fill, so during a drag the last rendered frame is blitted at an offset, which is
exact and costs one drawImage. The real render happens once, on release. That
took a move frame from 914ms to 0.07ms. Corner scaling previews the same way;
that one is approximate, since stroke weights scale with the preview, and snaps
true when you let go.

Uploading a picture resets the image settings — background removal, treatment,
crop, rotation, grain — so whatever you did to the last one doesn't silently land
on the next. Canvas, strokes and colours are your design, so they stay.

*Align* snaps the subject to any of nine positions. It aligns the subject's own
bounding box, so strokes may bleed past the edge — lower Scale if you want them
inside. (An earlier version reserved room for the strokes, but at ordinary scales
that made the padded box taller than the canvas and every position landed within
a few pixels of the others.)

There is no tool strip. Drawing is switched on from the Drawing tab, or with `B`,
and a ring follows the pointer at the nib's true size while it is on.

Drawing stays cheap because the rings and the treated artwork are cached as one
base layer, so a drag redraws only the strokes on top — about 0.4ms a frame rather
than re-running the distance transform and the halftone screen.

## Language

The EN / PT toggle in the toolbar switches the whole interface, including hints,
dropdown options, the stroke-weight card and status messages. The choice is saved
with the rest of the settings. Strings live in `js/i18n.js` — add a third language
by copying the `en` block and registering it in `DICT`.

## The example image

On load the tool tries `assets/example.png`, `.jpg`, `.jpeg`, `.webp` and `.avif`
in that order, and falls back to a generated wordmark if none is present. Replace
that file to change the example; a cut-out with a transparent background works
best, since the default treatment is Photo and the silhouette comes from the alpha
channel.

Browsers cache the JS hard — after editing a file under `js/`, hard-refresh
(Ctrl + F5) or you will keep running the old copy.

## Files

```
index.html       markup shell
css/app.css      light UI
js/util.js       helpers
js/i18n.js       English / Portuguese strings
js/bg.js         background removal
js/paint.js      the drawing layer
js/presets.js    shared saved looks (artifact db, localStorage fallback)
js/edt.js        distance transform, blur, hole fill
js/contour.js    marching squares, simplification, SVG paths
js/engine.js     placement, mask, rings, image FX, export
js/app.js        parameter schema, generated UI, wiring
```

Settings persist in `localStorage`, language included. `window.OFFSET.settings` exposes live state
from the console.

## Notes

- Export cost is roughly linear in pixels: 8.6MP (4800×1800) renders in ~2.4s.
  Above ~40MP the status bar warns you.
- SVG trace detail sets the grid the contours are extracted from; the paths scale
  losslessly afterwards regardless.
