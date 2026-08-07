# SUMBYCOLOR

A Google Sheets custom Apps Script function that computes cells by their fill color

## Setup

1. Open the spreadsheet -> **Extensions -> Apps Script**
2. Paste the contents of [`Code.gs`](Code.gs), replacing anything in the editor
3. Save
4. In the function dropdown at the top, select **`createOnChangeTrigger`** and click **Run**
5. Authorize the script when prompted (it needs permission to write the dummy timestamp)

## Usage

### Format:
```
=SUMBYCOLOR(A1:A20, "A1:A20", "B1", $Z$1000)
```

| Arg | Type | Purpose |
| --- | --- | --- |
| 1 | Live reference | Provides the values and the dependency that catches cell value edits |
| 2 | String | The same range used to read fill colors |
| 3 | String | The cell whose fill color is used as a sample to match against |
| 4 | Reference | The dummy refresh cell. Is always `$Z$1000` |

Arguments 1 and 2 must cover the same cells.

### Cross sheet usage

The string arguments resolve against whatever sheet is active at recalculation time, which isn't necessarily the sheet the formula lives on. If needed, add the sheet name and an exclamation mark:

```
=SUMBYCOLOR(SheetName!A1:A20, "SheetName!A1:A20", "SheetName!B1", $Z$1000)
```

Required when the formula and the data are on different tabs

### Example

Column B holds values, some cells filled green, some yellow. B1 is green, B2 is yellow:

```
=SUMBYCOLOR(B3:B13, "B3:B13", "B1", $Z$1000) -> sum of green cells
=SUMBYCOLOR(B3:B13, "B3:B13", "B2", $Z$1000) -> sum of yellow cells
```

## Details

Sheets decides when to rerun a custom function by watching its arguments* Two things follow from that:

Formatting is invisible to it. Repainting a cell green doesn't change any argument, so the formula keeps returning its cached result. There's no such thing as an `onFormat` trigger for custom functions.

String arguments create no dependency. The common implementation takes the range as a string (`=SUMBYCOLOR("A1:A20", "B1")`) because `getBackgrounds()` needs A1 notation. But `"A1:A20"` is just text. Sheets has no idea it refers to cells, so editing those cells triggers nothing either.

This repo solves both:

| Problem | Solution |
| --- | --- |
| Value edits don't refresh | Pass the range twice. Once as a live reference (creates the dependency), once as a string (reads the colors) |
| Color changes don't refresh | An `onChange` trigger writes a timestamp to a dummy cell that every formula references as its 4th argument |

### How the refresh trigger works

`handleChange` fires on spreadsheet changes and writes the current timestamp to `Z1000` on every sheet. Since each `SUMBYCOLOR` call takes `$Z$1000` as an argument, that write changes an argument, which forces a recalculation.

## Limitations

`Z1000` must be reserved on every sheet. Pick a different cell by editing the `REFRESH_CELL` constant, and update the 4th argument in the formulas to match.

Conditional formatting is invisible. A cell colored by a conditional formatting rule reads as its underlying fill, not what you see on screen.

No fill counts as white. Unfilled cells return `#ffffff`, identical to cells you deliberately painted white. Matching against a white reference cell will sum both.

Some operations report as `OTHER`. Certain bulk paste-format and undo operations aren't consistently classified as `FORMAT`. If you find a case that doesn't refresh, edit any cell or reload the sheet to forces a recalculation manually.

Large ranges are slow. Each call makes two `getRange` round-trips. Dozens of these across a workbook will be noticeable, since custom functions cap out at 30 seconds.
