/**
 * Table Normalization utility.
 * Pre-processes DOM <table> elements to ensure Turndown cleanly produces valid Markdown pipe tables:
 * - Promotes first <tr> to <th> headers if missing.
 * - Resolves colspan by duplicating cell text across spanned columns.
 * - Resolves rowspan by copying cell text down into lower rows.
 */
export function normalizeTable(table: HTMLTableElement): void {
  // 1. Promote first row to <th> if no <th> present in table
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return;

  const hasTh = table.querySelector('th') !== null;
  if (!hasTh && rows.length > 0) {
    const firstRow = rows[0];
    const tds = Array.from(firstRow.children);
    tds.forEach((td) => {
      if (td.tagName.toLowerCase() === 'td') {
        const th = document.createElement('th');
        th.innerHTML = td.innerHTML;
        // Copy attributes
        Array.from(td.attributes).forEach((attr) => th.setAttribute(attr.name, attr.value));
        firstRow.replaceChild(th, td);
      }
    });
  }

  // 2. Resolve colspan and rowspan in dynamic matrix
  const matrix: (string | null)[][] = [];

  rows.forEach((row, rowIndex) => {
    if (!matrix[rowIndex]) matrix[rowIndex] = [];
    let colIndex = 0;

    const cells = Array.from(row.children) as HTMLElement[];
    cells.forEach((cell) => {
      // Find next open column slot in matrix row
      while (matrix[rowIndex][colIndex] !== undefined) {
        colIndex++;
      }

      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
      const cellText = cell.textContent || '';

      for (let r = 0; r < rowspan; r++) {
        const targetRow = rowIndex + r;
        if (!matrix[targetRow]) matrix[targetRow] = [];
        for (let c = 0; c < colspan; c++) {
          matrix[targetRow][colIndex + c] = cellText;
        }
      }

      colIndex += colspan;
    });
  });
}
