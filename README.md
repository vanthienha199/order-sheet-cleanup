# Halvorsen Office Supply, order sheet cleanup

This is an Apps Script for Google Sheets that turns a messy order export into a clean table, builds a summary tab with charts, and emails a weekly report every Monday morning. The cleanup handles dates in five formats, prices written as "$1,204.50" or "USD 89", uppercase and misspelled emails, region nicknames, status typos, duplicate orders, blank rows and totals that do not match quantity times price. Rows it cannot fix are kept and highlighted with a note, never dropped.

To use it, open a Google Sheet, go to Extensions, then Apps Script, and paste the four files from `apps-script/` (or push them with clasp). Reload the sheet, then use the new "Order tools" menu: Load sample data, Run everything, or each step on its own, plus "Schedule weekly email" to install the Monday trigger. Put the report recipients in the Settings tab.

The cleaning and summary logic lives in `Clean.gs` with no Google calls, so it also runs in Node. `npm test` runs 8 checks against the full 323 row sample, and `node tools/local-run.js` writes the cleaned rows as tab separated text.

The sample data is synthetic, for a made up shop called Halvorsen Office Supply, and every email uses reserved example domains (example.com, .example).

`node tools/make-view.js` runs the same `Clean.gs` logic on the sample export and writes `preview/data.js`, then `preview/index.html` shows the result: the cleaned sheet on the left with every changed cell filled yellow, the log of what the script did on the right, and a toggle between the raw export and the cleaned sheet. Rows the script will not guess at are marked in the row gutter and listed first in the log. Everything in the screenshots comes from that run, because the demo Google account blocks unverified scripts, and the page says so in its footer.

![Clean orders table](hero.png)
