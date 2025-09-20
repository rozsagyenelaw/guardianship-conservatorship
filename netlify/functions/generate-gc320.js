// netlify/functions/generate-gc320.js
const { PDFDocument, rgb } = require('pdf-lib');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    page.drawText(`GC-320 Citation for Conservatorship`, {
      x: 50,
      y: height - 100,
      size: 20,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`To: ${data.conservateeInfo?.name || 'Unknown'}`, {
      x: 50,
      y: height - 150,
      size: 14,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Petitioner: ${data.clientInfo?.name || 'Not Specified'}`, {
      x: 50,
      y: height - 180,
      size: 14,
      color: rgb(0, 0, 0)
    });

    const pdfBytes = await pdfDoc.save();
    const base64 = Buffer.from(pdfBytes).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        documentUrl: dataUrl,
        documentId: `GC320-${Date.now()}`,
        message: 'GC-320 generated successfully'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate document' })
    };
  }
};
