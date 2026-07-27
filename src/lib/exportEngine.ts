import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function exportToExcel(data: any[], filename: string, role: 'SUPER_ADMIN' | 'ADMIN' = 'ADMIN') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Basic headers based on keys of the first object
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    
    // Role-based metadata appending
    if (role === 'SUPER_ADMIN') {
      headers.push('_tenant_id', '_client_ip', '_device_info');
    }
    
    worksheet.addRow(headers);
    
    data.forEach(item => {
      const row = headers.map(header => item[header] || 'N/A');
      worksheet.addRow(row);
    });
  }

  // Generate buffer (Client-side usage would require file-saver)
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportToWord(title: string, content: string) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: title, bold: true, size: 32 }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun(content),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

// HWPX Export - Basic Skeleton
// HWPX is a zipped OWPML format. For real world usage, integrating an MCP addon 
// or an external microservice/library that handles the complex XML generation is recommended.
export async function exportToHWPX(title: string, data: any) {
  console.log('HWPX Export Triggered:', title);
  // 1. Generate OWPML XML strings (Contents/section0.xml, etc.)
  // 2. Zip the XML files using JSZip
  // 3. Return the ArrayBuffer or Blob
  throw new Error('HWPX generation is not yet fully implemented. Using basic skeleton.');
}
