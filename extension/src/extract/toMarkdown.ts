import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
import { normalizeTable } from './tables';

export interface ExtractionResult {
  url: string;
  title: string;
  markdown: string;
  tableStats: {
    onPage: number;
    kept: number;
  };
}

export function extractPageContent(): ExtractionResult {
  const docClone = document.cloneNode(true) as Document;
  const onPageTables = document.querySelectorAll('table').length;

  let articleHtml = '';
  let pageTitle = document.title || 'Untitled Page';

  try {
    const reader = new Readability(docClone);
    const parsed = reader.parse();
    if (parsed && parsed.content) {
      articleHtml = parsed.content;
      if (parsed.title) pageTitle = parsed.title;
    } else {
      articleHtml = document.body.innerHTML;
    }
  } catch (e) {
    articleHtml = document.body.innerHTML;
  }

  // Parse HTML into DOM fragment for table normalization
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(articleHtml, 'text/html');

  const tables = parsedDoc.querySelectorAll('table');
  tables.forEach((t) => normalizeTable(t as HTMLTableElement));

  // Configure Turndown
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  turndown.use(gfm);

  let markdown = turndown.turndown(parsedDoc.body.innerHTML);
  const keptTables = (markdown.match(/\|[\s\S]*?\|/g) || []).length > 0 ? tables.length : 0;

  return {
    url: window.location.href,
    title: pageTitle,
    markdown,
    tableStats: {
      onPage: onPageTables,
      kept: keptTables,
    },
  };
}
