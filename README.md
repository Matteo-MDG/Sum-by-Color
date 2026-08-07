# SUMBYCOLOR

A Google Sheets custom function that sums cells by their fill color — and actually recalculates when you'd expect it to.

Google Sheets has no built-in way to sum by fill color, and the usual Apps Script workarounds have two problems: they don't update when a cell's *value* changes, and they don't update when a cell's *color* changes. This handles both.

## Why this is harder than it looks

Sheets decides when to re-run a custom function by watching its **arguments**. Two things follow from that:

**Formatting is invisible to it.** Repainting a cell green doesn't change any argument, so the formula keeps returning its cached result. There's no such thing as an `onFormat` trigger for custom functions.

**String arguments create no dependency.** The common implementation takes the range as a string (`=SUMBYCOLOR("A1:A20", "B1")`) because `getBackgrounds()` needs A1 notation. But `"A1:A20"` is just text — Sheets has no idea it refers to cells, so editing those cells triggers nothing either.

This repo solves both:

| Problem | Solution |
| --- | --- |
| Value edits don't refresh | Pass the range **twice** — once as a live reference (creates the dependency), once as a string (reads the colors) |
| Color changes don't refresh | An `onChange` trigger writes a timestamp to a dummy cell that every formula references as its 4th argument |

## Setup

1. Open your spreadsheet → **Extensions → Apps Script**
2. Paste the contents of [`Code.gs`](Code.gs), replacing anything in the editor
3. Save
4. In the function dropdown at the top, select **`createOnChangeTrigger`** and click **Run**
5. Authorize the script when prompted (it needs permission to write the timestamp)

Step 4 only needs to happen once per spreadsheet. Running it repeatedly installs duplicate triggers — if that happens, clean them up under the clock icon in the left sidebar.

## Usage

```
=SUMBYCOLOR(A1:A20, "A1:A20", "B1", $Z$1000)
```

| Arg | Type | Purpose |
| --- | --- | --- |
| 1 | Live reference | Supplies the values, and the dependency that catches value edits |
| 2 | String | The same range, used to read fill colors |
| 3 | String | The cell whose fill color you're matching against |
| 4 | Reference | The dummy refresh cell — always `$Z$1000`, absolute |

Arguments 1 and 2 must cover the same cells. The duplication is the price of `getBackgrounds()` requiring A1 notation.

### Cross-sheet usage

The string arguments resolve against whatever sheet is active at recalculation time, which isn't necessarily the sheet the formula lives on. Qualify them with a sheet name and an exclamation mark:

```
=SUMBYCOLOR(Data!A1:A20, "Data!A1:A20", "Data!B1", $Z$1000)
```

Required when the formula and the data are on different tabs, and harmless otherwise — worth doing by default.

### Example

Column B holds values, some cells filled green, some yellow. B1 is green, B2 is yellow:

```
=SUMBYCOLOR(B3:B13, "B3:B13", "B1", $Z$1000)    → sum of green cells
=SUMBYCOLOR(B3:B13, "B3:B13", "B2", $Z$1000)    → sum of yellow cells
```

## How the refresh trigger works

`handleChange` fires on spreadsheet changes and writes the current timestamp to `Z1000` on every sheet. Since each `SUMBYCOLOR` call takes `$Z$1000` as an argument, that write changes an argument, which forces a recalculation.

Two details matter:

**It touches every sheet.** The `onChange` event object gives you `changeType`, `source`, `user`, and `authMode` — but no range and no sheet. There's no way to know *where* the color change happened, so writing to all sheets is the only reliable option.

**It filters to `FORMAT` only.** The handler's own `setValue` calls come back as another change event, which would loop forever. Script writes report as `EDIT` or `OTHER`; paint-bucket fills report as `FORMAT`. Filtering to `FORMAT` means the echo can never re-enter the handler — no timers, no debounce windows, no dead zones where a real color change gets swallowed.

The `=SUMBYCOLOR` check inside the loop is a separate safeguard: it stops the trigger from overwriting a real formula if one ever ends up in `Z1000`. It isn't loop protection, since the value being written is a timestamp rather than a formula.

## Limitations

**`Z1000` is reserved.** On every sheet. Pick a different cell by editing the `REFRESH_CELL` constant, and update the 4th argument in your formulas to match.

**Conditional formatting is invisible.** `getBackground()` returns the manually applied fill only. A cell colored by a conditional formatting rule reads as its underlying fill, not what you see on screen.

**No fill counts as white.** Unfilled cells return `#ffffff`, identical to cells you deliberately painted white. Matching against a white reference cell will sum both.

**Colors must match exactly.** Comparison is on the hex string, so two visually similar greens from different palette picks won't match. Use the paint bucket's custom color field if you need precision.

**Some operations report as `OTHER`.** Certain bulk paste-format and undo operations aren't consistently classified as `FORMAT`. If you find a case that doesn't refresh, add `'OTHER'` back to the filter along with a short (~2 second) debounce to absorb the echo. Editing any cell or reloading the sheet also forces a recalculation manually.

**Large ranges are slow.** Each call makes two `getRange` round-trips. Dozens of these across a workbook will be noticeable, since custom functions cap out at 30 seconds.

## License

MIT — see [LICENSE](LICENSE).
