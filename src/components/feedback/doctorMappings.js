// Doctor Partner QA Mappings
let partnerQAMapping, defaultQADoctor;

if (import.meta.env.VITE_FIREBASE_PROJECT_ID === "consulttest-be8ce") {
  partnerQAMapping = {};
  defaultQADoctor = {
    MSID: "MS000001",
    nameQA: "Test QA",
    emailQA: "testqa@gmail.com",
    isDefault: true,
  };
} else {
  partnerQAMapping = {
    "Namra": [
      {
        MSID: "MS00640",
        nameQA: "Chaitanya Charana Bishoi",
        emailQA: "mochakms00640@gmail.com",
      },
    ],
    "Muthoot South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
      {
        MSID: "MS00562",
        nameQA: "Chakilam Avinash",
        emailQA: "mochakms00562@gmail.com",
      },
    ],
    "Muthoot North": [
      {
        MSID: "MS01029",
        nameQA: "Samyojita Nair",
        emailQA: "mochakms01029@gmail.com",
      },
      {
        MSID: "MS00610",
        nameQA: "Yogesh Kumar",
        emailQA: "mochakms00610@gmail.com",
      },
    ],
    "Nabfins": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "Pahal North": [
      {
        MSID: "MS01382",
        nameQA: "Mehjabin Muzid",
        emailQA: "mochakms01382@gmail.com",
      },
    ],
    "Pahal South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
    ],
    "ACFL": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "TATA North": [
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
    ],
    "TATA South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
      {
        MSID: "MS00562",
        nameQA: "Chakilam Avinash",
        emailQA: "mochakms00562@gmail.com",
      },
    ],
    "Humana": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "NESFB": [
      {
        MSID: "MS01452",
        nameQA: "Prasanjit Das",
        emailQA: "mochakms01452@gmail.com",
      },
    ],
    "Uttrayan": [
      {
        MSID: "MS00313",
        nameQA: "Nupur",
        emailQA: "mochakms00313@gmail.com",
      },
    ],
    "Bangia": [
      {
        MSID: "MS00313",
        nameQA: "Nupur",
        emailQA: "mochakms00313@gmail.com",
      },
    ],
    "Share India": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "Seba": [
      {
        MSID: "MS00313",
        nameQA: "Nupur",
        emailQA: "mochakms00313@gmail.com",
      },
    ],
    "Cashpor Unit 1": [
      {
        MSID: "MS00014",
        nameQA: "Yogesh Singh Panwar",
        emailQA: "mochakma030@gmail.com",
      },
      {
        MSID: "MS01554",
        nameQA: "Trisha Saxena",
        emailQA: "trishasaxena07@gmail.com",
      },
    ],
    "Cashpor Unit 2": [
      {
        MSID: "MS01452",
        nameQA: "Prasanjit Das",
        emailQA: "mochakms01452@gmail.com",
      },
      {
        MSID: "MS00522",
        nameQA: "Sweta Kaur",
        emailQA: "mochakms00522@gmail.com",
      },
    ],
    "Satya Foundation": [
      {
        MSID: "MS01382",
        nameQA: "Mehjabin Muzid",
        emailQA: "mochakms01382@gmail.com",
      },
    ],
    "Utkarsh": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "Utkarsh foundation": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "Svatantra": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "ESAF South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
    ],
    "ESAF North": [
      {
        MSID: "MS01382",
        nameQA: "Mehjabin Muzid",
        emailQA: "mochakms01382@gmail.com",
      },
      {
        MSID: "MS00610",
        nameQA: "Yogesh Kumar",
        emailQA: "mochakms00610@gmail.com",
      },
    ],
    "UKBGB": [
      {
        MSID: "MS00313",
        nameQA: "Nupur",
        emailQA: "mochakms00313@gmail.com",
      },
    ],
    "UBGB": [
      {
        MSID: "MS00313",
        nameQA: "Nupur",
        emailQA: "mochakms00313@gmail.com",
      },
    ],
    "PBGB": [
      {
        MSID: "MS00313",
        nameQA: "Nupur",
        emailQA: "mochakms00313@gmail.com",
      },
    ],
    "Navchetna South": [
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
    ],
    "PAFT South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
    ],
    "Sugamya South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
      {
        MSID: "MS00562",
        nameQA: "Chakilam Avinash",
        emailQA: "mochakms00562@gmail.com",
      },
    ],
    "Swarnodhayam South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
    ],
    "Satya North": [
      {
        MSID: "MS01382",
        nameQA: "Mehjabin Muzid",
        emailQA: "mochakms01382@gmail.com",
      },
      {
        MSID: "MS00610",
        nameQA: "Yogesh Kumar",
        emailQA: "mochakms00610@gmail.com",
      },
    ],
    "Satya South": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
      {
        MSID: "MS00562",
        nameQA: "Chakilam Avinash",
        emailQA: "mochakms00562@gmail.com",
      },
    ],
    "Projects": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "Digital/Night Team": [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar Jha",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    "AVGB": [
      {
        MSID: "MS01452",
        nameQA: "Prasanjit Das",
        emailQA: "mochakms01452@gmail.com",
      },
    ],
  };

  //NOTE: CHECK DEFAULT QA FOR DOCTORS?
  defaultQADoctor = {
    MSID: "MS00769",
    nameQA: "Yogesh Kumar Jha",
    emailQA: "mochakms00769@gmail.com",
    isDefault: true,
  };
}

