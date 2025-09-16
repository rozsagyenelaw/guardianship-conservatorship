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

function calculateAge(dob) {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Transform webhook data for conservatorship
function transformConservatorshipData(webhookData) {
  return {
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
    },
    petitioner: {
      name: webhookData.cons_petitioner_name,
      address: webhookData.cons_petitioner_address,
      phone: webhookData.cons_petitioner_phone,
      relationship: webhookData.cons_petitioner_relationship,
      relationship_type: webhookData.cons_petitioner_relationship?.toLowerCase().includes('spouse') ? 'spouse' : 'relative',
    },
    conservatee: {
      name: webhookData.conservatee_name,
      address: webhookData.conservatee_address,
      phone: webhookData.conservatee_phone,
      dob: webhookData.conservatee_dob,
      ssn: webhookData.conservatee_ssn,
      living_situation: webhookData.conservatee_living,
      unable_provide_needs: webhookData.personal_needs === "no",
      unable_manage_finances: webhookData.financial_management === "no",
      is_ca_resident: true,
      is_county_resident: true,
      attorney_name: '',
      disqualified_voting: false,
    },
    conservator: {
      name: webhookData.conservator_name,
      address: webhookData.conservator_address,
      phone: webhookData.conservator_phone,
      relationship: webhookData.conservator_relationship,
      dob: webhookData.conservator_dob,
      ssn: webhookData.conservator_ssn,
      license_number: '',
      license_issue_date: '',
      license_expiry_date: '',
    },
    conservatorship_type: webhookData.conservatorship_type === "both" ? "person" : webhookData.conservatorship_type || "person",
    is_limited: webhookData.conservatorship_type === "limited",
    is_successor: false,
    petitioner_is_conservator: true,
    case_number: webhookData.case_number || "To be assigned",
    court: {
      county: webhookData.court_county || "LOS ANGELES",
      branch: webhookData.court_branch || "STANLEY MOSK COURTHOUSE",
      street: "111 N HILL ST",
      city: "LOS ANGELES",
      zip: "90012",
    },
    hearing: {
      date: formatDate(webhookData.hearing_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      time: webhookData.hearing_time || "9:00 AM",
      datetime: `${formatDate(webhookData.hearing_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))} at ${webhookData.hearing_time || "9:00 AM"}`,
      dept: webhookData.hearing_dept || "11",
      room: webhookData.hearing_room || "Room 312",
      judge: '',
    },
    bond: {
      required: false,
      amount: '0',
      blocked_account: '0',
      blocked_amount: '0',
      institution: '',
    },
    estate: {
      personal_property: formatCurrency(webhookData.conservatee_personal_property || 0),
      real_property: formatCurrency(webhookData.conservatee_real_property || 0),
      annual_income: formatCurrency(webhookData.conservatee_income || 0),
      total: formatCurrency(
        (parseFloat(webhookData.conservatee_personal_property || 0) + 
         parseFloat(webhookData.conservatee_real_property || 0))
      ),
    },
    independent_powers: webhookData.cons_independent_powers === "yes",
    medical_consent_powers: false,
    placement_authority: false,
    dementia_authority: false,
    take_possession: true,
    fees: {
      amount: formatCurrency(webhookData.attorney_fees || 0),
      terms: webhookData.fee_terms || "forthwith",
    },
    server: {
      info: '',
      fee: '',
    },
    conservatorship_reason: webhookData.conservatorship_reason || '',
    medical_diagnosis: webhookData.medical_diagnosis || '',
    alternatives_considered: webhookData.alternatives_considered === "yes",
    alternatives_explanation: webhookData.alternatives_explanation || '',
  };
}

// Load PDF from deployed Netlify site
async function loadPDFFromRepo(filename) {
  const fetch = (await import('node-fetch')).default;
  // IMPORTANT: Update this URL to match your deployed conservatorship app
  const url = `https://guardianshipconservatorsh.netlify.app/templates/${filename}`;
  
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

// GC-310 Form Filler Function (Petition for Conservatorship)
async function fillGC310(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-310 has ${form.getFields().length} fields available`);
    
    // PAGE 1 HEADER - Attorney Information
    const attorneyFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyName_ft[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyBarNo_dc[0]': data.attorney.bar_number,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyFirm_ft[0]': data.attorney.firm_name,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyStreet_ft[0]': data.attorney.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyCity_ft[0]': data.attorney.city,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyState_ft[0]': data.attorney.state,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyZip_ft[0]': data.attorney.zip,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Phone_ft[0]': data.attorney.phone,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Fax_ft[0]': data.attorney.fax,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Email_ft[0]': data.attorney.email,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyFor_ft[0]': `Petitioner ${data.petitioner.name}`,
    };
    
    // Court Information
    const courtFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].CrtCounty_ft[0]': data.court.county,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].Street_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].MailingAdd_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].CityZip_ft[0]': `${data.court.city}, CA ${data.court.zip}`,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].Branch_ft[0]': data.court.branch,
    };
    
    // Case Information (repeated on multiple pages)
    const caseFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page4[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page4[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page5[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page5[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page6[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page6[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page7[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page7[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page8[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page8[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
    };
    
    // Hearing Information  
    const hearingFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].HearingInfo_sf[0].HearingDateTime_ft[0]': data.hearing.datetime,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].HearingInfo_sf[0].Dept_ft[0]': data.hearing.dept,
    };
    
    // Petitioner Information (Section 1a)
    const petitionerFields = {
      'topmostSubform[0].Page1[0].FillText156[0]': data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText157[0]': data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText158[0]': data.petitioner.phone,
      'topmostSubform[0].Page1[0].FillText164[0]': data.petitioner.address,
    };
    
    // Proposed Conservator (Section 1b)
    const conservatorFields = {
      'topmostSubform[0].Page1[0].FillText160[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText161[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText162[0]': data.conservator.phone || data.petitioner.phone,
      'topmostSubform[0].Page1[0].FillText163[0]': data.conservator.address || data.petitioner.address,
    };
    
    // Bond Information (Section 1c/1d)
    const bondFields = {
      'topmostSubform[0].Page1[0].FillText165[0]': data.bond.amount || '',
      'topmostSubform[0].Page1[0].FillText166[0]': data.bond.blocked_account || '',
      'topmostSubform[0].Page1[0].FillText167[0]': data.bond.institution || '',
    };
    
    // Conservatee Information (Page 2)
    const conservateeFields = {
      'topmostSubform[0].Page2[0].FillText171[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].FillText172[0]': data.conservatee.phone,
      'topmostSubform[0].Page2[0].FillText173[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].FillText174[0]': data.conservatee.address,
    };
    
    // Petitioner Relationship (Page 2, Section 3b)
    const relationshipField = {
      'topmostSubform[0].Page2[0].FillText2[0]': data.petitioner.relationship || '',
      'topmostSubform[0].Page2[0].FillText3[0]': '', // Other specify
    };
    
    // Estate Values (Page 3)
    const estateFields = {
      'topmostSubform[0].Page3[0].FillText22[0]': data.estate.personal_property || '',
      'topmostSubform[0].Page3[0].FillText23[0]': '', // Annual income from personal property
      'topmostSubform[0].Page3[0].FillText24[0]': '', // Cash and savings
      'topmostSubform[0].Page3[0].FillText25[0]': '', // Annual income from wages
      'topmostSubform[0].Page3[0].FillText26[0]': data.estate.annual_income || '',
      'topmostSubform[0].Page3[0].FillText27[0]': data.estate.real_property || '',
      'topmostSubform[0].Page3[0].FillText28[0]': data.estate.total || '',
      'topmostSubform[0].Page3[0].FillText29[0]': '', // Annual income from real property
      'topmostSubform[0].Page3[0].FillText30[0]': '', // Total annual income
    };
    
    // Reasons for Conservatorship (Page 4-5)
    const reasonFields = {
      'topmostSubform[0].Page4[0].FillText31[0]': data.conservatorship_reason || 'See attached declaration',
      'topmostSubform[0].Page4[0].FillText32[0]': '', // Continued text
      'topmostSubform[0].Page5[0].FillText33[0]': data.medical_diagnosis || '',
      'topmostSubform[0].Page5[0].FillText34[0]': '', // Additional facts
    };
    
    // Alternatives (Page 6)
    const alternativesFields = {
      'topmostSubform[0].Page6[0].FillText35[0]': data.alternatives_explanation || 'Less restrictive alternatives are not feasible.',
      'topmostSubform[0].Page6[0].FillText36[0]': '', // Additional alternatives text
    };
    
    // Required Documents (Page 7)
    const documentsFields = {
      'topmostSubform[0].Page7[0].FillText37[0]': '0', // Number of pages attached
      'topmostSubform[0].Page7[0].FillText38[0]': '', // Other documents
    };
    
    // Signatures (Page 8)
    const signatureFields = {
      'topmostSubform[0].Page8[0].FillText61[0]': data.attorney.name,
      'topmostSubform[0].Page8[0].FillText81[0]': formatDate(new Date()),
      'topmostSubform[0].Page8[0].FillText61[1]': data.petitioner.name,
      'topmostSubform[0].Page8[0].FillText83[0]': formatDate(new Date()),
      'topmostSubform[0].Page8[0].FillText82[0]': '', // Additional signatures
      'topmostSubform[0].Page8[0].FillText84[0]': '', // Additional date
    };
    
    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...caseFields,
      ...hearingFields,
      ...petitionerFields,
      ...conservatorFields,
      ...bondFields,
      ...conservateeFields,
      ...relationshipField,
      ...estateFields,
      ...reasonFields,
      ...alternativesFields,
      ...documentsFields,
      ...signatureFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Type of Conservatorship (header) - appears on all pages
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].ChckBx22[0]': data.is_limited || false,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].successor_cb[0]': data.is_successor || false,
      
      // Repeat headers on all pages
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page4[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page4[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page5[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page5[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page6[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page6[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page7[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page7[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page8[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page8[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      
      // Bond requirements (Section 1c)
      'topmostSubform[0].Page1[0].CheckBox13[0]': !data.bond.required,
      'topmostSubform[0].Page1[0].CheckBox9[0]': data.bond.required,
      'topmostSubform[0].Page1[0].CheckBox8[0]': data.bond.blocked_account ? true : false,
      
      // Powers requested
      'topmostSubform[0].Page1[0].CheckBox7[0]': data.independent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox2[0]': data.medical_consent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox1[0]': false, // Other powers
      
      // Petitioner is conservator (same person)
      'topmostSubform[0].Page1[0].CheckBx19[0]': data.petitioner_is_conservator !== false,
      'topmostSubform[0].Page1[0].ChckBx19[0]': data.is_limited && data.petitioner_is_conservator,
      
      // Conservatee residence (Page 2)
      'topmostSubform[0].Page2[0].CheckBox46[0]': data.conservatee.is_ca_resident !== false,
      'topmostSubform[0].Page2[0].CheckBox45[0]': data.conservatee.is_county_resident !== false,
      'topmostSubform[0].Page2[0].CheckBox44[0]': false, // Other county
      
      // Petitioner relationship (Page 2)
      'topmostSubform[0].Page2[0].CheckBox30[0]': data.petitioner.relationship_type === 'relative',
      'topmostSubform[0].Page2[0].CheckBox31[0]': false, // Creditor
      'topmostSubform[0].Page2[0].CheckBox32[0]': data.petitioner.relationship_type === 'spouse',
      'topmostSubform[0].Page2[0].CheckBox33[0]': false, // Domestic partner
      'topmostSubform[0].Page2[0].CheckBox34[0]': false, // Friend
      'topmostSubform[0].Page2[0].CheckBox35[0]': false, // Interested person
      'topmostSubform[0].Page2[0].CheckBox36[0]': false, // County officer
      'topmostSubform[0].Page2[0].CheckBox37[0]': false, // State officer
      'topmostSubform[0].Page2[0].CheckBox38[0]': false, // Other
      
      // Conservatee condition (Page 5)
      'topmostSubform[0].Page5[0].CheckBox119[0]': data.conservatee.unable_manage_finances !== false,
      'topmostSubform[0].Page5[0].CheckBox79[0]': data.conservatee.unable_provide_needs !== false,
      'topmostSubform[0].Page5[0].CheckBox80[0]': false, // Major neurocognitive disorder
      'topmostSubform[0].Page5[0].CheckBox81[0]': false, // Other mental illness
      
      // Alternatives considered (Page 6)
      'topmostSubform[0].Page6[0].CheckBox120[0]': data.alternatives_considered,
      'topmostSubform[0].Page6[0].CheckBox121[0]': !data.alternatives_considered,
      
      // Required forms (Page 6 & 8)
      'topmostSubform[0].Page6[0].CheckBox114[0]': true, // Confidential Supplemental Information
      'topmostSubform[0].Page6[0].CheckBox115[0]': true, // Assessment
      'topmostSubform[0].Page6[0].CheckBox116[0]': true, // Citation
      'topmostSubform[0].Page7[0].CheckBox140[0]': true, // Duties and Liabilities
      'topmostSubform[0].Page7[0].CheckBox141[0]': false, // Regional center report
      'topmostSubform[0].Page8[0].CheckBox150[0]': true, // Notice of hearing
      'topmostSubform[0].Page8[0].CheckBox151[0]': true, // Confidential screening form
      'topmostSubform[0].Page8[0].CheckBox152[0]': false, // Other attachments
    };
    
    // Set all checkboxes
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
    console.error('Error filling GC-310:', error);
    throw error;
  }
}

// GC-312 Form Filler Function (Confidential Supplemental Information) - COMPLETE
async function fillGC312(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    console.log(`GC-312 has ${form.getFields().length} fields available`);

    // Attorney/Party Information
    const attorneyFields = {
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].AttyBarNo[0]': data.attorney.bar_number,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].ConservatorName[0]': data.attorney.name.toUpperCase(),
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].AttyFirm[0]': data.attorney.firm_name,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].Street[0]': data.attorney.street,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].City[0]': data.attorney.city,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].State[0]': data.attorney.state,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].Zip[0]': data.attorney.zip,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].Phone[0]': data.attorney.phone,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].Fax[0]': data.attorney.fax,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].Email[0]': data.attorney.email,
      'GC-312[0].Page1[0].p1Caption[0].AttyPartyInfo[0].AttyFor[0]': data.petitioner.name,
    };

    // Court Information
    const courtFields = {
      'GC-312[0].Page1[0].p1Caption[0].CourtInfo[0].CrtCounty[0]': data.court.county.toUpperCase(),
      'GC-312[0].Page1[0].p1Caption[0].CourtInfo[0].CrtStreet[0]': data.court.street,
      'GC-312[0].Page1[0].p1Caption[0].CourtInfo[0].CrtMailingAdd[0]': data.court.street,
      'GC-312[0].Page1[0].p1Caption[0].CourtInfo[0].CrtCityZip[0]': `${data.court.city}, CA ${data.court.zip}`,
      'GC-312[0].Page1[0].p1Caption[0].CourtInfo[0].CrtBranch[0]': data.court.branch,
    };

    // Conservatee Information (repeated on all pages)
    const conservateeFields = [
      'GC-312[0].Page1[0].p1Caption[0].TitlePartyName[0].Conservatee_ft[0]',
      'GC-312[0].Page2[0].p2Caption_sf[0].pxCaption[0].TitlePartyName[0].Conservatee_ft[0]',
      'GC-312[0].Page3[0].p3Caption_sf[0].pxCaption[0].TitlePartyName[0].Conservatee_ft[0]',
      'GC-312[0].Page4[0].p4Caption_sf[0].pxCaption[0].TitlePartyName[0].Conservatee_ft[0]'
    ];
    
    conservateeFields.forEach(fieldName => {
      try {
        const field = form.getTextField(fieldName);
        field.setText(data.conservatee.name.toUpperCase());
      } catch (e) {
        console.log(`Could not set conservatee name field ${fieldName}: ${e.message}`);
      }
    });

    // Case Number (repeated on all pages)
    const caseNumberFields = [
      'GC-312[0].Page1[0].p1Caption[0].CaseNumber[0].CaseNumber[0]',
      'GC-312[0].Page2[0].p2Caption_sf[0].pxCaption[0].CaseNumber[0].CaseNumber[0]',
      'GC-312[0].Page3[0].p3Caption_sf[0].pxCaption[0].CaseNumber[0].CaseNumber[0]',
      'GC-312[0].Page4[0].p4Caption_sf[0].pxCaption[0].CaseNumber[0].CaseNumber[0]'
    ];
    
    caseNumberFields.forEach(fieldName => {
      try {
        const field = form.getTextField(fieldName);
        field.setText(data.case_number);
      } catch (e) {
        console.log(`Could not set case number field ${fieldName}: ${e.message}`);
      }
    });

    // Hearing Information
    const hearingFields = {
      'GC-312[0].Page1[0].p1Caption[0].HearingDate[0].HearingDt[0]': data.hearing.date,
      'GC-312[0].Page1[0].p1Caption[0].Dept-Time[0].Dept[0]': data.hearing.dept,
      'GC-312[0].Page1[0].p1Caption[0].Dept-Time[0].Time[0]': data.hearing.time,
    };

    // Item 1 - Proposed Conservatee Details
    const conservateeDetailsFields = {
      'GC-312[0].Page1[0].Item1[0].Conservatee_ft[0]': data.conservatee.name.toUpperCase(),
      'GC-312[0].Page1[0].Item1[0].DOB_ft[0]': formatDate(data.conservatee.dob),
      'GC-312[0].Page1[0].Item1[0].Age_ft[0]': calculateAge(data.conservatee.dob).toString(),
      'GC-312[0].Page1[0].Item1[0].SSN_ft[0]': data.conservatee.ssn || '',
    };

    // Item 3 - Personal Needs Information (Page 1)
    const personalNeedsFields = {
      'GC-312[0].Page1[0].Item3[0].Item3a[0].PhysHealth_ft[0]': 
        data.conservatorship_type === 'person' ? 'Conservatee is unable to properly provide for personal needs for physical health, food, clothing, or shelter.' : '',
      'GC-312[0].Page1[0].Item3[0].Item3b[0].Food_ft[0]': 
        data.conservatorship_type === 'person' ? 'Unable to manage food and nutrition needs independently.' : '',
      'GC-312[0].Page1[0].Item3[0].Item3c[0].Clothing_ft[0]': 
        data.conservatorship_type === 'person' ? 'Unable to obtain or maintain appropriate clothing.' : '',
      'GC-312[0].Page1[0].Item3[0].Item3d[0].Shelter_ft[0]': 
        data.conservatorship_type === 'person' ? 'Unable to maintain safe and appropriate shelter.' : '',
    };

    // Item 4 - Financial Resources (Page 2)
    const financialResourcesFields = {
      'GC-312[0].Page2[0].Item4[0].FinRes_ft[0]': 
        data.conservatorship_type === 'estate' ? 'Conservatee substantially unable to manage own financial resources or resist fraud or undue influence.' : '',
      'GC-312[0].Page2[0].Item4[0].FrdUndueInfl_ft[0]': 
        data.conservatorship_type === 'estate' ? 'Conservatee is susceptible to fraud and undue influence.' : '',
    };

    // Item 5 - Residence Information
    const residenceFields = {
      'GC-312[0].Page2[0].Item5[0].Item5a[0].ResNature_ft[0]': data.conservatee.living_situation || 'residential home',
      'GC-312[0].Page2[0].Item5[0].Item5b[0].ResAddress_ft[0]': data.conservatee.address,
      'GC-312[0].Page2[0].Item5[0].Item5c[0].OtherAddr_ft[0]': '',
      'GC-312[0].Page2[0].Item5[0].Item5d[0].CurrntLocNature_ft[0]': data.conservatee.living_situation || 'residential home',
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e2[0].Item5e2a[0].RtnDate_ft[0]': '',
      'GC-312[0].Page2[0].Item5[0].Item5f[0].ReasonsFor5e[0]': 
        'Conservatee requires supervision and assistance with daily activities.',
    };

    // Item 6 - Alternatives Considered (Page 3)
    const alternativesFields = {
      'GC-312[0].Page3[0].Item6[0].Item6a[0].SDM_ft[0]': 
        data.alternatives_considered ? 'Supported decisionmaking was considered but is not viable due to cognitive limitations.' : 'Not applicable',
      'GC-312[0].Page3[0].Item6[0].Item6b[0].DesHCSurr_ft[0]': 
        'No health care surrogate currently designated.',
      'GC-312[0].Page3[0].Item6[0].Item6c[0].AHCD_ft[0]': 
        'No advance health care directive in place.',
      'GC-312[0].Page3[0].Item6[0].Item6d[0].POA_ft[0]': 
        data.alternatives_explanation || 'Power of attorney insufficient for current needs.',
      'GC-312[0].Page3[0].Item6[0].Item6e[0].Trust_ft[0]': 
        'No trust arrangement exists.',
      'GC-312[0].Page3[0].Item6[0].Item6f[0].OtherAlts_ft[0]': 
        'Less restrictive alternatives have been considered and are not appropriate.',
    };

    // Item 7 - Services Received (Page 4)
    const servicesFields = {
      'GC-312[0].Page4[0].Item7[0].Item7a[0].HealthServs_ft[0]': 
        'Regular medical care and monitoring.',
      'GC-312[0].Page4[0].Item7[0].Item7b[0].SocialServs_ft[0]': 
        'Adult protective services involvement.',
    };

    // Declaration Section (Page 4)
    const declarationFields = {
      'GC-312[0].Page4[0].PoPDec[0].SigDate[0]': formatDate(new Date()),
      'GC-312[0].Page4[0].PoPDec[0].TypePrintName[0]': data.petitioner.name.toUpperCase(),
    };

    // Number of pages attached
    const attachmentFields = {
      'GC-312[0].Page4[0].Item11[0].NumPages[0]': '0',
    };

    // Item 10 - Non-Applicable explanation
    const nonApplicableFields = {
      'GC-312[0].Page4[0].Item10[0].NotAppExplain_ft[0]': '',
    };

    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...hearingFields,
      ...conservateeDetailsFields,
      ...personalNeedsFields,
      ...financialResourcesFields,
      ...residenceFields,
      ...alternativesFields,
      ...servicesFields,
      ...declarationFields,
      ...attachmentFields,
      ...nonApplicableFields
    };

    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`GC-312: Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`GC-312: Could not set field ${fieldName}: ${e.message}`);
      }
    }

    // CHECKBOXES - Complete set
    const checkboxes = {
      // Conservatorship Type
      'GC-312[0].Page1[0].p1Caption[0].FormTitle[0].Ltd_cb[0]': data.is_limited,
      'GC-312[0].Page1[0].p1Caption[0].FormTitle[0].Person_cb[0]': data.conservatorship_type === 'person',
      'GC-312[0].Page1[0].p1Caption[0].FormTitle[0].Estate_cb[0]': data.conservatorship_type === 'estate',

      // Item 2 - Role Selection
      'GC-312[0].Page1[0].Item2[0].Petitioner_cb[0]': true,
      'GC-312[0].Page1[0].Item2[0].PropConservator_cb[0]': data.petitioner_is_conservator,

      // Item 3 - Personal Needs
      'GC-312[0].Page1[0].Item3[0].Item3Main[0].PrsnlNeeds_cb[0]': data.conservatorship_type === 'person',
      'GC-312[0].Page1[0].Item3[0].Item3a[0].ContiAtt3a_cb[0]': false,
      'GC-312[0].Page1[0].Item3[0].Item3b[0].ContAtt3b3b[0]': false,
      'GC-312[0].Page1[0].Item3[0].Item3c[0].ContAtt3c_cb[0]': false,
      'GC-312[0].Page1[0].Item3[0].Item3d[0].ContAtt3d_cb[0]': false,

      // Item 4 - Financial Resources
      'GC-312[0].Page2[0].Item4[0].FinResources_cb[0]': data.conservatorship_type === 'estate',
      'GC-312[0].Page2[0].Item4[0].ContAtt4a_cb[0]': false,
      'GC-312[0].Page2[0].Item4[0].ContAtt4b[0]': false,

      // Item 5 - Residence Status
      'GC-312[0].Page2[0].Item5[0].Item5c[0].residence5\\.c[0]': true,
      'GC-312[0].Page2[0].Item5[0].Item5c[0].residence5\\.c[1]': false,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e1[0].LivingRes_cb[0]': true,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e1[0].Item5e1a[0].livinginthe5\\.e[0]': true,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e1[0].Item5e1b[0].livinginthe5\\.e[0]': false,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e1[0].Item5e1c[0].livinginthe5\\.e[0]': false,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e2[0].NotLivingRes_cb[0]': false,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e2[0].Item5e2a[0].notlivinginthe5\\.e2[0]': false,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e2[0].Item5e2b[0].notlivinginthe5\\.e2[0]': false,
      'GC-312[0].Page2[0].Item5[0].Item5e[0].Item5e2[0].Item5e2c[0].notlivinginthe5\\.e2[0]': false,
      'GC-312[0].Page2[0].Item5[0].Item5f[0].ContAtt5e_cb[0]': false,

      // Item 6 - Alternatives attachments
      'GC-312[0].Page3[0].Item6[0].Item6a[0].ContAtt6a_cb[0]': false,
      'GC-312[0].Page3[0].Item6[0].Item6b[0].ContAtt6b_cb[0]': false,
      'GC-312[0].Page3[0].Item6[0].Item6c[0].ContAtt6c[0]': false,
      'GC-312[0].Page3[0].Item6[0].Item6d[0].ContAtt6d[0]': false,
      'GC-312[0].Page3[0].Item6[0].Item6e[0].ContAtt6e_cb[0]': false,
      'GC-312[0].Page3[0].Item6[0].Item6f[0].ContAtt6f[0]': false,

      // Item 7 - Services
      'GC-312[0].Page4[0].Item7[0].Item7a[0].HealthServs_cb[0]': true,
      'GC-312[0].Page4[0].Item7[0].Item7a[0].ContAtt7a_cb[0]': false,
      'GC-312[0].Page4[0].Item7[0].Item7b[0].SocialServs_cb[0]': true,
      'GC-312[0].Page4[0].Item7[0].Item7b[0].ContAtt7b_cb[0]': false,
      'GC-312[0].Page4[0].Item7[0].Item7c[0].DontKnow_cb[0]': false,
      'GC-312[0].Page4[0].Item7[0].Item7c[0].HS_cb[0]': false,
      'GC-312[0].Page4[0].Item7[0].Item7c[0].SS_cb[0]': false,

      // Item 8 - Conservatee Knowledge
      'GC-312[0].Page4[0].Item8[0].Item8a[0].Knows_8\\.a[0]': true,
      'GC-312[0].Page4[0].Item8[0].Item8a[0].Knows_8\\.a[1]': false,
      'GC-312[0].Page4[0].Item8[0].Item8a[0].Knows_8\\.a[2]': false,
      'GC-312[0].Page4[0].Item8[0].Item8b[0].Agrees_8\\.b[0]': false,
      'GC-312[0].Page4[0].Item8[0].Item8b[0].Agrees_8\\.b[1]': true,
      'GC-312[0].Page4[0].Item8[0].Item8b[0].Agrees_8\\.b[2]': false,
      'GC-312[0].Page4[0].Item8[0].Item8b[0].Agrees_8\\.b[3]': false,

      // Item 9 - Source of Information
      'GC-312[0].Page4[0].Item9[0].Item9a[0].PersKnow9a_cb[0]': true,
      'GC-312[0].Page4[0].Item9[0].Item9a[0].Affidavit9a_cb[0]': false,
      'GC-312[0].Page4[0].Item9[0].Item9b[0].PersKnow9b_cb[0]': true,
      'GC-312[0].Page4[0].Item9[0].Item9b[0].Affidavit9b_cb[0]': false,
      'GC-312[0].Page4[0].Item9[0].Item9c[0].PersKnow9c_cb[0]': true,
      'GC-312[0].Page4[0].Item9[0].Item9c[0].Affidavit9c_cb[0]': false,
      'GC-312[0].Page4[0].Item9[0].Item9d[0].PersKnow9d_cb[0]': true,
      'GC-312[0].Page4[0].Item9[0].Item9d[0].Affidavit9d_cb[0]': false,
      'GC-312[0].Page4[0].Item9[0].Item9e[0].PersKnow9e_cb[0]': true,
      'GC-312[0].Page4[0].Item9[0].Item9e[0].Affidavit9e_cb[0]': false,
      'GC-312[0].Page4[0].Item9[0].Item9f[0].PersKnow9f_cb[0]': true,
      'GC-312[0].Page4[0].Item9[0].Item9f[0].Affidavit9f_cb[0]': false,

      // Item 10 - Non-Applicable Items
      'GC-312[0].Page4[0].Item10[0].NotApply3_cb[0]': data.conservatorship_type !== 'person',
      'GC-312[0].Page4[0].Item10[0].NotApply4_cb[0]': data.conservatorship_type !== 'estate',
      'GC-312[0].Page4[0].Item10[0].ContAtt10_cb[0]': false,
    };

    // Set all checkboxes
    for (const [fieldName, shouldCheck] of Object.entries(checkboxes)) {
      try {
        const checkbox = form.getCheckBox(fieldName);
        if (shouldCheck) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
        console.log(`GC-312: ${shouldCheck ? 'Checked' : 'Unchecked'} ${fieldName}`);
      } catch (e) {
        console.log(`GC-312: Could not set checkbox ${fieldName}: ${e.message}`);
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-312:', error);
    throw error;
  }
}

