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
        address: parts[2] || '',
        relationship: parts[3] || '',
      };
    });
  }
  return minorsList || [];
}

// Transform webhook data for guardianship forms
function transformGuardianshipData(webhookData) {
  const minors = parseMinors(webhookData.minors_list);
  const personalProperty = parseFloat((webhookData.personal_property_value || '0').toString().replace(/[^0-9.-]/g, '')) || 0;
  const realProperty = parseFloat((webhookData.real_property_value || '0').toString().replace(/[^0-9.-]/g, '')) || 0;
  const totalEstate = personalProperty + realProperty;
  
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
      name: webhookData.petitioner_name,
      address: webhookData.petitioner_address,
      phone: webhookData.petitioner_phone,
      relationship: webhookData.petitioner_relationship,
      is_related: webhookData.petitioner_related === "yes",
    },
    guardian: {
      name: webhookData.guardian_name || webhookData.petitioner_name,
      address: webhookData.guardian_address || webhookData.petitioner_address,
      phone: webhookData.guardian_phone || webhookData.petitioner_phone,
      ssn: webhookData.guardian_ssn || '',
      driver_license: webhookData.guardian_dl || '',
      state: webhookData.guardian_state || 'CA',
      home_phone: webhookData.guardian_home_phone || '',
      work_phone: webhookData.guardian_work_phone || '',
      other_phone: webhookData.guardian_other_phone || '',
    },
    minor: {
      name: minors[0]?.name || webhookData.minor_name,
      birthdate: minors[0]?.birthdate || webhookData.minor_birthdate,
      address: minors[0]?.address || webhookData.minor_address,
      home_phone: webhookData.minor_home_phone || '',
      school: webhookData.minor_school || '',
      school_phone: webhookData.minor_school_phone || '',
    },
    minors: minors,
    guardianship_type: webhookData.guardianship_type || "person", // "person" or "estate"
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
      judge: webhookData.hearing_judge || "",
    },
    bond: {
      required: webhookData.bond_required === "yes",
      amount: formatCurrency(webhookData.bond_amount || 0),
      blocked_account: formatCurrency(webhookData.blocked_account || 0),
      institution: webhookData.bond_institution || "",
    },
    estate: {
      personal_property: formatCurrency(personalProperty),
      real_property: formatCurrency(realProperty),
      total: formatCurrency(totalEstate),
    },
    independent_powers: webhookData.independent_powers === "yes",
    dispense_notice: webhookData.dispense_notice === "yes",
    fees: {
      amount: formatCurrency(webhookData.attorney_fees || 0),
      terms: webhookData.fee_terms || "forthwith",
    },
    investigator: {
      appointed: webhookData.investigator_appointed === "yes",
      info: webhookData.investigator_info || "",
    },
    referee: {
      appointed: webhookData.referee_appointed === "yes",
      info: webhookData.referee_info || "",
    },
    // GC-212 specific screening questions
    screening: {
      related_to_minor: webhookData.related_to_minor === "yes",
      convicted_felony: webhookData.convicted_felony === "yes",
      arrested_drug_alcohol: webhookData.arrested_drug_alcohol === "yes",
      convicted_misdemeanor_violence: webhookData.convicted_misdemeanor_violence === "yes",
      domestic_violence_restraining: webhookData.domestic_violence_restraining === "yes",
      court_found_abused_child: webhookData.court_found_abused_child === "yes",
      court_found_abused_adult: webhookData.court_found_abused_adult === "yes",
      under_conservatorship: webhookData.under_conservatorship === "yes",
      unable_to_provide_care: webhookData.unable_to_provide_care === "yes",
      central_index: webhookData.central_index === "yes",
      health_safety_central_index: webhookData.health_safety_central_index === "yes",
      denied_license_care_children: webhookData.denied_license_care_children === "yes",
      financial_conflict: webhookData.financial_conflict === "yes",
      been_guardian_conservator_trustee: webhookData.been_guardian_conservator_trustee === "yes",
      been_removed_as_guardian: webhookData.been_removed_as_guardian === "yes",
      professional_fiduciary: webhookData.professional_fiduciary === "yes",
      public_entity: webhookData.public_entity === "yes",
      private_guardian: webhookData.private_guardian === "yes",
      minor_lives_with_you: webhookData.minor_lives_with_you === "yes",
    },
    additional_minors_attached: minors.length > 3,
  };
}

