// netlify/functions/process-guardianship.js
const { PDFDocument } = require('pdf-lib');

// Helper functions
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
}

function formatCurrency(value) {
  if (!value) return "0.00";
  const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
  return num.toFixed(2);
}

function parseMinors(minorsList) {
  if (typeof minorsList === 'string') {
    return minorsList.split('\n').map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        name: parts[0] || '',
        birthdate: parts[1] || '',
        homePhone: parts[2] || '',
        school: parts[3] || '',
        schoolPhone: parts[4] || '',
        otherPhone: parts[5] || ''
      };
    });
  }
  return minorsList || [];
}

// Transform webhook data from JotForm or other sources
function transformGuardianshipData(webhookData) {
  const personalProperty = parseFloat((webhookData.personal_property_value || '0').toString().replace(/[^0-9.-]/g, '')) || 0;
  const realProperty = parseFloat((webhookData.real_property_value || '0').toString().replace(/[^0-9.-]/g, '')) || 0;
  const totalEstate = personalProperty + realProperty;
  
  // Parse minors list if provided as string
  const minorsList = parseMinors(webhookData.minors_list || webhookData.minor_name);
  const primaryMinor = minorsList[0] || {
    name: webhookData.minor_name || '',
    birthdate: webhookData.minor_birthdate || ''
  };
  
  return {
    // Attorney Information
    attorney: {
      name: webhookData.attorney_name || "ROZSA GYENE, ESQ.",
      bar_number: webhookData.attorney_bar || "208356",
      firm_name: webhookData.firm_name || "LAW OFFICES OF ROZSA GYENE",
      street: webhookData.firm_street || "450 N BRAND BLVD SUITE 600",
      city: webhookData.firm_city || "GLENDALE",
      state: webhookData.firm_state || "CA",
      zip: webhookData.firm_zip || "91203",
      phone: webhookData.firm_phone || "818-291-6217",
      fax: webhookData.firm_fax || "818-291-6205",
      email: webhookData.firm_email || "ROZSAGYENELAW@YAHOO.COM",
      representing: `Petitioner ${webhookData.petitioner_name || ''}`,
      appointed: webhookData.attorney_appointed === "yes"
    },
    
    // Court Information
    court: {
      county: webhookData.court_county || "LOS ANGELES",
      branch: webhookData.court_branch || "STANLEY MOSK COURTHOUSE",
      street: webhookData.court_street || "111 N HILL ST",
      city: webhookData.court_city || "LOS ANGELES",
      zip: webhookData.court_zip || "90012"
    },
    
    // Case Information
    case_number: webhookData.case_number || '',
    caseNumber: webhookData.case_number || '', // Alternative naming for compatibility
    guardianship_type: webhookData.guardianship_type || "person", // "person" or "estate"
    guardianshipType: webhookData.guardianship_type || "person", // Alternative naming
    
    // Petitioner/Guardian Information
    petitioner: {
      name: webhookData.petitioner_name || '',
      address: webhookData.petitioner_address || '',
      phone: webhookData.petitioner_phone || '',
      relationship: webhookData.petitioner_relationship || '',
      is_related: webhookData.petitioner_related === "yes"
    },
    
    // Guardian (if different from petitioner)
    guardian: {
      name: webhookData.guardian_name || webhookData.petitioner_name || '',
      address: webhookData.guardian_address || webhookData.petitioner_address || '',
      phone: webhookData.guardian_phone || webhookData.petitioner_phone || '',
      ssn: webhookData.guardian_ssn || '',
      driverLicense: webhookData.guardian_dl || '',
      state: webhookData.guardian_state || 'CA',
      homePhone: webhookData.guardian_home_phone || '',
      workPhone: webhookData.guardian_work_phone || '',
      otherPhone: webhookData.guardian_other_phone || '',
      corporationName: webhookData.guardian_corporation || ''
    },
    
    // Minor Information
    minor: primaryMinor,
    minors: minorsList,
    
    // Estate Information (if guardianship of estate)
    estate: {
      personal_property: formatCurrency(personalProperty),
      real_property: formatCurrency(realProperty),
      total: formatCurrency(totalEstate),
      blocked_account: webhookData.blocked_account || ''
    },
    
    // Bond Information
    bond: {
      required: webhookData.bond_required === "yes",
      amount: formatCurrency(webhookData.bond_amount || totalEstate),
      blocked_amount: formatCurrency(webhookData.blocked_amount || 0),
      institution: webhookData.bond_institution || ''
    },
    
    // Hearing Information
    hearing: {
      date: formatDate(webhookData.hearing_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      datetime: webhookData.hearing_datetime || '',
      time: webhookData.hearing_time || "8:30 AM",
      dept: webhookData.hearing_dept || "11",
      room: webhookData.hearing_room || "",
      judge: webhookData.hearing_judge || "",
      dateTime: `${formatDate(webhookData.hearing_date)} at ${webhookData.hearing_time || "8:30 AM"}`,
      department: webhookData.hearing_dept || "11"
    },
    
    // GC-212 Screening Information
    screening: {
      relatedToMinor: webhookData.related_to_minor === "yes",
      convictedFelony: webhookData.convicted_felony === "yes",
      arrestedDrugAlcohol: webhookData.arrested_drug_alcohol === "yes",
      convictedMisdemeanorViolence: webhookData.convicted_misdemeanor === "yes",
      domesticViolenceRestraining: webhookData.domestic_violence === "yes",
      courtFoundAbusedChild: webhookData.abused_child === "yes",
      courtFoundAbusedAdult: webhookData.abused_adult === "yes",
      underConservatorship: webhookData.under_conservatorship === "yes",
      unableToProvideCare: webhookData.unable_provide_care === "yes",
      centralIndex: webhookData.central_index === "yes",
      healthSafetyCentralIndex: webhookData.health_safety_index === "yes",
      deniedLicenseCareChildren: webhookData.denied_license === "yes",
      financialConflict: webhookData.financial_conflict === "yes",
      beenGuardianConservatorTrustee: webhookData.been_guardian === "yes",
      beenRemovedAsGuardian: webhookData.been_removed === "yes",
      professionalFiduciary: webhookData.professional_fiduciary === "yes",
      publicEntity: webhookData.public_entity === "yes",
      privateGuardian: webhookData.private_guardian === "yes",
      minorLivesWithYou: webhookData.minor_lives_with === "yes"
    },
    
    // Powers and Conditions (GC-250)
    powers: {
      otherPowersGranted: webhookData.other_powers === "yes",
      independentPowers: webhookData.independent_powers === "yes",
      propertyConditions: webhookData.property_conditions === "yes",
      careConditions: webhookData.care_conditions === "yes",
      otherConditionsGranted: webhookData.other_conditions === "yes",
      attachmentSpecified: webhookData.attachment_specified === "yes",
      specifiedBelow: webhookData.specified_below === "yes",
      otherPowersText: webhookData.other_powers_text || "",
      notAuthorizedProperty: webhookData.not_authorized_property === "yes"
    },
    
    // Additional flags
    independent_powers: webhookData.independent_powers === "yes",
    dispense_notice: webhookData.dispense_notice === "yes",
    take_possession: webhookData.take_possession === "yes",
    orderApproved: webhookData.order_approved === "yes",
    
    // Fees
    fees: {
      amount: formatCurrency(webhookData.attorney_fees || 0),
      terms: webhookData.fee_terms || "Forthwith from estate"
    },
    
    // Court Officials
    investigator: {
      appointed: webhookData.investigator_appointed === "yes",
      info: webhookData.investigator_info || ''
    },
    referee: {
      appointed: webhookData.referee_appointed === "yes",
      info: webhookData.referee_info || ''
    },
    
    // Ward Information (for GC-250)
    ward: {
      name: primaryMinor.name,
      additionalWardName: minorsList[1]?.name || '',
      eighteenthBirthdayExtension: webhookData.eighteenth_birthday || '',
      terminationDate: webhookData.termination_date || ''
    },
    
    // Execution Information (for GC-250)
    execution: {
      date: formatDate(new Date()),
      place: `${webhookData.court_city || 'Los Angeles'}, California`
    },
    
    // Clerk Information (for GC-250)
    clerk: {
      signatureDate: formatDate(new Date())
    },
    
    // Additional Information
    additionalMinorsAttached: minorsList.length > 3,
    declaration: {
      date: formatDate(new Date())
    },
    
    // Order Date (for approved orders)
    orderDate: formatDate(webhookData.order_date || new Date()),
    
    // Court Info formatted for GC-212
    courtInfo: {
      county: webhookData.court_county || "LOS ANGELES",
      address: webhookData.court_street || "111 N HILL ST",
      mailingAddress: webhookData.court_mailing || "Same as above",
      branch: webhookData.court_branch || "STANLEY MOSK COURTHOUSE",
      cityZip: `${webhookData.court_city || 'Los Angeles'}, CA ${webhookData.court_zip || '90012'}`
    },
    
    // Attachments
    attachments: {
      numberOfPages: webhookData.attachment_pages || "0"
    },
    
    // Forms to generate (control which forms are created)
    forms: {
      gc210: webhookData.generate_gc210 !== false,
      gc212: webhookData.generate_gc212 !== false,
      gc240: webhookData.generate_gc240 === true || webhookData.order_approved === "yes",
      gc250: webhookData.generate_gc250 === true || webhookData.order_approved === "yes"
    }
  };
}

// Load PDF from deployed Netlify site
async function loadPDFFromRepo(filename) {
  const fetch = (await import('node-fetch')).default;
  const url = `https://guardianship-conservatorship.netlify.app/templates/guardianship/${filename}`;
  
  try {
    console.log(`Loading ${filename} from deployed site...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    return buffer;
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    throw error;
  }
}

// GC-210 Form Filler Function (Petition for Appointment of Guardian of Minor)
async function fillGC210(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-210 has ${form.getFields().length} fields available`);
    
    // I'll need to add all the GC-210 field mappings here from your guardianship-mappings.js file
    // Since you already have this working, would you like to share the complete field mappings?
    // For now, I'll include the structure:
    
    // PAGE 1 HEADER - Attorney Information
    const attorneyFields = {
      // Add all attorney field mappings from your original file
    };
    
    // Court Information
    const courtFields = {
      // Add all court field mappings from your original file
    };
    
    // Fill all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      // ... other field groups
    };
    
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES
    const checkboxes = {
      // Add all checkbox mappings from your original file
    };
    
    for (const [fieldName, shouldCheck] of Object.entries(checkboxes)) {
      try {
        const checkbox = form.getCheckBox(fieldName);
        if (shouldCheck) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
        console.log(`${shouldCheck ? 'Checked' : 'Unchecked'} ${fieldName}`);
      } catch (e) {
        console.log(`Could not set checkbox ${fieldName}: ${e.message}`);
      }
    }
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-210:', error);
    throw error;
  }
}

