/**
 * Shared utilities for lead memo formatting, copying, and company info extraction.
 */

interface MemoSection {
  key: string;
  title: string;
  content: string;
}

interface MemoContent {
  sections?: MemoSection[];
  memo_type?: string;
  branding?: string;
  company_name?: string;
  company_address?: string;
  company_website?: string;
  company_phone?: string;
}

const BRANDING_LABELS: Record<string, string> = {
  sourceco: 'SourceCo',
  new_heritage: 'New Heritage Capital',
  renovus: 'Renovus Capital',
  cortec: 'Cortec Group',
};

/**
 * Extract company info from memo content.
 * Falls back to parsing header_block / contact_information sections
 * for memos generated before company metadata was added.
 */
export function extractCompanyInfo(content: Record<string, unknown>): {
  company_name: string;
  company_address: string;
  company_website: string;
  company_phone: string;
} {
  const memo = content as MemoContent;

  // Use top-level metadata if available
  if (memo.company_name) {
    return {
      company_name: memo.company_name || '',
      company_address: memo.company_address || '',
      company_website: memo.company_website || '',
      company_phone: memo.company_phone || '',
    };
  }

  // Fallback: parse from sections for older memos
  const sections = memo.sections || [];
  const headerSection = sections.find((s) => s.key === 'header_block');
  const contactSection = sections.find((s) => s.key === 'contact_information');
  const result = { company_name: '', company_address: '', company_website: '', company_phone: '' };

  if (headerSection) {
    // Try to extract company name from the first line
    const firstLine = headerSection.content.split('\n')[0]?.replace(/\*\*/g, '').trim();
    if (firstLine && !firstLine.toLowerCase().includes('confidential')) {
      result.company_name = firstLine;
    }
  }

  if (contactSection) {
    const lines = contactSection.content.split('\n').map((l) => l.trim());
    for (const line of lines) {
      const clean = line.replace(/\*\*/g, '').replace(/^[-*]\s*/, '');
      if (clean.match(/^https?:\/\/|^www\./i) || clean.toLowerCase().includes('website:')) {
        result.company_website = clean.replace(/^website:\s*/i, '').trim();
      } else if (
        clean.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/) ||
        clean.toLowerCase().includes('phone:')
      ) {
        result.company_phone = clean.replace(/^phone:\s*/i, '').trim();
      } else if (clean.match(/,\s*[A-Z]{2}\b/) && !result.company_address) {
        result.company_address = clean.replace(/^address:\s*/i, '').trim();
      }
    }
  }

  return result;
}

/**
 * Convert memo content to clean plain text suitable for copying into an AI.
 * No markdown, no HTML — just clean, readable text with section headings.
 */
export function memoToPlainText(content: Record<string, unknown>, branding?: string): string {
  const memo = content as MemoContent;
  const sections = memo.sections || [];
  const brandName =
    BRANDING_LABELS[branding || memo.branding || 'sourceco'] || branding || 'SourceCo';
  const company = extractCompanyInfo(content);
  const isAnonymous = memo.memo_type === 'anonymous_teaser';
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [];

  // Letterhead
  lines.push(brandName.toUpperCase());
  lines.push('');

  // Company info — anonymous teasers only show project codename
  if (isAnonymous) {
    if (company.company_name) {
      lines.push(company.company_name);
      lines.push('');
    }
  } else {
    if (company.company_name) lines.push(company.company_name);
    if (company.company_address) lines.push(company.company_address);
    if (company.company_website) lines.push(company.company_website);
    if (company.company_phone) lines.push(company.company_phone);
    if (company.company_name || company.company_address || company.company_website) {
      lines.push('');
    }
  }

  // Memo type and date
  lines.push(isAnonymous ? 'ANONYMOUS TEASER' : 'CONFIDENTIAL LEAD MEMO');
  lines.push(dateStr);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Sections — skip header_block and contact_information since info is above
  for (const section of sections) {
    if (section.key === 'header_block' || section.key === 'contact_information') continue;

    lines.push(section.title.toUpperCase());
    lines.push('');
    // Strip markdown formatting for clean copy
    const cleanContent = stripMarkdown(section.content);
    lines.push(cleanContent);
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Strip markdown formatting from text while preserving structure.
 * Converts bold/italic markers to plain text and keeps bullet points as dashes.
 */
function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/^#+\s+/gm, '') // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .trim();
}

/**
 * Copy text to the clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Get the branding display label.
 */
export function getBrandingLabel(branding: string): string {
  return BRANDING_LABELS[branding] || branding;
}
