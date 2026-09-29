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

**Presets** — save the current stroke look under a name and use it again. One
preset, **ShiftAPPens**, is built into `js/presets.js` and ships with the code, so
every copy has it however the tool is hosted; it is not deletable and belongs to
nobody. Edit the `BUILTIN` array to change it or add more.

Saved presets are only shared on the claude.ai artifact link. On a static host
(GitHub Pages, a local file) there is no shared store, so what a person saves
stays in their own browser — the panel says so. On the
published link these live in the artifact's shared database, so everyone on the
team sees everyone's; opened as a local file there is no such store and they fall
back to this browser's localStorage, which the panel says plainly rather than
pretending they are shared. A preset carries the whole Strokes tab plus the
background colour the palette was chosen against. Only the author's id is stored,
never their name — names differ per viewer and go stale, so they are resolved at
render time.

Each person's list is one document, `presets/<their id>`, and the published rules

    { path: "presets",        read: "view",  write: "admin" }
    { path: "presets/{self}", write: "interact" }

mean everyone reads every list while nobody can write anyone else's — ownership
enforced by the store rather than merely hidden in the interface. It stays one
subscription over one collection, because those per-person documents sit directly
in `presets`; nesting each person's presets in a subcollection is what would force
a roster document and a subscription per person.

**Animate** — six movements of the strokes: *radiate* (bands emerging from the
cut-out and travelling out, or inward), *breathe* (weight swelling), *chase* (the palette marching round), *reveal*
(strokes growing and retracting), *wobble* (the silhouette pulsing) and *hue
shift* (the palette travelling round the colour wheel). Moving grain redraws the
speckle every frame for a film-grain shimmer; it rides on top of the finished
frame, so animating it is free. Each is a function of loop time and returns to its first frame, so the loop is
seamless by construction rather than by trimming.

Radiate is the fiddly one. Its band stack starts at a NEGATIVE phase rather than
at "Distance from image": keeping that distance leaves a ring of background
between the cut-out and the innermost band that widens by a whole period and then
snaps shut. Starting in [-period, 0) means a band always straddles the
silhouette's edge, so one is forever sliding out of it. Sliding the whole stack outward opens a gap between
the subject and the innermost band that grows all loop and then snaps shut — a
visible cut. Instead the innermost band start is held within one period of the
subject, so a new band emerges hugging the cut-out every period, and the palette
rotates by one to compensate so each band keeps its own colour as it travels. At
t=1 the travel is a whole number of periods AND of colours, so geometry and
palette both land exactly where they started. The stack is always extended to
run past the canvas corner, so a band only ever leaves by going out of sight —
which is why Number of strokes does not apply while radiating, and why weight
growth is forced to 1 (a stack whose bands widen is not periodic and could never
loop).

Every movement touches only the ring compositing. The distance field and the
treated artwork are identical in each frame and the engine caches both, so a
frame costs about 50ms at 700px instead of the ~1s a cold render takes. Playback
is capped at 700px for that reason; exports render at the real size.

Everything runs at 60fps — at 30 a travelling band visibly steps, and no frame is
expensive enough to need less. GIF is the exception: its delays are whole
hundredths of a second, so 50fps (delay 2) is the fastest it can honestly hold,
and the export button shows the real rate.

Export as GIF, WebM or a numbered PNG per frame, at 0.5x, 1x or 2x. The GIF
encoder is in `js/gif.js` — median-cut quantisation over a 15-bit histogram with
one palette shared by every frame, then standard LZW. It is written out rather
than pulled from a CDN because the artifact sandbox blocks fetching a worker
script. GIF delays are whole hundredths of a second, so the rate snaps to the
nearest one it can hold and the export button shows what you will actually get.

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

An upload arrives untouched: the canvas takes the picture's pixel size PLUS a
margin, and the picture is placed at exactly 1:1, so it exports as sharp as the
file rather than being resampled into a preset (verified pixel-identical). No
cropping to the cut-out, no processing.

The margin matters. Matching the picture's size exactly leaves the silhouette
filling the whole frame, so every stroke lands outside the canvas and the tool
appears to do nothing at all — the strokes need somewhere to go. The margin is
18% of the picture's short side, at least 64px, and `contain`'s scale-up is
cancelled so the placement still comes out at 1:1.

The preview renders at the resolution it is actually SHOWN at, times the
display's pixel ratio — not at the canvas's own size — capped by the quality
setting and never past twice the canvas. An upload plus its margin is often only
~700px, and the artboard magnifies it to fill the pane, so rendering at the
canvas size left it visibly soft.

Every colour control carries its hex alongside the swatch; type into either.
Palette chips show their hex on hover.

The Canvas panel folds away when the sidebar is tight; it keeps showing the size
while closed, and remembers the choice. Background removal, clipping and treatment are things
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
js/anim.js       stroke animation: frame model and exporters
js/gif.js        self-contained animated-GIF encoder
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
