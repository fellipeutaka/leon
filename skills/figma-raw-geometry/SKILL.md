---
name: figma-raw-geometry
description: >
  Raw Figma node geometry for Figma-to-code work. Use when exact local bounds,
  page-space bounds, transforms, rotation, visibility, or effective layer
  opacity are required; when reconstructing Smart Animate across component
  variants; or when Figma MCP output is unavailable, incomplete, or too large.
---

Use the Figma REST API as a measurement source. Return numeric measurements with
field provenance and keep implementation assumptions separate from fetched
values. A screenshot describes one rendered state; the node JSON exposes the
state's geometry, transforms, visibility, and layer opacity.

## 1. Define the states and targets

Collect:

- the file key, decoded from the Figma URL;
- the containing frame or component-set id;
- every target state or variant id;
- the target layer mapping for each state; and
- the ordered prototype edges when reconstructing animation.

Decode a URL's `node-id=123-456` as the Figma id `123:456`, including URL
percent-decoding when necessary. Do not infer prototype order from variant
names. If an available Figma MCP metadata tool can enumerate a component set,
use it. Otherwise, request the component-set node with the REST nodes endpoint
and `depth=1` to discover its direct variant children.

Map corresponding layers by structural path plus name. Include a sibling index
when names repeat; do not assume that child node ids are shared between
component variants.

Done when every requested state has a file key, root id, containing-frame id,
and an unambiguous target-layer mapping, or an explicit unresolved reason.

## 2. Authenticate outside the conversation

Read `FIGMA_TOKEN` from the process environment. The token needs Figma's
`file_content:read` scope and access to the target file.

If the variable is absent, ask the user to set it in their own shell or secret
manager and then confirm that it is available. Keep the secret out of chat,
files, command output, and commits. The agent cannot export a value into the
user's parent shell, so do not ask the user to paste the token into the
conversation.

Done when a usable environment token is available without the token value being
printed or persisted by this workflow.

## 3. Fetch the node JSON in bounded bulk

Request all required ids together when the URL and response are practical. If
the target set is too large, split it into bounded batches and pin the same
Figma `version` for every batch. Use `depth` to avoid fetching irrelevant
descendants; add `geometry=paths` only when vector path data is needed.

For example, with `FILE_KEY`, comma-separated `IDS`, and an optional `DEPTH`
already prepared:

```bash
umask 077
CACHE_PATH="$(mktemp "${TMPDIR:-/tmp}/figma-geometry.XXXXXX")"
DEPTH_ARGS=()

if [ -n "${DEPTH:-}" ]; then
  DEPTH_ARGS=(--data-urlencode "depth=$DEPTH")
fi

curl --fail-with-body --silent --show-error \\
  -H "X-Figma-Token: $FIGMA_TOKEN" \\
  --get "https://api.figma.com/v1/files/$FILE_KEY/nodes" \\
  --data-urlencode "ids=$IDS" \\
  "${DEPTH_ARGS[@]}" \\
  --output "$CACHE_PATH"
```

Keep the response in a permission-restricted temporary file for the task. Do
not re-fetch while inspecting it. Validate that the response is JSON, record
the returned file `version`, and treat a null entry in `nodes` as a missing node
rather than as an empty node.

Done when every requested id is present and non-null in a validated response,
the cache path is known, and the response version is recorded.

## 4. Normalize geometry and visibility

Walk each `nodes["<id>"].document` subtree recursively and index nodes by id
and structural path. For every target, record the raw fields that exist:

- `id`, `name`, `type`, and the structural path;
- local `x`, `y`, `width`, and `height` when present;
- `rotation`, defaulting an omitted value to `0` degrees;
- `absoluteBoundingBox` and, when visual extents matter,
  `absoluteRenderBounds`;
- `relativeTransform` when available and relevant; and
- `visible` and node `opacity`, defaulting omitted opacity to `1`.

Treat `absoluteBoundingBox` as a page-space, axis-aligned bounding box. It
already reflects ancestor scaling and rotation, but it is not the node's
oriented rectangle: after rotation, its width and height describe the enclosing
box. Use local geometry plus rotation or transform-matrix data for CSS geometry;
use the absolute bounding box for page-space extents and diagnostics.

Figma node rotation is in degrees. For a simple Figma rotation represented by
CSS `rotate()`, negate the degree value at the CSS boundary; Figma's positive
design-panel direction is opposite to CSS's direction. Preserve the transform
origin, flips, skew, and matrix data when those affect placement instead of
assuming rotation alone is sufficient.

Compute effective layer opacity as the product of node opacities along the
ancestor chain, and mark the layer hidden when any ancestor is invisible. Call
this *effective layer opacity*: paint alpha, masks, blend modes, and effects can
still change rendered pixel alpha. A null bounding box or invisible node is an
explicit state, not a zero-sized measurement.

Done when every target/state has each requested field traced to JSON or marked
missing/null, with its coordinate basis, rotation units, visibility, and
effective layer opacity recorded.

## 5. Convert coordinates only after choosing a basis

Use pixel values in the node's local or containing-frame coordinate system as
the canonical implementation values. Record the basis alongside every value;
page-space and frame-local coordinates are not interchangeable.

The following conversion is valid only when the frame and target are
axis-aligned in the same coordinate basis:

```text
left% = (node.absoluteBoundingBox.x - frame.absoluteBoundingBox.x)
        / frame.absoluteBoundingBox.width * 100
top%  = (node.absoluteBoundingBox.y - frame.absoluteBoundingBox.y)
        / frame.absoluteBoundingBox.height * 100
```

For rotated, skewed, flipped, or otherwise transformed frames, express the
node through the transform matrix in the frame's local basis before converting
to percentages. Percentages are a responsive implementation choice, not proof
of pixel accuracy; retain the pixel measurements even when percentages are
requested.

Done when every converted value names its basis, unit, and assumptions, and no
percentage was derived from incompatible rotated bounding boxes.

## 6. Reconstruct Smart Animate as transition segments

Build the state graph from prototype reactions/interactions when available.
Use an available motion-context tool only when it is actually exposed; if the
prototype graph cannot be recovered, ask for the ordered state edges before
diffing variants.

For each ordered edge:

1. Map corresponding layers by structural path and name, not by variant-local
   ids alone.
2. Record the source and destination local geometry, transform, visibility,
   and effective layer opacity. Keep absolute bounding boxes as diagnostics,
   not as the sole interpolation primitive.
3. Record the transition type, duration, easing, trigger, and delay exactly as
   returned. Convert units only at the implementation boundary.
4. Represent each edge as one transition segment. Derive CSS keyframe offsets
   from cumulative segment durations only when the implementation needs one
   combined timeline.
5. Handle appearing, disappearing, renamed, and unmapped layers explicitly.
   A spring or other transition that cannot be represented by a cubic-bezier
   must be preserved with a spring-capable implementation or reported as an
   approximation.

Smart Animate matches corresponding layers and interpolates their properties;
it is not equivalent to turning every bounding-box difference into a keyframe.

Done when every prototype edge has a verified source/destination mapping,
transition metadata, mapped-layer property changes, and deliberate handling for
unmapped or non-CSS-representable behavior.

## Output

Return a compact table containing:

- file key and Figma version;
- state, node id, name, type, and structural path;
- local geometry and transform fields;
- page-space `absoluteBoundingBox` and optional render bounds;
- visibility and effective layer opacity; and
- assumptions, missing fields, and unsupported transform or animation cases.

For animation work, add one row per ordered transition segment with its source
state, destination state, duration, easing, trigger, and mapped-layer changes.