// GC-320 Form Filler Function (Citation for Conservatorship) - COMPLETE
async function fillGC320(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-320 has ${form.getFields().length} fields available`);
    
    // Attorney Information
    const attorneyFields = {
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyName_ft[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyBarNo_dc[0]': data.attorney.bar_number,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyFirm_ft[0]': data.attorney.firm_name,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyStreet_ft[0]': data.attorney.street,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyCity_ft[0]': data.attorney.city,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyState_ft[0]': data.attorney.state,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyZip_ft[0]': data.attorney.zip,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].Phone_ft[0]': data.attorney.phone,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].Fax_ft[0]': data.attorney.fax,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].Email_ft[0]': data.attorney.email,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].AttyInfo[0].AttyFor_ft[0]': `Petitioner ${data.petitioner.name}`,
    };
    
    // Court Information
    const courtFields = {
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CourtInfo[0].CrtCounty_ft[0]': data.court.county,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CourtInfo[0].Street_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CourtInfo[0].MailingAdd_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CourtInfo[0].CityZip_ft[0]': `${data.court.city}, CA ${data.court.zip}`,
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CourtInfo[0].Branch_ft[0]': data.court.branch,
    };
    
    // Case Information (appears on all pages)
    const caseFields = {
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].Party1_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].PxCaption_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page2[0].PxCaption_sf[0].TitlePartyName[0].Party1_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page3[0].PxCaption_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page3[0].PxCaption_sf[0].TitlePartyName[0].Party1_ft[0]': data.conservatee.name,
    };
    
    // Citation Information (Page 1)
    const citationFields = {
      'topmostSubform[0].Page1[0].FillText59[0]': data.conservatee.name,
      'topmostSubform[0].Page1[0].FillText59[1]': data.hearing.dept,
      'topmostSubform[0].Page1[0].FillText60[0]': data.hearing.time,
      'topmostSubform[0].Page1[0].FillText61[0]': data.hearing.date,
      'topmostSubform[0].Page1[0].FillText62[0]': '', // Street address line 1
      'topmostSubform[0].Page1[0].FillText63[0]': '', // Street address line 2
      'topmostSubform[0].Page1[0].FillText64[0]': data.conservatee.address || '',
      'topmostSubform[0].Page1[0].FillText65[0]': data.petitioner.name,
    };
    
    // Hearing Location Fields
    const hearingLocationFields = {
      'topmostSubform[0].Page1[0].#area[0].FillText58[0]': data.hearing.room || '',
    };
    
    // Clerk Signature Section (Page 2)
    const clerkFields = {
      'topmostSubform[0].Page2[0].FillText66[0]': formatDate(new Date()),
      'topmostSubform[0].Page2[0].T56[0]': 'Deputy',
      'topmostSubform[0].Page2[0].FillText67[0]': '', // Clerk signature
      'topmostSubform[0].Page2[0].FillText68[0]': '', // Additional notes
    };
    
    // Service Information (Page 3)
    const serviceFields = {
      'topmostSubform[0].Page3[0].FillText4[0]': data.conservatee.name,
      'topmostSubform[0].Page3[0].FillText4[1]': '', // Additional person served
      'topmostSubform[0].Page3[0].FillText5[0]': '', // Date of service line 1
      'topmostSubform[0].Page3[0].FillText5[1]': '', // Date of service line 2
      'topmostSubform[0].Page3[0].FillText7[0]': '', // Time of service
      'topmostSubform[0].Page3[0].FillText8[0]': '', // Name of server
      'topmostSubform[0].Page3[0].FillText9[0]': '', // Title if sheriff
      'topmostSubform[0].Page3[0].FillText10[0]': '', // County if sheriff
      'topmostSubform[0].Page3[0].FillText11[0]': data.server?.info || '',
      'topmostSubform[0].Page3[0].FillText12[0]': '', // Additional service info
      'topmostSubform[0].Page3[0].FillText13[0]': '', // Zip code
      'topmostSubform[0].Page3[0].FillText14[0]': '', // Registration number
      'topmostSubform[0].Page3[0].FillText15[0]': '', // County of registration
      'topmostSubform[0].Page3[0].FillText16[0]': '', // California address
      'topmostSubform[0].Page3[0].FillText17[0]': '', // Telephone
      'topmostSubform[0].Page3[0].FillText18[0]': '', // Name if individual
      'topmostSubform[0].Page3[0].FillText19[0]': '', // Date of service
      'topmostSubform[0].Page3[0].FillText20[0]': '', // At time
      'topmostSubform[0].Page3[0].FillText21[0]': '', // Other person served
      'topmostSubform[0].Page3[0].FillText22[0]': data.conservatee.address,
      'topmostSubform[0].Page3[0].FillText190[0]': data.server?.fee || '',
      'topmostSubform[0].Page3[0].FillText191[0]': '', // Mileage
      'topmostSubform[0].Page3[0].FillText192[0]': '', // Total
    };
    
    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...caseFields,
      ...citationFields,
      ...hearingLocationFields,
      ...clerkFields,
      ...serviceFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Type of Conservatorship (appears on all pages)
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].#area[0].TitlePerson_cb[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].TitlePartyName[0].#area[0].TitleEstate_cb[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].FormTitle[0].#area[0].ChckBx22[0]': data.is_limited || false,
      'topmostSubform[0].Page2[0].PxCaption_sf[0].TitlePartyName[0].#area[0].TitlePerson_cb[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page2[0].PxCaption_sf[0].TitlePartyName[0].#area[0].TitleEstate_cb[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page3[0].PxCaption_sf[0].TitlePartyName[0].#area[0].TitlePerson_cb[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page3[0].PxCaption_sf[0].TitlePartyName[0].#area[0].TitleEstate_cb[0]': data.conservatorship_type === 'estate',
      
      // Reasons for conservatorship
      'topmostSubform[0].Page1[0].CheckBox8[0]': data.conservatee.unable_provide_needs !== false,
      'topmostSubform[0].Page1[0].ChckBox8[0]': data.conservatee.unable_manage_finances !== false,
      
      // Type of conservator
      'topmostSubform[0].Page1[0].CheckBox5[0]': !data.is_limited,
      'topmostSubform[0].Page1[0].ChckBox5[0]': data.is_limited,
      
      // Conservatorship of (repeated)
      'topmostSubform[0].Page1[0].CheckBx3[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].ChckBox3[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].CheckBox2[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].CheckBx2[0]': data.conservatorship_type === 'estate',
      
      // Address same as above
      'topmostSubform[0].Page1[0].CheckBox9[0]': true,
      'topmostSubform[0].Page1[0].CheckBox10[0]': false,
      
      // Hearing location
      'topmostSubform[0].Page1[0].#area[0].CheckBox27[0]': true, // Dept.
      'topmostSubform[0].Page1[0].#area[0].CheckBox28[0]': data.hearing.room ? true : false, // Room
      
      // Notice and documents (Page 2)
      'topmostSubform[0].Page2[0].CheckBox19[0]': true, // Notice given as required
      'topmostSubform[0].Page2[0].CheckBox20[0]': true, // Documents served
      'topmostSubform[0].Page2[0].CheckBox21[0]': true, // Petition
      'topmostSubform[0].Page2[0].CheckBox22[0]': true, // Notice of hearing
      'topmostSubform[0].Page2[0].CheckBox23[0]': false, // Order to show cause
      'topmostSubform[0].Page2[0].CheckBox24[0]': false, // Temporary restraining order
      'topmostSubform[0].Page2[0].CheckBox25[0]': false, // Other
      
      // Service section (Page 3)
      'topmostSubform[0].Page3[0].CheckBox29[0]': true, // Person in item 2a
      'topmostSubform[0].Page3[0].CheckBox30[0]': false, // Person in item 2b
      'topmostSubform[0].Page3[0].CheckBox31[0]': false, // Other
      'topmostSubform[0].Page3[0].CheckBox27[0]': false, // Personal delivery
      'topmostSubform[0].Page3[0].CheckBox26[0]': false, // By mail
      'topmostSubform[0].Page3[0].CheckBox32[0]': false, // Server is not registered
      'topmostSubform[0].Page3[0].CheckBox33[0]': false, // Server is registered
      'topmostSubform[0].Page3[0].CheckBox34[0]': false, // Server is sheriff
      'topmostSubform[0].Page3[0].CheckBox35[0]': false, // Server declaration
      'topmostSubform[0].Page3[0].CheckBox36[0]': false, // Over 18
      'topmostSubform[0].Page3[0].CheckBox37[0]': false, // Personal service
      'topmostSubform[0].Page3[0].CheckBox38[0]': false, // Substituted service
      'topmostSubform[0].Page3[0].CheckBox39[0]': false, // Other service method
      'topmostSubform[0].Page3[0].CheckBox40[0]': false, // Business or residence
      'topmostSubform[0].Page3[0].CheckBox41[0]': false, // Mailed copy
    };
    
    // Set all checkboxes
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
    console.error('Error filling GC-320:', error);
    throw error;
  }
}

// GC-340 Form Filler Function (Order Appointing Conservator) - COMPLETE
async function fillGC340(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-340 has ${form.getFields().length} fields available`);
    
    // Attorney Information
    const attorneyFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyName_ft[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyBarNo_dc[0]': data.attorney.bar_number,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyFirm_ft[0]': data.attorney.firm_name,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyStreet_ft[0]': data.attorney.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyCity_ft[0]': data.attorney.city,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyState_ft[0]': data.attorney.state,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyZip_ft[0]': data.attorney.zip,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Phone_ft[0]': data.attorney.phone,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Fax_ft[0]': data.attorney.fax,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Email_ft[0]': data.attorney.email,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyFor_ft[0]': `Petitioner ${data.petitioner.name}`,
    };
    
    // Court Information
    const courtFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].CrtCounty_ft[0]': data.court.county,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].Street_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].MailingAdd_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].CityZip_ft[0]': `${data.court.city}, CA ${data.court.zip}`,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].Branch_ft[0]': data.court.branch,
    };
    
    // Case Information (appears on all pages)
    const caseFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.conservatee.name,
    };
    
    // Hearing Information (Page 1)
    const hearingFields = {
      'topmostSubform[0].Page1[0].FillText16[0]': data.hearing.judge || '',
      'topmostSubform[0].Page1[0].FillText17[0]': data.hearing.date,
      'topmostSubform[0].Page1[0].FillText18[0]': data.hearing.time,
      'topmostSubform[0].Page1[0].FillText19[0]': data.hearing.dept,
      'topmostSubform[0].Page1[0].FillText20[0]': data.hearing.room || '',
    };
    
    // Appearances (Page 1)
    const appearanceFields = {
      'topmostSubform[0].Page1[0].FillText21[0]': data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText22[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].FillText23[0]': data.conservatee.attorney_name || '',
      'topmostSubform[0].Page1[0].FillText24[0]': data.conservatee.phone || '',
      'topmostSubform[0].Page1[0].FillText25[0]': data.conservatee.address,
      'topmostSubform[0].Page1[0].FillText26[0]': data.conservatee.name,
      'topmostSubform[0].Page1[0].FillText27[0]': '', // Other appearances
      'topmostSubform[0].Page1[0].FillText28[0]': '', // Additional info
    };
    
    // Findings (Page 1-2)
    const findingsFields = {
      'topmostSubform[0].Page1[0].FillText29[0]': '', // Additional findings
      'topmostSubform[0].Page1[0].FillText30[0]': '', // Medical consent date
      'topmostSubform[0].Page2[0].FillText31[0]': '', // Special powers
    };
    
    // Conservator Appointment (Page 2)
    const appointmentFields = {
      'topmostSubform[0].Page2[0].FillText32[0]': data.conservator.license_number || '',
      'topmostSubform[0].Page2[0].FillText33[0]': data.conservator.license_issue_date || '',
      'topmostSubform[0].Page2[0].FillText34[0]': data.conservator.license_expiry_date || '',
      'topmostSubform[0].Page2[0].FillText35[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page2[0].FillText36[0]': data.conservator.phone || data.petitioner.phone,
      'topmostSubform[0].Page2[0].FillText37[0]': data.conservator.address || data.petitioner.address,
      'topmostSubform[0].Page2[0].FillText38[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].FillText39[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page2[0].FillText40[0]': data.conservator.address || data.petitioner.address,
      'topmostSubform[0].Page2[0].FillText41[0]': data.conservator.phone || data.petitioner.phone,
      'topmostSubform[0].Page2[0].FillText42[0]': data.conservatee.name,
    };
    
    // Bond Information (Page 2)
    const bondFields = {
      'topmostSubform[0].Page2[0].FillText43[0]': data.bond.amount || '',
      'topmostSubform[0].Page2[0].FillText44[0]': data.bond.blocked_amount || '',
      'topmostSubform[0].Page2[0].FillText45[0]': data.bond.institution || '',
    };
    
    // Legal Fees (Page 3)
    const feeFields = {
      'topmostSubform[0].Page3[0].FillText46[0]': data.fees.amount || '',
      'topmostSubform[0].Page3[0].FillText47[0]': data.attorney.name,
      'topmostSubform[0].Page3[0].FillText48[0]': '', // Additional payee
      'topmostSubform[0].Page3[0].FillText49[0]': '', // Additional amount
      'topmostSubform[0].Page3[0].FillText50[0]': '', // Payment terms
    };
    
    // Additional Orders (Page 3)
    const additionalOrdersFields = {
      'topmostSubform[0].Page3[0].FillText51[0]': '', // Other orders
      'topmostSubform[0].Page3[0].FillText52[0]': '0', // Number of pages attached
    };
    
    // Judge Signature (Page 3)
    const signatureFields = {
      'topmostSubform[0].Page3[0].FillText53[0]': formatDate(new Date()),
      'topmostSubform[0].Page3[0].FillText54[0]': '', // Judge signature
      'topmostSubform[0].Page3[0].FillText55[0]': '', // Judicial officer
    };
    
    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...caseFields,
      ...hearingFields,
      ...appearanceFields,
      ...findingsFields,
      ...appointmentFields,
      ...bondFields,
      ...feeFields,
      ...additionalOrdersFields,
      ...signatureFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Type of Conservatorship (header) - appears on all pages
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].ChckBx22[0]': data.is_limited || false,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBox23[0]': data.is_successor || false,
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].FormTitle[0].CheckBox22[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].FormTitle[0].CheckBx22[0]': data.conservatorship_type === 'estate',
      
      // Hearing location (Page 1)
      'topmostSubform[0].Page1[0].CheckBox06[0]': true, // Dept
      'topmostSubform[0].Page1[0].CheckBox07[0]': data.hearing.room ? true : false, // Room
      
      // Appearances (Page 1)
      'topmostSubform[0].Page1[0].CheckBox08[0]': true, // Petitioner appeared
      'topmostSubform[0].Page1[0].CheckBox09[0]': true, // Attorney for petitioner
      'topmostSubform[0].Page1[0].CheckBox10[0]': false, // Attorney for conservatee
      'topmostSubform[0].Page1[0].CheckBox11[0]': false, // Court investigator
      'topmostSubform[0].Page1[0].CheckBox12[0]': false, // Court visitor
      'topmostSubform[0].Page1[0].CheckBox13[0]': false, // Regional center
      'topmostSubform[0].Page1[0].CheckBox14[0]': false, // Other person 1
      'topmostSubform[0].Page1[0].CheckBox14[1]': false, // Other person 2
      'topmostSubform[0].Page1[0].CheckBox14[2]': false, // Other person 3
      'topmostSubform[0].Page1[0].CheckBox14[3]': true, // Person cited present
      'topmostSubform[0].Page1[0].CheckBox15[0]': false, // Not present
      'topmostSubform[0].Page1[0].CheckBox16[0]': true, // Conservatee present
      
      // Findings (Page 1)
      'topmostSubform[0].Page1[0].CheckBox17[0]': data.conservatee.unable_provide_needs !== false,
      'topmostSubform[0].Page1[0].CheckBox18[0]': data.conservatee.unable_manage_finances !== false,
      'topmostSubform[0].Page1[0].CheckBox19[0]': false, // No suitable alternative
      'topmostSubform[0].Page1[0].CheckBox20[0]': true, // Is an adult
      'topmostSubform[0].Page1[0].CheckBox21[0]': data.medical_consent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox24[0]': false, // Limited conservatee
      'topmostSubform[0].Page1[0].CheckBox25[0]': false, // Developmental disability
      'topmostSubform[0].Page1[0].CheckBox26[0]': false, // Repeated acts
      'topmostSubform[0].Page1[0].CheckBox27[0]': false, // Unable to resist
      'topmostSubform[0].Page1[0].CheckBox28[0]': true, // Best interest
      'topmostSubform[0].Page1[0].CheckBox29[0]': true, // Qualified person
      'topmostSubform[0].Page1[0].CheckBox30[0]': false, // Regional center assessment
      'topmostSubform[0].Page1[0].CheckBox31[0]': false, // Least restrictive
      'topmostSubform[0].Page1[0].CheckBox32[0]': false, // Necessary and appropriate
      'topmostSubform[0].Page1[0].CheckBox33[0]': false, // Notice given
      'topmostSubform[0].Page1[0].CheckBox34[0]': true, // Rights advisement
      'topmostSubform[0].Page1[0].CheckBox35[0]': false, // Not attend hearing
      'topmostSubform[0].Page1[0].CheckBox36[0]': false, // Unable to attend
      'topmostSubform[0].Page1[0].CheckBox37[0]': false, // Health reasons
      'topmostSubform[0].Page1[0].CheckBox38[0]': false, // Out of state
      'topmostSubform[0].Page1[0].CheckBox39[0]': false, // Unable complete affidavit
      'topmostSubform[0].Page1[0].CheckBox40[0]': false, // Other findings
      
      // Appointment type (Page 2)
      'topmostSubform[0].Page2[0].CheckBox41[0]': !data.is_limited,
      'topmostSubform[0].Page2[0].CheckBox41[1]': data.is_limited,
      'topmostSubform[0].Page2[0].OrderEstAppt[0]': !data.is_limited && data.conservatorship_type === 'estate',
      'topmostSubform[0].Page2[0].OrderEstAppt[1]': data.is_limited && data.conservatorship_type === 'estate',
      'topmostSubform[0].Page2[0].CheckBox42[0]': false, // Successor conservator
      'topmostSubform[0].Page2[0].CheckBox43[0]': false, // Professional fiduciary
      
      // Bond (Page 2)
      'topmostSubform[0].Page2[0].CheckBox44[0]': !data.bond.required,
      'topmostSubform[0].Page2[0].CheckBox45[0]': data.bond.required,
      'topmostSubform[0].Page2[0].CheckBox46[0]': data.bond.blocked_amount ? true : false,
      'topmostSubform[0].Page2[0].CheckBox47[0]': false, // Receipts filed
      'topmostSubform[0].Page2[0].CheckBox48[0]': false, // Sufficient
      'topmostSubform[0].Page2[0].CheckBox49[0]': false, // Insufficient
      
      // Legal fees (Page 3)
      'topmostSubform[0].Page3[0].CheckBox50[0]': data.fees.amount ? true : false,
      'topmostSubform[0].Page3[0].CheckBox51[0]': false, // From conservatee
      'topmostSubform[0].Page3[0].CheckBox51[1]': true, // From estate
      'topmostSubform[0].Page3[0].CheckBox52[0]': true, // Forthwith
      'topmostSubform[0].Page3[0].CheckBox52[1]': false, // Upon filing
      'topmostSubform[0].Page3[0].CheckBox53[0]': false, // Additional fees
      
      // Voting rights
      'topmostSubform[0].Page3[0].CheckBox54[0]': data.conservatee.disqualified_voting || false,
      
      // Medical treatment
      'topmostSubform[0].Page3[0].CheckBox55[0]': data.medical_consent_powers || false,
      'topmostSubform[0].Page3[0].CheckBox56[0]': false, // Dementia placement
      'topmostSubform[0].Page3[0].CheckBox57[0]': false, // Not authorized dementia
      'topmostSubform[0].Page3[0].CheckBox58[0]': false, // Major neurocognitive
      'topmostSubform[0].Page3[0].CheckBox59[0]': false, // Limited authority
      'topmostSubform[0].Page3[0].CheckBox60[0]': false, // Powers specified
      'topmostSubform[0].Page3[0].CheckBox61[0]': false, // Powers attachment
      'topmostSubform[0].Page3[0].CheckBox62[0]': false, // Independent powers
      'topmostSubform[0].Page3[0].CheckBox63[0]': false, // Successor trustee
      'topmostSubform[0].Page3[0].CheckBox64[0]': false, // Trust assets
      'topmostSubform[0].Page3[0].CheckBox65[0]': false, // Will substituted judgment
      'topmostSubform[0].Page3[0].CheckBox66[0]': false, // Not substituted judgment
      'topmostSubform[0].Page3[0].CheckBox67[0]': false, // Make gifts
      'topmostSubform[0].Page3[0].CheckBox68[0]': false, // Not make gifts
      'topmostSubform[0].Page3[0].CheckBox69[0]': false, // Additional duties
      'topmostSubform[0].Page3[0].CheckBox70[0]': false, // Continued attachment
      'topmostSubform[0].Page3[0].CheckBox71[0]': false, // Continue date
      'topmostSubform[0].Page3[0].CheckBox72[0]': false, // Review hearing
      'topmostSubform[0].Page3[0].CheckBox73[0]': false, // Accounting waived
      'topmostSubform[0].Page3[0].CheckBox74[0]': false, // Limited time
      'topmostSubform[0].Page3[0].CheckBox75[0]': false, // Good cause exists
      'topmostSubform[0].Page3[0].CheckBox76[0]': false, // Costs waived
      'topmostSubform[0].Page3[0].CheckBox77[0]': false, // Annual accounting
      'topmostSubform[0].Page3[0].CheckBox78[0]': false, // Biennial accounting
      'topmostSubform[0].Page3[0].CheckBox79[0]': false, // Triennial accounting
      'topmostSubform[0].Page3[0].CheckBox80[0]': false, // Letters issue
      'topmostSubform[0].Page3[0].CheckBox81[0]': false, // Enhanced letters
      'topmostSubform[0].Page3[0].CheckBox82[0]': false, // Limited letters
      'topmostSubform[0].Page3[0].CheckBox83[0]': false, // Other orders attachment
      'topmostSubform[0].Page3[0].CheckBox84[0]': false, // Other specify
      'topmostSubform[0].Page3[0].CheckBox85[0]': true, // Order effective
      'topmostSubform[0].Page3[0].CheckBox86[0]': true, // Date signed
      'topmostSubform[0].Page3[0].CheckBox87[0]': false, // Other effective date
    };
    
    // Set all checkboxes
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
    console.error('Error filling GC-340:', error);
    throw error;
  }
}