// GC-212 Form Filler Function (Confidential Guardian Screening Form)
async function fillGC212(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-212 has ${form.getFields().length} fields available`);
    
    // Add all GC-212 field mappings here from your original file
    // This would include all the fields and checkboxes
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-212:', error);
    throw error;
  }
}

// GC-240 Form Filler Function (Order Appointing Guardian of Minor)
async function fillGC240(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-240 has ${form.getFields().length} fields available`);
    
    // Add all GC-240 field mappings here from your original file
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-240:', error);
    throw error;
  }
}

// GC-250 Form Filler Function (Letters of Guardianship)
async function fillGC250(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-250 has ${form.getFields().length} fields available`);
    
    // Add all GC-250 field mappings here from your original file
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-250:', error);
    throw error;
  }
}

// Main function to fill all guardianship forms
async function fillGuardianshipForms(data) {
  const results = {};
  
  const forms = [
    { name: 'GC-210', filename: 'GC-210-unlocked.pdf', filler: fillGC210, condition: data.forms?.gc210 !== false },
    { name: 'GC-212', filename: 'GC-212-unlocked.pdf', filler: fillGC212, condition: data.forms?.gc212 !== false },
    { name: 'GC-240', filename: 'GC-240-unlocked.pdf', filler: fillGC240, condition: data.forms?.gc240 || data.orderApproved },
    { name: 'GC-250', filename: 'GC-250-unlocked.pdf', filler: fillGC250, condition: data.forms?.gc250 || data.orderApproved },
  ];
  
  for (const { name, filename, filler, condition } of forms) {
    if (condition) {
      try {
        console.log(`Processing ${name}...`);
        const pdfBytes = await loadPDFFromRepo(filename);
        results[name] = await filler(data, pdfBytes);
        console.log(`${name} completed`);
      } catch (error) {
        console.error(`Error with ${name}:`, error);
        results[name] = Buffer.from(`Error processing ${name}`);
      }
    }
  }
  
  return results;
}

// Merge multiple PDFs into one
async function mergePDFs(pdfs) {
  try {
    const mergedDoc = await PDFDocument.create();
    
    for (const [formName, pdfBytes] of Object.entries(pdfs)) {
      if (pdfBytes && pdfBytes.length > 100) { // Skip error messages
        console.log(`Merging ${formName}...`);
        const doc = await PDFDocument.load(pdfBytes);
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => mergedDoc.addPage(page));
      }
    }
    
    return await mergedDoc.save();
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw error;
  }
}

// Netlify Function Handler
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }
  
  try {
    const webhookData = JSON.parse(event.body);
    
    console.log('Received guardianship form submission for minor:', webhookData.minor_name || 'Unknown');
    
    // Transform the webhook data into our standard format
    const transformedData = transformGuardianshipData(webhookData);
    
    console.log('Data transformed, filling PDFs...');
    console.log('Guardianship type:', transformedData.guardianship_type);
    console.log('Forms to generate:', transformedData.forms);
    
    // Fill all requested forms
    const pdfs = await fillGuardianshipForms(transformedData);
    
    // Count successful forms
    const successfulForms = Object.keys(pdfs).filter(key => pdfs[key].length > 100);
    console.log(`Successfully generated ${successfulForms.length} forms:`, successfulForms);
    
    // Option 1: Return individual PDFs
    if (webhookData.return_individual_pdfs === true) {
      const response = {
        success: true,
        message: `Generated ${successfulForms.length} guardianship forms successfully`,
        timestamp: new Date().toISOString(),
        metadata: {
          minor: transformedData.minor.name,
          guardian: transformedData.guardian.name,
          petitioner: transformedData.petitioner.name,
          guardianship_type: transformedData.guardianship_type,
          estate_value: transformedData.estate.total,
          case_number: transformedData.case_number || 'To be assigned',
          forms_generated: successfulForms
        },
        pdfs: {}
      };
      
      // Add base64-encoded PDFs
      for (const formName of successfulForms) {
        response.pdfs[formName] = Buffer.from(pdfs[formName]).toString('base64');
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };
    }
    
    // Option 2: Return merged PDF (default)
    console.log('Merging all forms into single PDF...');
    const mergedPDF = await mergePDFs(pdfs);
    
    // Generate filename
    const minorName = (transformedData.minor.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Guardianship_${minorName}_${timestamp}.pdf`;
    
    const response = {
      success: true,
      message: `Generated ${successfulForms.length} guardianship forms successfully`,
      timestamp: new Date().toISOString(),
      filename: filename,
      metadata: {
        minor: transformedData.minor.name,
        guardian: transformedData.guardian.name,
        petitioner: transformedData.petitioner.name,
        guardianship_type: transformedData.guardianship_type,
        estate_value: transformedData.estate.total,
        case_number: transformedData.case_number || 'To be assigned',
        forms_generated: successfulForms
      },
      pdf: Buffer.from(mergedPDF).toString('base64')
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
    
  } catch (error) {
    console.error('Error processing guardianship forms:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to process guardianship forms',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};
