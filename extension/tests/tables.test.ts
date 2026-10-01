import { describe, it, expect } from 'vitest';
import { normalizeTable } from '../src/extract/tables';

describe('normalizeTable', () => {
  it('promotes first td row to th when th is missing', () => {
    const table = document.createElement('table');
    table.innerHTML = `
      <tr><td>Item</td><td>Price</td></tr>
      <tr><td>Apple</td><td>$1.00</td></tr>
    `;
    normalizeTable(table);
    const ths = table.querySelectorAll('th');
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe('Item');
    expect(ths[1].textContent).toBe('Price');
  });
});