// Load PDF from deployed Netlify site
async function loadPDFFromRepo(filename) {
  const fetch = (await import('node-fetch')).default;
  // IMPORTANT: Update this URL to match your deployed guardianship app
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

// GC-210 Form Filler Function (Petition for Guardianship) - COMPLETE
async function fillGC210(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-210 has ${form.getFields().length} fields available`);
    
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
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].TitlePartyName[0].Party2_ft[0]': data.minor.name,
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.minor.name,
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || 'To be assigned',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].TitlePartyName[0].Party2_ft[0]': data.minor.name,
    };
    
    // Hearing Information
    const hearingFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].HearingInfo_sf[0].HearingDateTime_ft[0]': data.hearing.datetime,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].HearingInfo_sf[0].Dept_ft[0]': data.hearing.dept,
    };
    
    // Petitioner Information (Section 1a)
    const petitionerFields = {
      'topmostSubform[0].Page1[0].FillText5[0]': data.petitioner.name,
      'topmostSubform[0].Page1[0].FillText6[0]': data.petitioner.address,
      'topmostSubform[0].Page1[0].FillTxt6[0]': data.petitioner.phone,
    };
    
    // Guardian Information (if different from petitioner - Section 1b)
    const guardianFields = {
      'topmostSubform[0].Page1[0].FillText5[1]': data.guardian.name || '',
      'topmostSubform[0].Page1[0].FillText6[1]': data.guardian.address || '',
      'topmostSubform[0].Page1[0].FillTxt6[1]': data.guardian.phone || '',
    };
    
    // Minor Information (Section 2 - up to 4 minors)
    const minorFields = {};
    if (data.minors && data.minors.length > 0) {
      for (let i = 0; i < Math.min(data.minors.length, 4); i++) {
        const minor = data.minors[i];
        minorFields[`topmostSubform[0].Page1[0].FillText11[${i}]`] = minor.name || '';
        minorFields[`topmostSubform[0].Page1[0].FillText71[${i}]`] = minor.birthdate || '';
      }
    }
    
    // Additional minor fields that may exist
    const additionalMinorFields = {
      'topmostSubform[0].Page1[0].FillText12[0]': '',
      'topmostSubform[0].Page1[0].FillText13[0]': '',
      'topmostSubform[0].Page1[0].FillText14[0]': '',
      'topmostSubform[0].Page1[0].FillText15[0]': '',
    };
    
    // Bond Information (Section 1c/1d)
    const bondFields = {
      'topmostSubform[0].Page1[0].FillText9[0]': data.bond.amount || '',
      'topmostSubform[0].Page1[0].FillText10[0]': data.bond.blocked_account || '',
      'topmostSubform[0].Page1[0].FillText165[0]': data.bond.institution || '',
      'topmostSubform[0].Page1[0].FillText166[0]': '',
      'topmostSubform[0].Page1[0].FillText167[0]': '',
    };
    
    // Powers and Notice Fields
    const powersFields = {
      'topmostSubform[0].Page1[0].FillText168[0]': '',
      'topmostSubform[0].Page1[0].FillText169[0]': '',
      'topmostSubform[0].Page1[0].FillText170[0]': '',
    };
    
    // Page 2 Fields - Relationship and Reasons
    const relationshipFields = {
      'topmostSubform[0].Page2[0].FillText171[0]': data.petitioner.relationship || '',
      'topmostSubform[0].Page2[0].FillText172[0]': '',
      'topmostSubform[0].Page2[0].FillText173[0]': '',
      'topmostSubform[0].Page2[0].FillText174[0]': '',
      'topmostSubform[0].Page2[0].FillText175[0]': '',
      'topmostSubform[0].Page2[0].FillText176[0]': '',
      'topmostSubform[0].Page2[0].FillText177[0]': '',
    };
    
    // Estate Values (Page 2, Section 8)
    const estateFields = {
      'topmostSubform[0].Page2[0].FillText78[0]': data.estate.personal_property || '',
      'topmostSubform[0].Page2[0].FillText79[0]': data.estate.real_property || '',
      'topmostSubform[0].Page2[0].FillText78[1]': data.estate.total || '',
      'topmostSubform[0].Page2[0].FillText80[0]': '',
      'topmostSubform[0].Page2[0].FillText81[0]': '',
      'topmostSubform[0].Page2[0].FillText82[0]': '',
      'topmostSubform[0].Page2[0].FillText83[0]': '',
    };
    
    // Page 3 Fields - Additional Information
    const additionalInfoFields = {
      'topmostSubform[0].Page3[0].FillText84[0]': '',
      'topmostSubform[0].Page3[0].FillText85[0]': '',
      'topmostSubform[0].Page3[0].FillText86[0]': '',
      'topmostSubform[0].Page3[0].FillText87[0]': '',
      'topmostSubform[0].Page3[0].FillText88[0]': '',
      'topmostSubform[0].Page3[0].FillText89[0]': '',
      'topmostSubform[0].Page3[0].FillText90[0]': '0',
    };
    
    // Signatures (Page 3)
    const signatureFields = {
      'topmostSubform[0].Page3[0].FillText17[0]': data.petitioner.name,
      'topmostSubform[0].Page3[0].FillText25[0]': formatDate(new Date()),
      'topmostSubform[0].Page3[0].FillText17[1]': data.attorney.name,
      'topmostSubform[0].Page3[0].FillText25[1]': formatDate(new Date()),
      'topmostSubform[0].Page3[0].FillText18[0]': '',
      'topmostSubform[0].Page3[0].FillText26[0]': '',
      'topmostSubform[0].Page3[0].FillText19[0]': '',
      'topmostSubform[0].Page3[0].FillText27[0]': '',
    };
    
    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...caseFields,
      ...hearingFields,
      ...petitionerFields,
      ...guardianFields,
      ...minorFields,
      ...additionalMinorFields,
      ...bondFields,
      ...powersFields,
      ...relationshipFields,
      ...estateFields,
      ...additionalInfoFields,
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
      // Type of Guardianship (header) - appears on all pages
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].ChckBx22[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].ChckBx22[1]': data.guardianship_type === 'estate',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBox22[0]': data.minors.length === 1,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].CheckBx22[0]': data.minors.length > 1,
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].FormTitle[0].ChckBx22[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page2[0].CaptionPx_sf[0].FormTitle[0].ChckBx22[1]': data.guardianship_type === 'estate',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].FormTitle[0].ChckBx22[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page3[0].CaptionPx_sf[0].FormTitle[0].ChckBx22[1]': data.guardianship_type === 'estate',
      
      // Petitioner is proposed guardian (Section 1b)
      'topmostSubform[0].Page1[0].CheckBox1[0]': true,
      'topmostSubform[0].Page1[0].CheckBox2[0]': false,
      
      // Bond requirements (Section 1c)
      'topmostSubform[0].Page1[0].CheckBox9[0]': !data.bond.required,
      'topmostSubform[0].Page1[0].CheckBox11[0]': !data.bond.required && data.guardianship_type === 'person',
      'topmostSubform[0].Page1[0].CheckBox7[0]': data.bond.required,
      'topmostSubform[0].Page1[0].CheckBox8[0]': data.bond.blocked_account ? true : false,
      'topmostSubform[0].Page1[0].CheckBox10[0]': false,
      'topmostSubform[0].Page1[0].CheckBox12[0]': false,
      'topmostSubform[0].Page1[0].CheckBox13[0]': false,
      
      // Other petition requests (Section 1e)
      'topmostSubform[0].Page1[0].CheckBox5[0]': data.independent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox3[0]': data.dispense_notice || false,
      'topmostSubform[0].Page1[0].CheckBox4[0]': false,
      'topmostSubform[0].Page1[0].CheckBox6[0]': false,
      
      // Petitioner relationship (Page 2, Section 3)
      'topmostSubform[0].Page2[0].CheckBox40[0]': data.petitioner.is_related || false,
      'topmostSubform[0].Page2[0].CheckBox41[0]': false,
      'topmostSubform[0].Page2[0].CheckBox42[0]': false,
      'topmostSubform[0].Page2[0].CheckBox39[0]': false,
      'topmostSubform[0].Page2[0].CheckBox38[0]': false,
      'topmostSubform[0].Page2[0].CheckBox37[0]': false,
      'topmostSubform[0].Page2[0].CheckBox36[0]': false,
      'topmostSubform[0].Page2[0].CheckBox35[0]': false,
      'topmostSubform[0].Page2[0].CheckBox34[0]': false,
      'topmostSubform[0].Page2[0].CheckBox33[0]': false,
      'topmostSubform[0].Page2[0].CheckBox32[0]': false,
      'topmostSubform[0].Page2[0].CheckBox31[0]': false,
      'topmostSubform[0].Page2[0].CheckBox30[0]': false,
      
      // Reasons for guardianship (Page 2, Section 4-7)
      'topmostSubform[0].Page2[0].CheckBox29[0]': true,
      'topmostSubform[0].Page2[0].CheckBox28[0]': false,
      'topmostSubform[0].Page2[0].CheckBox27[0]': false,
      'topmostSubform[0].Page2[0].CheckBox26[0]': false,
      'topmostSubform[0].Page2[0].CheckBox25[0]': false,
      'topmostSubform[0].Page2[0].CheckBox24[0]': false,
      'topmostSubform[0].Page2[0].CheckBox23[0]': false,
      'topmostSubform[0].Page2[0].CheckBox22[0]': false,
      'topmostSubform[0].Page2[0].CheckBox21[0]': false,
      'topmostSubform[0].Page2[0].CheckBox20[0]': false,
      
      // Required forms attached (Page 3, Section 11)
      'topmostSubform[0].Page3[0].CheckBox44[0]': true,
      'topmostSubform[0].Page3[0].CheckBox43[0]': true,
      'topmostSubform[0].Page3[0].CheckBox18[0]': true,
      'topmostSubform[0].Page3[0].CheckBox19[0]': false,
      'topmostSubform[0].Page3[0].CheckBox45[0]': false,
      'topmostSubform[0].Page3[0].CheckBox46[0]': false,
      'topmostSubform[0].Page3[0].CheckBox47[0]': false,
      'topmostSubform[0].Page3[0].CheckBox48[0]': false,
      'topmostSubform[0].Page3[0].CheckBox49[0]': false,
      'topmostSubform[0].Page3[0].CheckBox50[0]': false,
      'topmostSubform[0].Page3[0].CheckBox51[0]': false,
      'topmostSubform[0].Page3[0].CheckBox52[0]': false,
      'topmostSubform[0].Page3[0].CheckBox53[0]': false,
      'topmostSubform[0].Page3[0].CheckBox54[0]': false,
      'topmostSubform[0].Page3[0].CheckBox55[0]': false,
      'topmostSubform[0].Page3[0].CheckBox56[0]': false,
      'topmostSubform[0].Page3[0].CheckBox57[0]': false,
      'topmostSubform[0].Page3[0].CheckBox58[0]': false,
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
    console.error('Error filling GC-210:', error);
    throw error;
  }
}

// GC-212 Form Filler Function (Confidential Screening Form) - COMPLETE
async function fillGC212(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-212 has ${form.getFields().length} fields available`);
    
    // Court Information
    const courtFields = {
      'GC-212[0].Page1[0].P1Caption[0].CourtInfo[0].CrtCounty[0]': data.court.county.toUpperCase(),
      'GC-212[0].Page1[0].P1Caption[0].CourtInfo[0].CrtStreet[0]': data.court.street,
      'GC-212[0].Page1[0].P1Caption[0].CourtInfo[0].CrtMailingAdd[0]': data.court.street,
      'GC-212[0].Page1[0].P1Caption[0].CourtInfo[0].CrtBranch[0]': data.court.branch,
      'GC-212[0].Page1[0].P1Caption[0].CourtInfo[0].CrtCityZip[0]': `${data.court.city}, CA ${data.court.zip}`,
    };
    
    // Case Information
    const caseFields = {
      'GC-212[0].Page1[0].P1Caption[0].FormTitle[0].Guadianship[0]': data.minor.name.toUpperCase(),
      'GC-212[0].Page2[0].PxCaption[0].TitlePartyName[0].Guadianship[0]': data.minor.name.toUpperCase(),
      'GC-212[0].Page1[0].P1Caption[0].CaseNumber[0].CaseNumber[0]': data.case_number,
      'GC-212[0].Page2[0].PxCaption[0].CaseNumber[0].CaseNumber[0]': data.case_number,
    };
    
    // Attorney Information
    const attorneyFields = {
      'GC-212[0].Page1[0].P1Caption[0].AttyPartyInfo[0].TextField1[0]': 
        `${data.attorney.name}\n${data.attorney.bar_number}\n${data.attorney.firm_name}\n${data.attorney.street}\n${data.attorney.city}, ${data.attorney.state} ${data.attorney.zip}`,
      'GC-212[0].Page1[0].P1Caption[0].AttyPartyInfo[0].Phone[0]': data.attorney.phone,
      'GC-212[0].Page1[0].P1Caption[0].AttyPartyInfo[0].Fax[0]': data.attorney.fax,
      'GC-212[0].Page1[0].P1Caption[0].AttyPartyInfo[0].Email[0]': data.attorney.email,
      'GC-212[0].Page1[0].P1Caption[0].AttyPartyInfo[0].Attorneyname[0]': `Petitioner ${data.petitioner.name}`,
    };
    
    // Hearing Information
    const hearingFields = {
      'GC-212[0].Page1[0].P1Caption[0].CaseNumber2[0].HearingdateandTime[0]': data.hearing.datetime,
      'GC-212[0].Page1[0].P1Caption[0].CaseNumber2[0].TextField[0]': data.hearing.dept,
      'GC-212[0].Page1[0].HearingDate[0]': data.hearing.date,
    };
    
    // Guardian Information
    const guardianFields = {
      'GC-212[0].Page1[0].TextField[0]': data.guardian.name.toUpperCase(),
      'GC-212[0].Page1[0].TextField[1]': data.guardian.ssn || '',
      'GC-212[0].Page1[0].TextField[2]': data.guardian.driver_license || '',
      'GC-212[0].Page1[0].TextField[3]': data.guardian.state || 'CA',
      'GC-212[0].Page1[0].TextField[4]': data.guardian.home_phone || '',
      'GC-212[0].Page1[0].TextField[5]': data.guardian.work_phone || '',
      'GC-212[0].Page1[0].TextField[6]': data.guardian.other_phone || '',
      'GC-212[0].Page1[0].TextField[7]': '',
      'GC-212[0].Page1[0].TextField[8]': '',
      'GC-212[0].Page1[0].TextField[9]': '',
    };
    
    // Minor Information Fields (up to 3 minors on page 2)
    const minorInfoFields = {};
    const minorFieldSets = [
      { name: 'GC-212[0].Page2[0].TextField[1]', homePhone: 'GC-212[0].Page2[0].TextField[2]', school: 'GC-212[0].Page2[0].TextField[3]', schoolPhone: 'GC-212[0].Page2[0].TextField[4]', otherPhone: 'GC-212[0].Page2[0].TextField[5]' },
      { name: 'GC-212[0].Page2[0].TextField[6]', homePhone: 'GC-212[0].Page2[0].TextField[7]', school: 'GC-212[0].Page2[0].TextField[8]', schoolPhone: 'GC-212[0].Page2[0].TextField[9]', otherPhone: 'GC-212[0].Page2[0].TextField[10]' },
      { name: 'GC-212[0].Page2[0].TextField[11]', homePhone: 'GC-212[0].Page2[0].TextField[12]', school: 'GC-212[0].Page2[0].TextField[13]', schoolPhone: 'GC-212[0].Page2[0].TextField[14]', otherPhone: 'GC-212[0].Page2[0].TextField[15]' }
    ];
    
    for (let i = 0; i < Math.min(data.minors.length, 3); i++) {
      const minor = data.minors[i];
      const fieldSet = minorFieldSets[i];
      minorInfoFields[fieldSet.name] = minor.name ? minor.name.toUpperCase() : '';
      minorInfoFields[fieldSet.homePhone] = data.minor.home_phone || '';
      minorInfoFields[fieldSet.school] = data.minor.school || '';
      minorInfoFields[fieldSet.schoolPhone] = data.minor.school_phone || '';
      minorInfoFields[fieldSet.otherPhone] = '';
    }
    
    // Declaration Section
    const declarationFields = {
      'GC-212[0].Page2[0].#area[10].Date[0]': formatDate(new Date()),
      'GC-212[0].Page2[0].#area[10].PrintName[0]': data.guardian.name.toUpperCase(),
      'GC-212[0].Page2[0].#area[10].Signature[0]': '',
      'GC-212[0].Page2[0].#area[10].Additional[0]': '',
    };
    
    // Corporate Guardian (if applicable)
    const corporateFields = {
      'GC-212[0].Page2[0].TextField[0]': '',
      'GC-212[0].Page2[0].TextField[16]': '',
      'GC-212[0].Page2[0].TextField[17]': '',
      'GC-212[0].Page2[0].TextField[18]': '',
      'GC-212[0].Page2[0].TextField[19]': '',
      'GC-212[0].Page2[0].TextField[20]': '',
    };
    
    // Combine all text fields
    const allTextFields = {
      ...courtFields,
      ...caseFields,
      ...attorneyFields,
      ...hearingFields,
      ...guardianFields,
      ...minorInfoFields,
      ...declarationFields,
      ...corporateFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`GC-212: Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`GC-212: Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Guardianship Type
      'GC-212[0].Page1[0].P1Caption[0].FormTitle2[0].#area[0].CheckBoxCaption[0]': data.guardianship_type === 'person',
      'GC-212[0].Page1[0].P1Caption[0].FormTitle2[0].#area[1].CheckBoxCaption[1]': data.guardianship_type === 'estate',
      
      // Screening Questions Page 1
      'GC-212[0].Page1[0].#area[0].CheckBoxCaption1[0]': data.screening.related_to_minor,
      'GC-212[0].Page1[0].#area[0].CheckBoxCaption1[1]': !data.screening.related_to_minor,
      
      'GC-212[0].Page1[0].#area[1].CheckBoxCaption2[0]': data.screening.convicted_felony,
      'GC-212[0].Page1[0].#area[1].CheckBoxCaption2[1]': !data.screening.convicted_felony,
      'GC-212[0].Page1[0].#area[2].CheckB12[0]': data.screening.arrested_drug_alcohol,
      
      'GC-212[0].Page1[0].#area[3].CheckBoxCaption3[0]': data.screening.convicted_misdemeanor_violence,
      'GC-212[0].Page1[0].#area[3].CheckBoxCaption3[1]': !data.screening.convicted_misdemeanor_violence,
      
      'GC-212[0].Page1[0].#area[4].CheckBoxCaption4[0]': data.screening.domestic_violence_restraining,
      'GC-212[0].Page1[0].#area[4].CheckBoxCaption4[1]': !data.screening.domestic_violence_restraining,
      
      'GC-212[0].Page1[0].#area[5].CheckBoxCaption5[0]': data.screening.court_found_abused_child,
      'GC-212[0].Page1[0].#area[5].CheckBoxCaption5[1]': !data.screening.court_found_abused_child,
      
      'GC-212[0].Page1[0].#area[6].CheckBoxCaption6[0]': data.screening.court_found_abused_adult,
      'GC-212[0].Page1[0].#area[6].CheckBoxCaption6[1]': !data.screening.court_found_abused_adult,
      
      'GC-212[0].Page1[0].#area[7].CheckBoxCaption7[0]': data.screening.under_conservatorship,
      'GC-212[0].Page1[0].#area[7].CheckBoxCaption7[1]': !data.screening.under_conservatorship,
      
      'GC-212[0].Page1[0].#area[8].CheckBoxCaption8[0]': data.screening.unable_to_provide_care,
      'GC-212[0].Page1[0].#area[8].CheckBoxCaption8[1]': !data.screening.unable_to_provide_care,
      
      // Additional screening checkboxes on page 1
      'GC-212[0].Page1[0].#area[9].CheckBoxCaption9[0]': false,
      'GC-212[0].Page1[0].#area[9].CheckBoxCaption9[1]': true,
      'GC-212[0].Page1[0].#area[10].CheckBoxCaption10[0]': false,
      'GC-212[0].Page1[0].#area[10].CheckBoxCaption10[1]': true,
      
      // Screening Questions Page 2
      'GC-212[0].Page2[0].#area[0].CheckBoxCaption9[0]': data.screening.central_index,
      'GC-212[0].Page2[0].#area[0].CheckBoxCaption9[1]': !data.screening.central_index,
      
      'GC-212[0].Page2[0].#area[1].CheckBoxCaption10[0]': data.screening.health_safety_central_index,
      'GC-212[0].Page2[0].#area[1].CheckBoxCaption10[1]': !data.screening.health_safety_central_index,
      
      'GC-212[0].Page2[0].#area[2].CheckBoxCaption11[0]': data.screening.denied_license_care_children,
      'GC-212[0].Page2[0].#area[2].CheckBoxCaption11[1]': !data.screening.denied_license_care_children,
      
      'GC-212[0].Page2[0].#area[3].CheckBoxCaption12[0]': data.screening.financial_conflict,
      'GC-212[0].Page2[0].#area[3].CheckBoxCaption12[1]': !data.screening.financial_conflict,
      
      'GC-212[0].Page2[0].#area[4].CheckBoxCaption13[0]': data.screening.been_guardian_conservator_trustee,
      'GC-212[0].Page2[0].#area[4].CheckBoxCaption13[1]': !data.screening.been_guardian_conservator_trustee,
      
      'GC-212[0].Page2[0].#area[5].CheckBoxCaption14[0]': data.screening.been_removed_as_guardian,
      'GC-212[0].Page2[0].#area[5].CheckBoxCaption14[1]': !data.screening.been_removed_as_guardian,
      
      'GC-212[0].Page2[0].#area[6].CheckBoxCaption15[0]': data.screening.professional_fiduciary,
      'GC-212[0].Page2[0].#area[6].CheckBoxCaption15[1]': !data.screening.professional_fiduciary,
      
      'GC-212[0].Page2[0].#area[7].CheckBoxCaption16[0]': data.screening.public_entity,
      'GC-212[0].Page2[0].#area[7].CheckBoxCaption16[1]': !data.screening.public_entity,
      
      'GC-212[0].Page2[0].#area[8].CheckBoxCaption17[0]': data.screening.private_guardian,
      'GC-212[0].Page2[0].#area[8].CheckBoxCaption17[1]': !data.screening.private_guardian,
      
      'GC-212[0].Page2[0].#area[9].CheckBoxCaption18[0]': data.screening.minor_lives_with_you,
      'GC-212[0].Page2[0].#area[9].CheckBoxCaption18[1]': !data.screening.minor_lives_with_you,
      
      // Additional minors attached
      'GC-212[0].Page2[0].CheckBo[0]': data.additional_minors_attached,
      'GC-212[0].Page2[0].CheckBo[1]': false,
      'GC-212[0].Page2[0].CheckBo[2]': false,
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
        console.log(`GC-212: ${shouldCheck ? 'Checked' : 'Unchecked'} ${fieldName}`);
      } catch (e) {
        console.log(`GC-212: Could not set checkbox ${fieldName}: ${e.message}`);
      }
    }
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-212:', error);
    throw error;
  }
}

