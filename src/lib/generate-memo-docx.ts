/**
 * Generate a .docx file from AI-generated memo sections.
 *
 * Uses the `docx` npm package for client-side Word document generation.
 * The output is a properly formatted .docx that opens in Microsoft Word
 * or Google Docs for editing before final PDF conversion.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

interface MemoSection {
  key: string;
  title: string;
  content: string;
}

interface GenerateMemoDocxParams {
  sections: MemoSection[];
  memoType: 'anonymous_teaser' | 'full_memo';
  dealTitle: string;
  branding: string;
}

/**
 * Convert memo sections into a downloadable .docx file.
 */
export async function generateMemoDocx({
  sections,
  memoType,
  dealTitle,
  branding,
}: GenerateMemoDocxParams): Promise<void> {
  const isAnonymous = memoType === 'anonymous_teaser';
  const memoLabel = isAnonymous ? 'Anonymous Teaser' : 'Confidential Lead Memo';
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build document children
  const children: Paragraph[] = [];

  // ─── Header Block ───
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: branding,
          bold: true,
          size: 28,
          font: 'Arial',
          color: '333333',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: memoLabel.toUpperCase(),
          size: 18,
          font: 'Arial',
          color: '888888',
          characterSpacing: 100,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: dateStr,
          size: 18,
          font: 'Arial',
          color: '888888',
        }),
      ],
    }),
    // Confidential disclaimer
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      children: [
        new TextRun({
          text: 'CONFIDENTIAL — FOR INTENDED RECIPIENT ONLY',
          size: 16,
          font: 'Arial',
          color: 'CC0000',
          italics: true,
        }),
      ],
    })
  );

  // ─── Memo Sections ───
  for (const section of sections) {
    // Section heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        },
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 24,
            font: 'Arial',
            color: '1A1A2E',
          }),
        ],
      })
    );

    // Section content — parse markdown-like formatting
    const contentParagraphs = parseContentToParagraphs(section.content);
    children.push(...contentParagraphs);
  }

  // ─── Data Needed Flags ───
  const dataNeededSections = sections.filter(s =>
    s.content.includes('[DATA NEEDED:') || s.content.includes('[VERIFY:')
  );

  if (dataNeededSections.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 100 },
        children: [
          new TextRun({
            text: 'Items Requiring Review',
            bold: true,
            size: 24,
            font: 'Arial',
            color: 'CC6600',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: 'The following items were flagged during AI generation and require human review:',
            size: 20,
            font: 'Arial',
            color: '666666',
            italics: true,
          }),
        ],
      })
    );

    for (const section of dataNeededSections) {
      const flags = extractFlags(section.content);
      for (const flag of flags) {
        children.push(
          new Paragraph({
            spacing: { after: 50 },
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: `${section.title}: `,
                bold: true,
                size: 20,
                font: 'Arial',
              }),
              new TextRun({
                text: flag,
                size: 20,
                font: 'Arial',
                color: 'CC6600',
              }),
            ],
          })
        );
      }
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const fileName = isAnonymous
    ? `Anonymous_Teaser_${sanitizeFileName(dealTitle)}.docx`
    : `Lead_Memo_${sanitizeFileName(dealTitle)}.docx`;
  saveAs(blob, fileName);
}

// ─── Content Parsing Helpers ───

function parseContentToParagraphs(content: string): Paragraph[] {
  if (!content) return [];

  const paragraphs: Paragraph[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 50 },
          children: parseInlineFormatting(trimmed.slice(2)),
        })
      );
      continue;
    }

    // Table rows (basic markdown table support)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator rows
      if (trimmed.match(/^\|[\s\-|]+\|$/)) continue;
      // Parse as a regular paragraph for now (tables in docx are complex)
      const cells = trimmed.split('|').filter(c => c.trim());
      paragraphs.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: cells.join('  |  '),
              size: 20,
              font: 'Arial',
            }),
          ],
        })
      );
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        spacing: { after: 120 },
        children: parseInlineFormatting(trimmed),
      })
    );
  }

  return paragraphs;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Simple bold/italic parser
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // Bold text
      runs.push(
        new TextRun({
          text: match[2],
          bold: true,
          size: 20,
          font: 'Arial',
        })
      );
    } else if (match[3]) {
      // Italic text
      runs.push(
        new TextRun({
          text: match[3],
          italics: true,
          size: 20,
          font: 'Arial',
        })
      );
    } else if (match[4]) {
      // Regular text — check for [DATA NEEDED:] and [VERIFY:] flags
      const flagText = match[4];
      const flagRegex = /(\[DATA NEEDED:[^\]]*\]|\[VERIFY:[^\]]*\])/g;
      let lastIndex = 0;
      let flagMatch;

      while ((flagMatch = flagRegex.exec(flagText)) !== null) {
        if (flagMatch.index > lastIndex) {
          runs.push(
            new TextRun({
              text: flagText.slice(lastIndex, flagMatch.index),
              size: 20,
              font: 'Arial',
            })
          );
        }
        runs.push(
          new TextRun({
            text: flagMatch[1],
            size: 20,
            font: 'Arial',
            color: 'CC6600',
            bold: true,
            highlight: 'yellow',
          })
        );
        lastIndex = flagMatch.index + flagMatch[0].length;
      }

      if (lastIndex < flagText.length) {
        runs.push(
          new TextRun({
            text: flagText.slice(lastIndex),
            size: 20,
            font: 'Arial',
          })
        );
      }
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: 20, font: 'Arial' }));
  }

  return runs;
}

function extractFlags(content: string): string[] {
  const flags: string[] = [];
  const regex = /\[(DATA NEEDED|VERIFY):\s*([^\]]*)\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    flags.push(`[${match[1]}: ${match[2]}]`);
  }
  return flags;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}