// Helper function to get QA details for a partner
export const getQAForPartner = (partnerName) => {
  const qaList = partnerQAMapping[partnerName];
  if (!qaList || qaList.length === 0) {
    return defaultQADoctor;
  }

  // For now, return the first QA. You can implement round-robin or other assignment logic here
  return qaList[0];
};

// Helper function to get all QAs for a partner
export const getAllQAsForPartner = (partnerName) => {
  return partnerQAMapping[partnerName] || [defaultQADoctor];
};

// Helper function to add a new QA to a partner
export const addQAToPartner = (partnerName, qaDetails) => {
  if (!partnerQAMapping[partnerName]) {
    partnerQAMapping[partnerName] = [];
  }
  partnerQAMapping[partnerName].push(qaDetails);
};

// Helper function to remove a QA from a partner
export const removeQAFromPartner = (partnerName, qaEmail) => {
  if (partnerQAMapping[partnerName]) {
    partnerQAMapping[partnerName] = partnerQAMapping[partnerName].filter(
      (qa) => qa.emailQA !== qaEmail
    );
  }
};

// Export the variables
export { partnerQAMapping, defaultQADoctor };

// Doctor-specific categories
export const doctorCategories = [
  {
    value: "online-team",
    label: "Online Team (Agent/Pharmacist/TL) | ऑनलाइन टीम (एजेंट/फार्मासिस्ट/टी.एल)",
  },
  {
    value: "clinic-issues",
    label: "Clinic Issues (Instruments/Medicine/Tab/Furniture) | क्लिनिक संबंधित समस्याएं (उपकरण/दवा/टैब/फर्नीचर)",
  },
  {
    value: "offline-team",
    label: "Offline Team (DC/Field ops manager) | ऑफलाइन टीम (डीसी/फील्ड ऑप्स मैनेजर)",
  },
  {
    value: "nurse-related-issues",
    label: "Nurse Related Issues | नर्स संबंधी समस्याएं",
  },
];

export const doctorSubcategories = {
  none: [],
  "online-team": [
    {
      value: "behaviour-issues",
      label: "Behaviour Issue (Pharmacist or Agent) | व्यवहार संबंधी समस्या (फार्मासिस्ट या एजेंट)",
    },
    {
      value: "not-picking-calls",
      label: "Agent/Pharmacist Not Picking Calls | एजेंट/फार्मासिस्ट कॉल नहीं उठा रहे हैं",
    },
    {
      value: "delay-case-assigning",
      label: "Delay in Case Assigning | केस असाइन करने में देरी",
    },
    {
      value: "not-responding-consultation",
      label: "Pharmacist/Agent Not Responding While Consultation | परामर्श के दौरान फार्मासिस्ट/एजेंट जवाब नहीं दे रहे",
    },
  ],
  "clinic-issues": [
    {
      value: "bp-machine-issues",
      label: "B.P. Machine Not Working or Not Available | बी.पी. मशीन काम नहीं कर रही है या उपलब्ध नहीं है",
    },
    {
      value: "thermometer-issues",
      label: "Thermometer Not Working or Not Available | थर्मामीटर काम नहीं कर रहा है या उपलब्ध नहीं है",
    },
    {
      value: "pulse-oximeter-issues",
      label: "Pulse Oximeter Not Working or Not Available | पल्स ऑक्सीमीटर काम नहीं कर रहा है या उपलब्ध नहीं है",
    },
    {
      value: "weighing-machine-issues",
      label: "Weighing Machine Not Working or Not Available | वजन मापने की मशीन काम नहीं कर रही है या उपलब्ध नहीं है",
    },
    {
      value: "tab-issues",
      label: "Tab Not Working | टैबलेट काम नहीं कर रहा है",
    },
    {
      value: "hygiene-issues",
      label: "Hygiene Related Issues | स्वच्छता से संबंधित समस्याएं",
    },
    {
      value: "electricity-issues",
      label: "Electricity Issue | बिजली संबंधी समस्या",
    },
  ],
  "offline-team": [
    {
      value: "dc-state-ops-behaviour",
      label: "DC/State Ops Behaviour Issue | डीसी/स्टेट ऑप्स का व्यवहार संबंधित समस्या",
    },
    {
      value: "bm-rm-behaviour",
      label: "BM/RM Behaviour Related Issues | बीएम/आरएम के व्यवहार से संबंधित समस्याएं",
    },
    {
      value: "dc-behaviour",
      label: "DC Behaviour Related Issues | डीसी के व्यवहार से संबंधित समस्याएं",
    },
  ],
  "nurse-related-issues": [
    {
      value: "high-risk-case-booked",
      label: "High Risk Case Booked by Nurse | नर्स द्वारा हाई रिस्क केस बुक किया गया",
    },
    {
      value: "mtp-case-booked",
      label: "MTP Case Booked by Nurse | नर्स द्वारा एमटीपी केस बुक किया गया",
    },
    {
      value: "fake-case-booked",
      label: "Fake Case Booked by Nurse | नर्स द्वारा फेक केस बुक किया गया",
    },
    {
      value: "nurse-behaviour-issue",
      label: "Nurse Behaviour Issue | नर्स के व्यवहार से संबंधित समस्या",
    },
    {
      value: "wrong-details-shared",
      label: "Wrong Detail Shared by Nurse | नर्स द्वारा गलत विवरण साझा किया गया",
    },
    {
      value: "vitals-not-measured",
      label: "Vitals Not Measured by Nurse | नर्स द्वारा वाइटल्स नहीं मापे गए",
    },
  ],
};