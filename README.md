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

The **Stroke weight check** card under Strokes shows the current weight in px and
mm, plus what it resolves to in three reference formats.

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

**Silhouette** — shape source (auto/alpha/dark/light), threshold, invert, fill
holes, smooth outline, expand/contract.

**Strokes** — count, weight, gap, offset from image, per-stroke growth multiplier,
an editable colour list that cycles, separate colours for the offset gap / the
gaps between strokes / the area behind the image, and inward strokes.

**Image treatment** — photo / 1-bit threshold / flat silhouette / hidden.
Brightness, contrast, saturation, posterize, invert. For 1-bit: threshold, ink and
paper colours, which tone the ink covers, and dithering (ordered 4×4, ordered 8×8,
Floyd–Steinberg, random noise, and a proper halftone screen with adjustable angle
and dot shape) with a dot size that also scales with the canvas.
*Clip image to silhouette* keeps the dither off a photo's opaque background.

**Background removal** — Auto reads the key colour from the four corners; or pick
one with the eyedropper. Tolerance, edge softening, and a contiguous toggle: on, it
only eats background connected to the border, so a colour that also appears inside
the subject survives; off, it removes that colour everywhere. The Erase and Restore
brushes fix whatever the automatic pass got wrong — brush marks are stored in
source-image coordinates, so they hold when you change canvas, scale or format,
and the most recently drawn stroke over a pixel wins.

**Drawing** — marker, scribble or highlighter, any colour, on a layer above the
artwork. Nib width is a percentage of the basis dimension like everything else, and
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

## Tools on the artboard

The strip above the canvas switches what a drag does. Keyboard: `V` move, `B` draw,
`E` erase, `R` restore, `I` pick colour. A ring follows the pointer at the nib's
true size.

Drawing is cheap because the rings and the treated artwork are cached as one base
layer, so a drag redraws only the strokes on top: about 0.4ms a frame instead of
re-running the distance transform and the halftone screen.

The background brushes cannot work that way, since punching a hole in the photo
changes the silhouette and therefore everything downstream. They paint a live
trail on an overlay while you drag and commit once on release.

## Interface

Light, compact, and built on the project palette. None of the five colours pass
4.5:1 as text on white, so they are used at full strength as fills with dark text
on top, and small coloured text uses a same-hue variant darkened to 4.5:1. One job
each: yellow the primary action, teal anything interactive, pink the active tool
and the computed pixel values, green the format-match confirmation, red errors and
destructive actions.

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