// GC-240 Form Filler Function (Order Appointing Guardian of Minor) - COMPLETE
async function fillGC240(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-240 has ${form.getFields().length} fields available`);
    
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
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CaseNameGdnship[0].NameofWard_ft[0]': data.minor.name,
      'topmostSubform[0].Page2[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page2[0].CaseNameGdnship[0].NameofWard_ft[0]': data.minor.name,
      'topmostSubform[0].Page3[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number || '',
      'topmostSubform[0].Page3[0].CaseNameGdnship[0].NameofWard_ft[0]': data.minor.name,
    };
    
    // Hearing Information (Page 1)
    const hearingFields = {
      'topmostSubform[0].Page1[0].JudgeName_ft[0]': data.hearing.judge || '',
      'topmostSubform[0].Page1[0].Hearingdate_ft[0]': data.hearing.date,
      'topmostSubform[0].Page1[0].HearingTime_ft[0]': data.hearing.time,
      'topmostSubform[0].Page1[0].HearingDept_ft[0]': data.hearing.dept,
      'topmostSubform[0].Page1[0].HearingRoom_ft[0]': data.hearing.room || '',
    };
    
    // Appearances (Page 1)
    const appearanceFields = {
      'topmostSubform[0].Page1[0].PetName1c_ft[0]': data.petitioner.name,
      'topmostSubform[0].Page1[0].PetLawName1d_ft[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].NATPetAtty_ft[0]': '',
      'topmostSubform[0].Page1[0].MinorLawName1e_ft[0]': '',
      'topmostSubform[0].Page1[0].NATMinorAtty_ft[0]': '',
      'topmostSubform[0].Page1[0].Other1f_ft[0]': '',
      'topmostSubform[0].Page1[0].NAT1f_ft[0]': '',
      'topmostSubform[0].Page1[0].Other1f_ft[1]': '',
      'topmostSubform[0].Page1[0].NAT1f_ft[1]': '',
    };
    
    // Notice and Findings Fields (Page 1)
    const noticeFields = {
      'topmostSubform[0].Page1[0].Notice2_ft[0]': '',
      'topmostSubform[0].Page1[0].Notice2_ft[1]': '',
      'topmostSubform[0].Page1[0].Findings3_ft[0]': '',
      'topmostSubform[0].Page1[0].Findings3_ft[1]': '',
      'topmostSubform[0].Page1[0].Findings3_ft[2]': '',
      'topmostSubform[0].Page1[0].Findings3_ft[3]': '',
    };
    
    // Powers and Fees Fields (Page 1)
    const powersFeesFields = {
      'topmostSubform[0].Page1[0].Powers5_ft[0]': '',
      'topmostSubform[0].Page1[0].AttyName6_ft[0]': data.attorney.name,
      'topmostSubform[0].Page1[0].AttyCost6_ft[0]': data.fees.amount || '',
      'topmostSubform[0].Page1[0].CI7_ft[0]': data.investigator.info || '',
    };
    
    // Guardian Appointment (Page 2)
    const appointmentFields = {
      // Guardian of Person
      'topmostSubform[0].Page2[0].Name8a_ft[0]': data.guardian.name || data.petitioner.name,
      'topmostSubform[0].Page2[0].Address8a_ft[0]': data.guardian.address || data.petitioner.address,
      'topmostSubform[0].Page2[0].Telephone8a_ft[0]': data.guardian.phone || data.petitioner.phone,
      'topmostSubform[0].Page2[0].NameWard8a_ft[0]': data.minor.name,
      'topmostSubform[0].Page2[0].Additional8a_ft[0]': '',
      'topmostSubform[0].Page2[0].Additional8a_ft[1]': '',
      
      // Guardian of Estate (if applicable)
      'topmostSubform[0].Page2[0].Name8b_ft[0]': data.guardian.name || data.petitioner.name,
      'topmostSubform[0].Page2[0].Address8b_ft[0]': data.guardian.address || data.petitioner.address,
      'topmostSubform[0].Page2[0].Telephone8b_ft[0]': data.guardian.phone || data.petitioner.phone,
      'topmostSubform[0].Page2[0].NameWard8b_ft[0]': data.minor.name,
      'topmostSubform[0].Page2[0].Additional8b_ft[0]': '',
      'topmostSubform[0].Page2[0].Additional8b_ft[1]': '',
    };
    
    // Other Orders (Page 2)
    const otherOrdersFields = {
      'topmostSubform[0].Page2[0].Other9_ft[0]': '',
      'topmostSubform[0].Page2[0].Other9_ft[1]': '',
      'topmostSubform[0].Page2[0].Other9_ft[2]': '',
    };
    
    // Bond Information (Page 2)
    const bondFields = {
      'topmostSubform[0].Page2[0].BondAmt10b_ft[0]': data.bond.amount || '',
      'topmostSubform[0].Page2[0].DepAmt10c_ft[0]': data.bond.blocked_account || '',
      'topmostSubform[0].Page2[0].FinInst10c[0]': data.bond.institution || '',
      'topmostSubform[0].Page2[0].Additional10_ft[0]': '',
      'topmostSubform[0].Page2[0].Additional10_ft[1]': '',
    };
    
    // Attorney Fees (Page 2)
    const attorneyFeeFields = {
      'topmostSubform[0].Page2[0].AttyPayee11_ft[0]': data.attorney.name,
      'topmostSubform[0].Page2[0].AmtPayable11_ft[0]': data.fees.amount || '',
      'topmostSubform[0].Page2[0].TermsPay11_ft[0]': data.fees.terms || '',
      'topmostSubform[0].Page2[0].Additional11_ft[0]': '',
      'topmostSubform[0].Page2[0].Additional11_ft[1]': '',
    };
    
    // Powers Granted (Page 2 & 3)
    const powersGrantedFields = {
      'topmostSubform[0].Page2[0].Powers12_ft[0]': '',
      'topmostSubform[0].Page3[0].Powers13_ft[0]': '',
      'topmostSubform[0].Page3[0].Powers14_ft[0]': '',
      'topmostSubform[0].Page3[0].Powers14_ft[1]': '',
    };
    
    // Other Orders and Conditions (Page 3)
    const otherConditionsFields = {
      'topmostSubform[0].Page3[0].Conditions15_ft[0]': '',
      'topmostSubform[0].Page3[0].Conditions15_ft[1]': '',
      'topmostSubform[0].Page3[0].OtherOrders15_ft[0]': '',
      'topmostSubform[0].Page3[0].ProbRef16_ft[0]': data.referee.info || '',
      'topmostSubform[0].Page3[0].Additional17_ft[0]': '',
      'topmostSubform[0].Page3[0].Additional17_ft[1]': '',
    };
    
    // Judge Signature (Page 3)
    const signatureFields = {
      'topmostSubform[0].Page3[0].SigDate_ft[0]': formatDate(new Date()),
      'topmostSubform[0].Page3[0].NoPages5_ft[0]': '0',
      'topmostSubform[0].Page3[0].NoPages5_ft[1]': '',
      'topmostSubform[0].Page3[0].JudgeSig_ft[0]': '',
      'topmostSubform[0].Page3[0].JudgeTitle_ft[0]': '',
    };
    
    // Combine all text fields
    const allTextFields = {
      ...attorneyFields,
      ...courtFields,
      ...caseFields,
      ...hearingFields,
      ...appearanceFields,
      ...noticeFields,
      ...powersFeesFields,
      ...appointmentFields,
      ...otherOrdersFields,
      ...bondFields,
      ...attorneyFeeFields,
      ...powersGrantedFields,
      ...otherConditionsFields,
      ...signatureFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`GC-240: Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`GC-240: Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Type of Guardianship (header) - appears on all 3 pages
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CaseNameGdnship[0].PersonCheckbox[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page1[0].CaptionP1_sf[0].CaseNameGdnship[0].EstateCheckbox[0]': data.guardianship_type === 'estate',
      'topmostSubform[0].Page2[0].CaseNameGdnship[0].EstateCheckbox[1]': data.guardianship_type === 'person',
      'topmostSubform[0].Page2[0].CaseNameGdnship[0].EstateCheckbox[0]': data.guardianship_type === 'estate',
      'topmostSubform[0].Page3[0].CaseNameGdnship[0].EstateCheckbox[1]': data.guardianship_type === 'person',
      'topmostSubform[0].Page3[0].CaseNameGdnship[0].EstateCheckbox[0]': data.guardianship_type === 'estate',
      
      // Hearing location
      'topmostSubform[0].Page1[0].Checkbox1b1[0]': true,
      'topmostSubform[0].Page1[0].Checkbox1b2[0]': data.hearing.room ? true : false,
      
      // Appearances
      'topmostSubform[0].Page1[0].Checkbox1c[0]': true,
      'topmostSubform[0].Page1[0].Checkbox1d[0]': true,
      'topmostSubform[0].Page1[0].Checkbox1e[0]': false,
      'topmostSubform[0].Page1[0].Checkbox1f[0]': false,
      'topmostSubform[0].Page1[0].Checkbox1f[1]': false,
      
      // Notices (Page 1)
      'topmostSubform[0].Page1[0].Checkbox2a[0]': true,
      'topmostSubform[0].Page1[0].Checkbox2b1[0]': false,
      'topmostSubform[0].Page1[0].Checkbox2b2[0]': false,
      'topmostSubform[0].Page1[0].Checkbox2b3[0]': false,
      'topmostSubform[0].Page1[0].Checkbox2b4[0]': false,
      'topmostSubform[0].Page1[0].Checkbox2c[0]': false,
      
      // Findings (Page 1)
      'topmostSubform[0].Page1[0].Checkbox3\\.1[0]': true,
      'topmostSubform[0].Page1[0].Checkbox3\\.2[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page1[0].Checkbox3\\.2[1]': data.guardianship_type === 'estate',
      'topmostSubform[0].Page1[0].Checkbox3\\.3[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.4[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.5[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.6[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.7[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.8[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.9[0]': false,
      'topmostSubform[0].Page1[0].Checkbox3\\.10[0]': false,
      
      // Minor status
      'topmostSubform[0].Page1[0].Checkbox4\\.1[0]': false,
      'topmostSubform[0].Page1[0].Checkbox4\\.2[0]': false,
      'topmostSubform[0].Page1[0].Checkbox4\\.3[0]': false,
      
      // Powers and fees
      'topmostSubform[0].Page1[0].Checkbox5[0]': data.independent_powers || false,
      'topmostSubform[0].Page1[0].Checkbox6[0]': data.fees.amount ? true : false,
      'topmostSubform[0].Page1[0].Checkbox[1]': data.investigator.appointed || false,
      
      // Appointments (Page 2)
      'topmostSubform[0].Page2[0].CheckBox8a[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page2[0].CheckBox8b[0]': data.guardianship_type === 'estate',
      
      // Other orders
      'topmostSubform[0].Page2[0].Checkbox9[0]': false,
      
      // Bond (Page 2)
      'topmostSubform[0].Page2[0].Checkbox10a[0]': !data.bond.required,
      'topmostSubform[0].Page2[0].Checkbox10b[0]': data.bond.required,
      'topmostSubform[0].Page2[0].Checkbox10b[1]': data.bond.blocked_account ? true : false,
      'topmostSubform[0].Page2[0].Checkbox10b[2]': false,
      'topmostSubform[0].Page2[0].Checkbox10b[3]': true,
      'topmostSubform[0].Page2[0].Checkbox10b[4]': false,
      
      // Legal fees
      'topmostSubform[0].Page2[0].Checkbox10b[5]': data.fees.amount ? true : false,
      'topmostSubform[0].Page2[0].Checkbox10b[6]': true,
      'topmostSubform[0].Page2[0].Checkbox10b[7]': false,
      'topmostSubform[0].Page2[0].Checkbox11\\.1[0]': false,
      'topmostSubform[0].Page2[0].Checkbox11\\.2[0]': false,
      'topmostSubform[0].Page2[0].Checkbox11\\.3[0]': false,
      'topmostSubform[0].Page2[0].Checkbox11\\.4[0]': true,
      'topmostSubform[0].Page2[0].Checkbox11\\.5[0]': false,
      'topmostSubform[0].Page2[0].Checkbox11\\.6[0]': false,
      'topmostSubform[0].Page2[0].Checkbox11\\.7[0]': false,
      
      // Powers granted
      'topmostSubform[0].Page2[0].Checkbox5[0]': false,
      'topmostSubform[0].Page2[0].Checkbox5[1]': data.independent_powers || false,
      'topmostSubform[0].Page2[0].Checkbox12[0]': false,
      'topmostSubform[0].Page2[0].Checkbox12[1]': false,
      'topmostSubform[0].Page2[0].Checkbox12[2]': false,
      
      // Page 3 checkboxes
      'topmostSubform[0].Page3[0].Checkbox13[0]': false,
      'topmostSubform[0].Page3[0].Checkbox13[1]': false,
      'topmostSubform[0].Page3[0].Checkbox14[0]': false,
      'topmostSubform[0].Page3[0].Checkbox14[1]': false,
      'topmostSubform[0].Page3[0].Checkbox14[2]': false,
      'topmostSubform[0].Page3[0].Checkbox14[3]': false,
      
      // Other orders
      'topmostSubform[0].Page3[0].Checkbox5[0]': false,
      'topmostSubform[0].Page3[0].Checkbox15[0]': false,
      'topmostSubform[0].Page3[0].Checkbox15[1]': data.referee.appointed || false,
      'topmostSubform[0].Page3[0].Checkbox15[2]': false,
      'topmostSubform[0].Page3[0].Checkbox15[3]': false,
      'topmostSubform[0].Page3[0].Checkbox15[4]': false,
      'topmostSubform[0].Page3[0].Checkbox15[5]': false,
      'topmostSubform[0].Page3[0].Checkbox15[6]': false,
      'topmostSubform[0].Page3[0].Checkbox15[7]': false,
      'topmostSubform[0].Page3[0].Checkbox15[8]': false,
      'topmostSubform[0].Page3[0].Checkbox15[9]': false,
      
      // Additional orders
      'topmostSubform[0].Page3[0].Checkbox17[0]': false,
      'topmostSubform[0].Page3[0].Checkbox17[1]': false,
      'topmostSubform[0].Page3[0].Checkbox17[2]': false,
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
        console.log(`GC-240: ${shouldCheck ? 'Checked' : 'Unchecked'} ${fieldName}`);
      } catch (e) {
        console.log(`GC-240: Could not set checkbox ${fieldName}: ${e.message}`);
      }
    }
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error filling GC-240:', error);
    throw error;
  }
}

// GC-250 Form Filler Function (Letters of Guardianship) - COMPLETE
async function fillGC250(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`GC-250 has ${form.getFields().length} fields available`);
    
    // Court Information
    const courtFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].CrtCounty_ft[0]': data.court.county.toUpperCase(),
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].Branch_ft[0]': data.court.branch,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].Street_ft[0]': data.court.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].CityZip_ft[0]': `${data.court.city}, CA ${data.court.zip}`,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CourtInfo[0].MailingAdd_ft[0]': data.court.street,
    };
    
    // Party/Case Information
    const caseFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].TitlePartyName[0].Party1_ft[0]': data.minor.name.toUpperCase(),
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number,
      'topmostSubform[0].Page2[0].TitlePartyName[0].Party1_ft[0]': data.minor.name.toUpperCase(),
      'topmostSubform[0].Page2[0].CaseNumber[0].CaseNumber_ft[0]': data.case_number,
    };
    
    // Attorney Information
    const attorneyFields = {
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyName_ft[0]': data.attorney.name.toUpperCase(),
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyFirm_ft[0]': data.attorney.firm_name,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyStreet_ft[0]': data.attorney.street,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyCity_ft[0]': data.attorney.city,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyState_ft[0]': data.attorney.state,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyZip_ft[0]': data.attorney.zip,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Phone_ft[0]': data.attorney.phone,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Fax_ft[0]': data.attorney.fax,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].Email_ft[0]': data.attorney.email,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyBarNo_dc[0]': data.attorney.bar_number,
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].AttyInfo[0].AttyFor_ft[0]': `Petitioner ${data.petitioner.name}`,
    };
    
    // Guardianship Information
    const guardianshipFields = {
      'topmostSubform[0].Page1[0].NameGdn1_ft[0]': data.guardian.name.toUpperCase(),
      'topmostSubform[0].Page1[0].NameWard1_ft[0]': data.minor.name.toUpperCase(),
      'topmostSubform[0].Page1[0].NameGdn2_ft[0]': '',
      'topmostSubform[0].Page1[0].NameWard2_ft[0]': '',
      'topmostSubform[0].Page1[0].Ward18thBday2_ft[0]': '',
      'topmostSubform[0].Page1[0].Ward18thBday2_ft[1]': '',
      'topmostSubform[0].Page1[0].Additional1_ft[0]': '',
      'topmostSubform[0].Page1[0].Additional1_ft[1]': '',
      'topmostSubform[0].Page1[0].Additional1_ft[2]': '',
    };
    
    // Powers and Conditions
    const powersFields = {
      'topmostSubform[0].Page1[0].Text3a_ft[0]': '',
      'topmostSubform[0].Page1[0].Text3b_ft[0]': '',
      'topmostSubform[0].Page1[0].Text3c_ft[0]': '',
      'topmostSubform[0].Page1[0].Text3e_ft[0]': '',
      'topmostSubform[0].Page1[0].NoPages5_ft[0]': '0',
      'topmostSubform[0].Page1[0].Date_ft[0]': formatDate(new Date()),
      'topmostSubform[0].Page1[0].ClerkSig_ft[0]': '',
      'topmostSubform[0].Page1[0].ClerkTitle_ft[0]': '',
    };
    
    // Page 2 - Execution Information
    const executionFields = {
      'topmostSubform[0].Page2[0].DateSigApptee_ft[0]': formatDate(new Date()),
      'topmostSubform[0].Page2[0].PlaceSigSigned_ft[0]': `${data.court.city}, California`,
      'topmostSubform[0].Page2[0].AppointeeName_ft[0]': data.guardian.name.toUpperCase(),
      'topmostSubform[0].Page2[0].DateClerkSig_ft[0]': formatDate(new Date()),
      'topmostSubform[0].Page2[0].CourtOfficer_ft[0]': '',
      'topmostSubform[0].Page2[0].Deputy_ft[0]': '',
      'topmostSubform[0].Page2[0].AdditionalSig_ft[0]': '',
      'topmostSubform[0].Page2[0].AdditionalSig_ft[1]': '',
      'topmostSubform[0].Page2[0].AdditionalSig_ft[2]': '',
    };
    
    // Combine all text fields
    const allTextFields = {
      ...courtFields,
      ...caseFields,
      ...attorneyFields,
      ...guardianshipFields,
      ...powersFields,
      ...executionFields
    };
    
    // Fill all text fields
    for (const [fieldName, value] of Object.entries(allTextFields)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        console.log(`GC-250: Set ${fieldName} to "${value}"`);
      } catch (e) {
        console.log(`GC-250: Could not set field ${fieldName}: ${e.message}`);
      }
    }
    
    // CHECKBOXES - Complete set
    const checkboxes = {
      // Guardianship Type in header
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].MinorCheckbox[0]': data.guardianship_type === 'estate',
      'topmostSubform[0].Page1[0].StdP1Header_sf[0].FormTitle[0].MinorsCheckBox[0]': data.guardianship_type === 'person',
      
      // Person/Estate checkboxes in main content
      'topmostSubform[0].Page1[0].CheckBox1\\.1person[0]': data.guardianship_type === 'person',
      'topmostSubform[0].Page1[0].CheckBx1\\.2estate[0]': data.guardianship_type === 'estate',
      
      // Additional guardianship checkboxes
      'topmostSubform[0].Page1[0].CheckBox1\\.3[0]': false,
      'topmostSubform[0].Page1[0].CheckBox1\\.4[0]': false,
      'topmostSubform[0].Page1[0].CheckBox1\\.5[0]': false,
      
      // Guardian type checkboxes
      'topmostSubform[0].Page1[0].CheckBox2\\.1[0]': false,
      'topmostSubform[0].Page1[0].CheckBox2\\.2[0]': false,
      'topmostSubform[0].Page1[0].CheckBox2\\.3[0]': false,
      'topmostSubform[0].Page1[0].CheckBox2\\.4[0]': false,
      'topmostSubform[0].Page1[0].CheckBox2\\.5[0]': false,
      
      // Powers and Conditions
      'topmostSubform[0].Page1[0].CheckBox3[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3a_ft[0]': data.independent_powers || false,
      'topmostSubform[0].Page1[0].CheckBox3b_ft[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3c_ft[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3e1_ft[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3e2_ft[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3e3_ft[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3[1]': data.guardianship_type === 'person',
      
      // Additional Powers checkboxes
      'topmostSubform[0].Page1[0].CheckBox3d[0]': false,
      'topmostSubform[0].Page1[0].CheckBox3d[1]': false,
      'topmostSubform[0].Page1[0].CheckBox3d[2]': false,
      'topmostSubform[0].Page1[0].CheckBox3d[3]': false,
      'topmostSubform[0].Page1[0].CheckBox3d[4]': false,
      
      // Certification checkboxes
      'topmostSubform[0].Page1[0].CheckBox4[0]': true,
      'topmostSubform[0].Page1[0].CheckBox4[1]': false,
      'topmostSubform[0].Page1[0].CheckBox4[2]': false,
      
      // Page 2 execution checkboxes
      'topmostSubform[0].Page2[0].CheckBox5[0]': false,
      'topmostSubform[0].Page2[0].CheckBox5[1]': false,
      'topmostSubform[0].Page2[0].CheckBox5[2]': false,
      'topmostSubform[0].Page2[0].CheckBox5[3]': false,
      'topmostSubform[0].Page2[0].CheckBox5[4]': false,
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
        console.log(`GC-250: ${shouldCheck ? 'Checked' : 'Unchecked'} ${fieldName}`);
      } catch (e) {
        console.log(`GC-250: Could not set checkbox ${fieldName}: ${e.message}`);
      }
    }
    
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
    { name: 'GC-210', filler: fillGC210 },
    { name: 'GC-212', filler: fillGC212 },
    { name: 'GC-240', filler: fillGC240 },
    { name: 'GC-250', filler: fillGC250 },
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
    
    console.log('Received guardianship form submission for minor:', webhookData.minor_name || webhookData.minors_list?.split('\n')[0]);
    
    const transformedData = transformGuardianshipData(webhookData);
    
    console.log('Data transformed, filling guardianship PDFs...');
    
    const pdfs = await fillGuardianshipForms(transformedData);
    
    const response = {
      success: true,
      message: 'Guardianship PDFs generated successfully',
      timestamp: new Date().toISOString().split('T')[0],
      metadata: {
        minor: transformedData.minor.name,
        guardian: transformedData.guardian.name,
        petitioner: transformedData.petitioner.name,
        guardianship_type: transformedData.guardianship_type,
        forms_generated: Object.keys(pdfs).filter(key => pdfs[key].length > 50)
      },
      pdfs: {
        'GC-210': Buffer.from(pdfs['GC-210']).toString('base64'),
        'GC-212': Buffer.from(pdfs['GC-212']).toString('base64'),
        'GC-240': Buffer.from(pdfs['GC-240']).toString('base64'),
        'GC-250': Buffer.from(pdfs['GC-250']).toString('base64'),
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
    console.error('Error processing guardianship form:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to process guardianship form',
        details: error.message 
      }),
    };
  }
};
