import { describe, it, expect } from 'vitest';
import { DEFAULT_PAYNET_QR_URL, DEFAULT_THEME_CONFIG, PAYMENT_METHODS } from '@telegram-commerce/config';

describe('Paynet Xolis Configuration & Standards', () => {
  it('should have a valid Central Bank / Soliq QR-online Paynet link configured', () => {
    expect(DEFAULT_PAYNET_QR_URL).toContain('https://app.paynet.uz/qr-online/');
    expect(DEFAULT_PAYNET_QR_URL).toContain('qr-online.uz');
    expect(DEFAULT_PAYNET_QR_URL).toContain('PAYNET');
  });

  it('should include PAYNET_XOLIS in supported payment methods', () => {
    expect(PAYMENT_METHODS.PAYNET_XOLIS).toBe('PAYNET_XOLIS');
    expect(PAYMENT_METHODS.TELEGRAM_STARS).toBe('TELEGRAM_STARS');
    expect(PAYMENT_METHODS.STRIPE).toBe('STRIPE');
    expect(PAYMENT_METHODS.MOCK).toBe('MOCK');
  });

  it('should have Paynet enabled by default in storefront theme configuration', () => {
    expect(DEFAULT_THEME_CONFIG.paynetEnabled).toBe(true);
    expect(DEFAULT_THEME_CONFIG.paynetQrUrl).toBe(DEFAULT_PAYNET_QR_URL);
  });
});

describe('Bulk Product CSV Export & Parsing', () => {
  function parseCsvText(text: string) {
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(headerLine).map((h) => h.toLowerCase().replace(/["']/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      rows.push({
        title: cols[1]?.trim() || '',
        price: parseFloat(cols[3] || '0'),
        stock: parseInt(cols[4] || '0', 10),
      });
    }
    return rows;
  }

  it('should parse UTF-8 BOM CSV with semicolon delimiter', () => {
    const csv = '\uFEFF"ID";"Название";"Категория";"Цена";"Остаток"\r\n"";"Худи Tashkent";"Одежда";"420000";"35"';
    const parsed = parseCsvText(csv);
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe('Худи Tashkent');
    expect(parsed[0].price).toBe(420000);
    expect(parsed[0].stock).toBe(35);
  });

  it('should handle quotes and special characters safely', () => {
    const csv = '"ID";"Название";"Категория";"Цена";"Остаток"\r\n"";"Футболка ""Heavyweight""";"Одежда";"190000";"50"';
    const parsed = parseCsvText(csv);
    expect(parsed[0].title).toBe('Футболка "Heavyweight"');
    expect(parsed[0].price).toBe(190000);
  });
});
