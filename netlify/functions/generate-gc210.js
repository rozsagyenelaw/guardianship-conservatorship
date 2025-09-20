// netlify/functions/generate-gc210.js
const { PDFDocument, rgb } = require('pdf-lib');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const data = JSON.parse(event.body);
    console.log('Received data for GC-210:', data);

    // For now, we'll create a simple PDF
    // Later, you'll replace this with your actual form filling logic
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    // Add some text to verify it's working
    page.drawText(`GC-210 Petition for Guardianship`, {
      x: 50,
      y: height - 100,
      size: 20,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Client: ${data.clientInfo?.name || 'Unknown'}`, {
      x: 50,
      y: height - 150,
      size: 14,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Minor: ${data.minorInfo?.name || 'Not Specified'}`, {
      x: 50,
      y: height - 180,
      size: 14,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Case Number: ${data.clientInfo?.caseNumber || 'Not Assigned'}`, {
      x: 50,
      y: height - 210,
      size: 14,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: height - 240,
      size: 12,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    
    // Convert to base64 for returning
    const base64 = Buffer.from(pdfBytes).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        documentUrl: dataUrl,
        documentId: `GC210-${Date.now()}`,
        message: 'GC-210 generated successfully'
      })
    };
  } catch (error) {
    console.error('Error generating GC-210:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to generate document',
        details: error.message 
      })
    };
  }
};
