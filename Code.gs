/**
 * Usage: =SUMBYCOLOR(A1:A20, "A1:A20", "B1", $Z$1000)
 *
 * arg 1: live range reference, supplies values and the dependency that
 *        makes Sheets recalculate on value edits
 * arg 2: same range as a string. used only to read fill colors
 * arg 3: the color source cell as a string
 * arg 4: dummy refresh cell touched by the onChange trigger
 * 
 * the two string arguments are resolved against whatever sheet happens to be
 * active at recalc time
 * 
 * =SUMBYCOLOR(SheetName!A1:A20, "SheetName!A1:A20", "SheetName!B1", $Z$1000)
 * required if the formula and the data live on different sheets
 */
function SUMBYCOLOR(values, sumRangeA1, colorCellA1, refreshCell) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetColor = ss.getRange(colorCellA1).getBackground();
  var colors = ss.getRange(sumRangeA1).getBackgrounds();

  // a single cell reference arrives as a scalar, not a 2D array
  if (!Array.isArray(values)) values = [[values]];

  var total = 0;
  for (var i = 0; i < colors.length; i++) {
    for (var j = 0; j < colors[i].length; j++) {
      if (colors[i][j] === targetColor) {
        var v = (values[i] || [])[j];
        if (typeof v === 'number') total += v;
      }
    }
  }
  return total;
}

var REFRESH_CELL = 'Z1000';

/**
 * installable onChange trigger handler.
 * fires on format changes (e.g. using the fill-color paint bucket) and
 * touches a dummy cell (Z1000) on every sheet in the spreadsheet, so any
 * SUMBYCOLOR formula referencing its own sheet's $Z$1000 recalculates
 * automatically no matter which tab the color change happened on.
 */
function handleChange(e) {
  // only format. the setValue below shows as edit/other, so
  // ignoring those is what prevents a self trigger loop.
  if (e.changeType !== 'FORMAT') return;

  var sheets = SpreadsheetApp.getActive().getSheets();
  var now = new Date();

  for (var i = 0; i < sheets.length; i++) {
    var cell = sheets[i].getRange(REFRESH_CELL);

    // don't clobber a real formula if someone put one in the dummy cell
    if (cell.getFormula().toUpperCase().indexOf('=SUMBYCOLOR') === 0) continue;

    cell.setValue(now);
  }
}

/**
 * run this once manually from the Apps Script editor to install the
 * onChange trigger.
 */
function createOnChangeTrigger() {
  ScriptApp.newTrigger('handleChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();
}