// GC-350 Form Filler Function (Letters of Conservatorship) - COMPLETE
async function fillGC350(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-350 has ${form.getFields().length} fields available`);
    
    // Attorney Information
    const attorneyFields = {
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Add1_ft[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Add2_ft[0]': data.attorney.firm_name,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Add3_ft[0]': data.attorney.street,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Add4_ft[0]': `${data.attorney.city}, ${data.attorney.state} ${data.attorney.zip}`,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Tel_ft[0]': data.attorney.phone,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Tel_ft[1]': data.attorney.email,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Tel_ft[2]': data.attorney.fax,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].AttyPartyInfo_sf[0].Tel_ft[3]': `Petitioner ${data.petitioner.name}`,
    };
    
    // Court Information
    const courtFields = {
      'topmostSubform[0].Page1[0].EJHeader_sf[0].CrtInfo_sf[0].Crtname_ft[0]': data.court.county,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].CrtInfo_sf[0].CrtStreetAdd_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].CrtInfo_sf[0].CrtMail_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].CrtInfo_sf[0].CrtCityZip_ft[0]': `${data.court.city}, CA ${data.court.zip}`,
      'topmostSubform[0].Page1[0].EJHeader_sf[0].CrtInfo_sf[0].CrtBranch[0]': data.court.branch,
    };
    
    // Case Information
    const caseFields = {
      'topmostSubform[0].Page1[0].EJHeader_sf[0].CaseNumber_sf_sf[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page1[0].EJHeader_sf[0].Party_sf[0].Party_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].Party_sf[0].Party_ft[0]': data.conservatee.name,
      'topmostSubform[0].Page2[0].CaseNumber_sf_sf[0].CaseNumber_ft[0]': data.case_number || '',
    };
    
    // Appointment Information (Page 1)
    const appointmentFields = {
      'topmostSubform[0].Page1[0].FillText75[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText76[0]': '', // Co-conservator if any
      'topmostSubform[0].Page1[0].FillText77[0]': '', // Additional conservator
      'topmostSubform[0].Page1[0].FillText78[0]': '', // Successor conservator
      'topmostSubform[0].Page1[0].FillText79[0]': data.conservatee.name,
      'topmostSubform[0].Page1[0].FillText80[0]': '', // Additional conservatee
      'topmostSubform[0].Page1[0].FillText81[0]': '', // Additional estate text
      'topmostSubform[0].Page1[0].FillText82[0]': '', // Professional fiduciary info
      'topmostSubform[0].Page1[0].FillText83[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText84[0]': '', // Co-conservator for estate
      'topmostSubform[0].Page1[0].FillText85[0]': '', // Additional estate conservator
      'topmostSubform[0].Page1[0].FillText86[0]': '', // Successor estate conservator
      'topmostSubform[0].Page1[0].FillText87[0]': '', // Other specification
      'topmostSubform[0].Page1[0].FillText87400[0]': data.conservatee.name,
    };
    
    // Authority/Powers fields (Page 1)
    const authorityFields = {
      'topmostSubform[0].Page1[0].FillTxt87400[0]': '', // Medical authority termination date
      'topmostSubform[0].Page1[0].FillText88[0]': '', // Placement authority date
      'topmostSubform[0].Page1[0].FillText89[0]': '', // Additional powers text
      'topmostSubform[0].Page1[0].FillText90[0]': '', // Property conditions text
      'topmostSubform[0].Page1[0].FillText91[0]': '', // Care conditions text
      'topmostSubform[0].Page1[0].FillText92[0]': '', // Limited conservator powers
      'topmostSubform[0].Page1[0].FillText93[0]': '', // Limited estate powers
      'topmostSubform[0].Page1[0].FillText94[0]': '', // Other conditions text
      'topmostSubform[0].Page1[0].FillText6[0]': '0', // Number of pages attached
    };
    
    // Clerk/Court Certification (Page 1)
    const certificationFields = {
      'topmostSubform[0].Page1[0].FillText181[0]': formatDate(new Date()),
      'topmostSubform[0].Page1[0].FillText182[0]': '', // Deputy clerk
      'topmostSubform[0].Page1[0].FillText183[0]': '', // Clerk signature
    };
    
    // Affirmation/Oath (Page 2)
    const oathFields = {
      'topmostSubform[0].Page2[0].FillText31[0]': formatDate(new Date()),
      'topmostSubform[0].Page2[0].FillText35[0]': `${data.court.city}, California`,
      'topmostSubform[0].Page2[0].FillText36[0]': '', // Commissioner/Judge
      'topmostSubform[0].Page2[0].FillText37[0]': '', // Deputy
      'topmostSubform[0].Page2[0].FillText38[0]': '', // Notary seal
      'topmostSubform[0].Page2[0].FillText39[0]': formatDate(new Date()),
      'topmostSubform[0].Page2[0].FillText40[0]': '', // Signature line 1
      'topmostSubform[0].Page2[0].FillText41[0]': '', // Signature line 2
      'topmostSubform[0].Page2[0].FillText42[0]': '', // Signature line 3
      'topmostSubform[0].Page2[0].FillText43[0]': data.conservator.name || data.petitioner.name,
      'topmostSubform[0].Page2[0].FillText44[0]': '', // Additional appointee
    };
    
    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...caseFields,
      ...appointmentFields,
      ...authorityFields,
      ...certificationFields,
      ...oathFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Type of Conservatorship (header)
      'topmostSubform[0].Page1[0].EJHeader_sf[0].Title_sf[0].Person[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].EJHeader_sf[0].Title_sf[0].Estate[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].EJHeader_sf[0].Title_sf[0].LimitedConsShip[0]': data.is_limited || false,
      
      // Conservator type
      'topmostSubform[0].Page1[0].CheckBox29[0]': !data.is_limited,
      'topmostSubform[0].Page1[0].CheckBox30[0]': data.is_limited,
      'topmostSubform[0].Page1[0].CheckBox290[0]': false, // Co-conservator
      'topmostSubform[0].Page1[0].CheckBox300[0]': false, // Successor
      
      // Conservatorship of
      'topmostSubform[0].Page1[0].CheckBox31[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].CheckBx31[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].CheckBox32[0]': false, // Professional fiduciary
      'topmostSubform[0].Page1[0].CheckBox33[0]': false, // Corporate fiduciary
      'topmostSubform[0].Page1[0].CheckBox34[0]': false, // Nonprofessional
      'topmostSubform[0].Page1[0].CheckBox35[0]': false, // Public guardian
      'topmostSubform[0].Page1[0].CheckBox36[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].CheckBx36[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].CheckBox37[0]': !data.is_limited,
      'topmostSubform[0].Page1[0].CheckBox38[0]': data.is_limited,
      'topmostSubform[0].Page1[0].CheckBox39[0]': false, // Co-conservator estate
      'topmostSubform[0].Page1[0].CheckBox391[0]': false, // Successor estate
      'topmostSubform[0].Page1[0].CheckBox40[0]': data.conservatorship_type === 'person',
      'topmostSubform[0].Page1[0].CheckBx40[0]': data.conservatorship_type === 'estate',
      'topmostSubform[0].Page1[0].CheckBox41[0]': false, // Professional estate
      'topmostSubform[0].Page1[0].CheckBox42[0]': false, // Corporate estate
      'topmostSubform[0].Page1[0].CheckBox43[0]': false, // Nonprofessional estate
      'topmostSubform[0].Page1[0].CheckBox44[0]': false, // Public guardian estate
      
      // Medical consent authority
      'topmostSubform[0].Page1[0].CheckBox217[0]': data.medical_consent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox218[0]': false, // Religious healing
      'topmostSubform[0].Page1[0].CheckBox16[0]': false, // Limited duration
      
      // Placement authority
      'topmostSubform[0].Page1[0].CheckBox17[0]': data.placement_authority || false,
      'topmostSubform[0].Page1[0].CheckBox1001[0]': data.dementia_authority || false,
      'topmostSubform[0].Page1[0].CheckBox18[0]': false, // Placement limited date
      
      // Powers and conditions
      'topmostSubform[0].Page1[0].CheckBox1[0]': false, // Other powers granted
      'topmostSubform[0].Page1[0].CheckBox1000[0]': false, // Powers attachment
      'topmostSubform[0].Page1[0].CheckBox1002[0]': false, // Powers specified below
      'topmostSubform[0].Page1[0].CheckBox2171[0]': data.independent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox2181[0]': false, // Property conditions granted
      'topmostSubform[0].Page1[0].CheckBox2180[0]': false, // Property attachment
      'topmostSubform[0].Page1[0].CheckBox2182[0]': false, // Property specified
      'topmostSubform[0].Page1[0].CheckBox1601[0]': false, // Care conditions granted
      'topmostSubform[0].Page1[0].CheckBox1600[0]': false, // Care attachment
      'topmostSubform[0].Page1[0].CheckBox1602[0]': false, // Care specified
      'topmostSubform[0].Page1[0].CheckBox1701[0]': data.is_limited, // Limited person powers
      'topmostSubform[0].Page1[0].CheckBox1700[0]': false, // Limited attachment
      'topmostSubform[0].Page1[0].CheckBox1702[0]': !data.take_possession || false,
      'topmostSubform[0].Page1[0].CheckBox2183[0]': data.is_limited, // Limited estate powers
      'topmostSubform[0].Page1[0].CheckBox2184[0]': false, // Limited estate attachment
      'topmostSubform[0].Page1[0].CheckBox2185[0]': false, // Limited estate specified
      'topmostSubform[0].Page1[0].CheckBox1801[0]': false, // Other conditions
      'topmostSubform[0].Page1[0].CheckBox1800[0]': false, // Other attachment
      'topmostSubform[0].Page1[0].CheckBox1802[0]': false, // Other specified
      
      // Appointment certification
      'topmostSubform[0].Page1[0].#area[0].CheckBox61[0]': true, // Appointed and qualified
      
      // Affirmation (Page 2)
      'topmostSubform[0].Page2[0].CheckBox2184[0]': !data.is_limited,
      'topmostSubform[0].Page2[0].CheckBx2184[0]': data.is_limited,
      'topmostSubform[0].Page2[0].CheckBox62[0]': false, // Court
      'topmostSubform[0].Page2[0].CheckBox63[0]': false, // Commissioner
      'topmostSubform[0].Page2[0].CheckBox64[0]': false, // Deputy
      'topmostSubform[0].Page2[0].CheckBox65[0]': false, // Notary
    };
    
    // Set all checkboxes
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
    console.error('Error filling GC-350:', error);
    throw error;
  }
}

// Main function to fill all conservatorship forms
async function fillConservatorshipForms(data) {
  const results = {};
  
  const forms = [
    { name: 'GC-310', filler: fillGC310 },
    { name: 'GC-312', filler: fillGC312 },
    { name: 'GC-320', filler: fillGC320 },
    { name: 'GC-340', filler: fillGC340 },
    { name: 'GC-350', filler: fillGC350 },
  ];
  
  for (const { name, filler } of forms) {
    try {
      console.log(`Processing ${name}...`);
      const pdfBytes = await loadPDFFromRepo(`${name}.pdf`);
      results[name] = await filler(data, pdfBytes);
      console.log(`${name} completed`);
    } catch (error) {
      console.error(`Error with ${name}:`, error);
      results[name] = Buffer.from(`Error processing ${name}`);
    }
  }
  
  return results;
}

// Netlify Function Handler
exports.handler = async (event, context) => {
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
    
    console.log('Received conservatorship form submission for:', webhookData.conservatee_name);
    
    const transformedData = transformConservatorshipData(webhookData);
    
    console.log('Data transformed, filling conservatorship PDFs...');
    
    const pdfs = await fillConservatorshipForms(transformedData);
    
    const response = {
      success: true,
      message: 'Conservatorship PDFs generated successfully',
      timestamp: new Date().toISOString().split('T')[0],
      metadata: {
        conservatee: transformedData.conservatee.name,
        conservator: transformedData.conservator.name,
        petitioner: transformedData.petitioner.name,
        conservatorship_type: transformedData.conservatorship_type,
        forms_generated: Object.keys(pdfs).filter(key => pdfs[key].length > 50)
      },
      pdfs: {
        'GC-310': Buffer.from(pdfs['GC-310']).toString('base64'),
        'GC-312': Buffer.from(pdfs['GC-312']).toString('base64'),
        'GC-320': Buffer.from(pdfs['GC-320']).toString('base64'),
        'GC-340': Buffer.from(pdfs['GC-340']).toString('base64'),
        'GC-350': Buffer.from(pdfs['GC-350']).toString('base64'),
      }
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
    console.error('Error processing conservatorship form:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to process conservatorship form',
        details: error.message 
      }),
    };
  }
};

