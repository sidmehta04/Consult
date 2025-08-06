let mappingQA, defaultQA;

if (import.meta.env.VITE_FIREBASE_PROJECT_ID === "consulttest-be8ce") {
  mappingQA = {};
  defaultQA = {
    MSID: "MS000001",
    nameQA: "Test QA",
    emailQA: "testqa@gmail.com",
    isDefault: true,
  };
} else {
  mappingQA = {
    Bihar: [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    Telangana: [
      {
        MSID: "MS00562",
        nameQA: "Chakilam Avinash",
        emailQA: "mochakms00562@gmail.com",
      },
    ],
    "Andhra Pradesh": [
      {
        MSID: "MS00562",
        nameQA: "Chakilam Avinash",
        emailQA: "mochakms00562@gmail.com",
      },
    ],
    Assam: [
      {
        MSID: "MS01452",
        nameQA: "Prasanjit Das",
        emailQA: "mochakms01452@gmail.com",
      },
    ],
    Odisha: [
      {
        MSID: "MS00640",
        nameQA: "Chaitanya Bishoi",
        emailQA: "mochakms00640@gmail.com",
      },
    ],
    Haryana: [
      {
        MSID: "MS01554",
        nameQA: "TRISHA SAXENA",
        emailQA: "trishasaxena07@gmail.com",
      },
    ],
    Jharkhand: [
      {
        MSID: "MS01382",
        nameQA: "Mehjabin Muzid",
        emailQA: "mochakms01382@gmail.com",
      },
    ],
    "West Bengal": [
      { MSID: "MS00313", nameQA: "Nupur", emailQA: "mochakms00313@gmail.com" },
    ],
    "Uttar Pradesh": [
      // { 'MSID': 'MS00777', 'nameQA': 'Rajdeep Kour', 'emailQA': 'mochakms00777@gmail.com' },
      {
        MSID: "MS00522",
        nameQA: "Sweta Kaur",
        emailQA: "mochakms00522@gmail.com",
      },
      {
        MSID: "MS01554",
        nameQA: "TRISHA SAXENA",
        emailQA: "trishasaxena07@gmail.com",
      },
    ],
    Rajasthan: [
      {
        MSID: "MS01029",
        nameQA: "Samyojita Nair",
        emailQA: "mochakms01029@gmail.com",
      },
    ],
    Karnataka: [
      {
        MSID: "MS01457",
        nameQA: "Sneha Huddar",
        emailQA: "mochakms01457@gmail.com",
      },
    ],
    "Tamil Nadu": [
      {
        MSID: "MS01450",
        nameQA: "Pooja Dharmendhra",
        emailQA: "mochakms01450@gmail.com",
      },
    ],
    Kerala: [
      {
        MSID: "MS00568",
        nameQA: "Dharshini",
        emailQA: "mochakms00568@gmail.com",
      },
    ],

    Maharashtra: [
      {
        MSID: "MS00610",
        nameQA: "Yogesh Kumar",
        emailQA: "mochakms00610@gmail.com",
      },
    ],
    Uttarakhand: [
      {
        MSID: "MS00014",
        nameQA: "Yogesh Singh Panwar",
        emailQA: "mochakma030@gmail.com",
      },
    ],
    Chhattisgarh: [
      {
        MSID: "MS01687",
        nameQA: "POORVI ARYA",
        emailQA: "mochakms01687@gmail.com",
      },
    ],
    "Madhya Pradesh": [
      {
        MSID: "MS01687",
        nameQA: "POORVI ARYA",
        emailQA: "mochakms01687@gmail.com",
      },
    ],
    Gujarat: [
      {
        MSID: "MS00769",
        nameQA: "Yogesh Kumar",
        emailQA: "mochakms00769@gmail.com",
      },
    ],
    Punjab: [
      {
        MSID: "MS00522",
        nameQA: "Sweta Kaur",
        emailQA: "mochakms00522@gmail.com",
      },
    ],
    "Himachal Pradesh": [
      {
        MSID: "MS00014",
        nameQA: "Yogesh Singh Panwar",
        emailQA: "mochakma030@gmail.com",
      },
    ],
  };

  //NOTE: CHECK DEFAULT QA?
  defaultQA = {
    MSID: "MS00769",
    nameQA: "Yogesh Kumar",
    emailQA: "mochakms00769@gmail.com",
    isDefault: true,
  };
}

export const InventoryMapping = {
    Bihar: [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
     ],
    Gujarat: [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
    ],
    "UP East" : [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
    ],
    Rajasthan: [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
    ],
    Chhattisgarh: [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
    ],
    Jharkhand: [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
    ],
    "Madhya Pradesh": [
      {
        EmpID: "MS01228",
        name: "Manish Kumar Gupta",
        email: "manishkumar.gupta@m-swasth.in",
      },
    ],
    "West Bengal": [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Odisha: [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Maharashtra: [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Uttarakhand: [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Haryana: [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Assam: [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    "UP West": [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    "Himachal Pradesh": [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Punjab: [
      {
        EmpID: "MS00588",
        name: "Akash Bhardwaj",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    "Andhra Pradesh": [
      {
        EmpID: "MS00766",
        name: "Dhanasekar",
        email: "akash.bhardwaj@m-insure.in",
      },
    ], 
    Karnataka: [
      {
        EmpID: "MS00766",
        name: "Dhanasekar",
        email: "akash.bhardwaj@m-insure.in",
      },
    ], 
    Telangana: [
      {
        EmpID: "MS00766",
        name: "Dhanasekar",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
    Kerala: [
      {
        EmpID: "MS00766",
        name: "Dhanasekar",
        email: "akash.bhardwaj@m-insure.in",
      },
    ], 
    "Tamil Nadu": [
      {
        EmpID: "MS00766",
        name: "Dhanasekar",
        email: "akash.bhardwaj@m-insure.in",
      },
    ],
}



// Helper function to get QA details for a state
export const getQAForState = (stateName) => {
  const qaList = mappingQA[stateName];
  if (!qaList || qaList.length === 0) {
    return defaultQA;
  }

  // For now, return the first QA. You can implement round-robin or other assignment logic here
  return qaList[0];
};

// Helper function to get all QAs for a state
export const getAllQAsForState = (stateName) => {
  return mappingQA[stateName] || [defaultQA];
};

// Helper function to add a new QA to a state
export const addQAToState = (stateName, qaDetails) => {
  if (!mappingQA[stateName]) {
    mappingQA[stateName] = [];
  }
  mappingQA[stateName].push(qaDetails);
};

// Helper function to remove a QA from a state
export const removeQAFromState = (stateName, qaEmail) => {
  if (mappingQA[stateName]) {
    mappingQA[stateName] = mappingQA[stateName].filter(
      (qa) => qa.emailQA !== qaEmail
    );
  }
};

// Export the variables
export { mappingQA, defaultQA };

export const categories = [
  {
    value: "online-team",
    label:
      "Online Team (Agent/Pharmacist/TL) | ऑनलाइन टीम (एजेंट/फार्मासिस्ट/टी.एल)",
  },
  {
    value: "offline-team",
    label:
      "Offline Team (DC/Field ops manager) | ऑफलाइन टीम (डीसी/फील्ड ऑप्स मैनेजर)",
  },
  {
    value: "sales-diagnostic-team",
    label:
      "Sales & Diagnostic Team (Agent/TL) | सेल्स एवं डायग्नॉस्टिक टीम (एजेंट/टी.एल)",
  },
  {
    value: "hr-team",
    label: " HR Team (Salary/Accounts/Zing) | एचआर टीम (वेतन/लेखा/जिंग)",
  },
  {
    value: "branch-issues",
    label: "Branch Issues (BM/RM) | शाखा संबंधित समस्याएं (बी.एम/आर.एम)",
  },
  { value: "doctor-issues", label: "Doctor | डॉक्टर" },
  {
    value: "clinic-issues",
    label:
      "Clinic Issues (Instruments/Tab/Furniture) | क्लिनिक संबंधित समस्याएं (उपकरण/दवा/टैब/फर्नीचर)",
  },
  {
    value: "medicine-issues",
    label: "Medicine Issues | दवाइयों से संबंधित समस्याएँ",
  },
  {
    value: "sim-card-issues",
    label: "Sim card Issues | सिम कार्ड से जुड़ी समस्याएं",
  },
];

export const subcategories = {
  none: [],
  "online-team": [
    {
      value: "delay-joining",
      label:
        "Delay in Joining (Pharmacist or Agent) | जॉइनिंग में देरी (फार्मासिस्ट या एजेंट)",
    },
    {
      value: "behaviour-issues",
      label:
        "Behaviour Issue (Pharmacist or Agent) | व्यवहार संबंधी समस्या (फार्मासिस्ट या एजेंट)",
    },
    {
      value: "data-not-available",
      label:
        "Data Not Available (Awareness Call/FDB Call) | डेटा उपलब्ध नहीं (अवेयरनेस कॉल/एफ़.डी.बी कॉल)",
    },
    {
      value: "not-picking-calls",
      label:
        "Agent/Pharmacist Not Picking Calls | एजेंट/फार्मासिस्ट कॉल नहीं उठा रहे हैं",
    },
  ],
  "offline-team": [
    {
      value: "behaviour-issues",
      label:
        "DC/State Ops Behaviour Issue | डीसी/स्टेट ऑप्स का व्यवहार संबंधित समस्या",
    },
    {
      value: "not-picking-calls",
      label:
        "DC/State Ops Not Coordinating or Not Picking Calls | डीसी/स्टेट ऑप्स समन्वय नहीं कर रहे हैं या कॉल नहीं उठा रहे हैं",
    },
  ],
  "sales-diagnostic-team": [
    {
      value: "data-not-available",
      label:
        "Data Not Available for Calling | कॉल करने के लिए डेटा उपलब्ध नहीं है",
    },
    {
      value: "diagnosis-issues",
      label:
        "Sample Collection for Diagnosis Issue | डायगनिदान के लिए सैंपल कलेक्शन में समस्या",
    },
    {
      value: "incorrect-report",
      label: "Wrong or Incorrect Report | गलत या त्रुटिपूर्ण रिपोर्ट",
    },
  ],
  "hr-team": [
    {
      value: "salary-issues",
      label:
        "Salary or Incentives Related Issues | वेतन या प्रोत्साहन से संबंधित समस्याएं",
    },
    {
      value: "zinghr-issues",
      label: "ZingHR Login Related Issues | ZingHR लॉगिन से संबंधित समस्याएं",
    },
  ],
  "branch-issues": [
    {
      value: "behaviour-issues",
      label:
        "BM/RM Behaviour Related Issues | बीएम/आरएम के व्यवहार से संबंधित समस्याएं",
    },
  ],
  "doctor-issues": [
    {
      value: "joining-delay",
      label: "Delay in Doctor Joining | डॉक्टर की जॉइनिंग में देरी",
    },
    {
      value: "behaviour-issues",
      label: "Doctor Behaviour Issue | डॉक्टर के व्यवहार से संबंधित समस्या",
    },
  ],
  "clinic-issues": [
    {
      value: "bp-machine-issues",
      label:
        "B.P. Machine Not Working or Not Available | बी.पी. मशीन काम नहीं कर रही है या उपलब्ध नहीं है",
    },
    {
      value: "thermometer-issues",
      label:
        "Thermometer Not Working or Not Available | थर्मामीटर काम नहीं कर रहा है या उपलब्ध नहीं है",
    },
    {
      value: "pulse-oximeter-issues",
      label:
        "Pulse Oximeter Not Working or Not Available | पल्स ऑक्सीमीटर काम नहीं कर रहा है या उपलब्ध नहीं है",
    },
    {
      value: "weighing-machine-issues",
      label:
        "Weighing Machine Not Working or Not Available | वजन मापने की मशीन काम नहीं कर रही है या उपलब्ध नहीं है",
    },
    {
      value: "tab-issues",
      label: "Tab Not Working | टैबलेट काम नहीं कर रहा है",
    },
    {
      value: "furniture-issues",
      label: "Furniture Issue | फर्नीचर संबंधित समस्या",
    },
    {
      value: "battery-issues",
      label: "Battery Related Issues | बैटरी से जुड़ी समस्याएं",
    },
    {
      value: "hygiene-issues",
      label: "Hygiene Related Issues | स्वच्छता से संबंधित समस्याएं",
    },
    {
      value: "water-electricity-issues",
      label: "Water and Electricity Issue | पानी और बिजली से संबंधित समस्या",
    },
    {
      value: "rent-issues",
      label: "Rent Related Issues | किराए से संबंधित समस्याएं",
    },
    {
      value: "location-issues",
      label:
        "Clinic Location Related Issues | क्लिनिक के स्थान से जुड़ी समस्याएं",
    },
    {
      value: "other-issues",
      label:
        "Clinic Board/Banner/Green Cloth/Medicine Rack Related Issues | क्लिनिक बोर्ड/बैनर/हरा कपड़ा/दवा रैक से जुड़ी समस्याएं",
    },
  ],
  "medicine-issues": [
    {
      value: "medicine-delay",
      label: "Medicines Delay for Long Time | दवाओं में लंबे समय से देरी",
    },
    {
      value: "medicine-not-available",
      label: "Regular Medicine Not Available | नियमित दवाएं उपलब्ध नहीं हैं",
    },
    {
      value: "medicine-no-update",
      label:
        "No Update for Medicines, Raised Issue Long Time Back | दवाओं की स्थिति का कोई अपडेट नहीं, मुद्दा पहले ही उठाया गया था",
    },
    {
      value: "medicine-expiry-issues",
      label:
        "Medicine Expiry Related Issues | दवाओं की एक्सपायरी से संबंधित समस्याएं",
    },
    {
      value: "medicine-inventory-issues",
      label:
        "Medicine Inventory Related Issue (MInsure App or Forms) | दवा इन्वेंट्री से संबंधित समस्या (MInsure ऐप या फॉर्म के माध्यम से)",
    },
  ],
  "sim-card-issues": [
    {
      value: "network-issues",
      label: "Network Related Issues | नेटवर्क से संबंधित समस्याएं",
    },
    { value: "not-working", label: "SIM Not Working | सिम काम नहीं कर रही है" },
    {
      value: "recharge-issues",
      label: "Recharge Related Issues | रीचार्ज से जुड़ी समस्याएं",
    },
    { value: "not-available", label: "SIM Not Available | सिम उपलब्ध नहीं है" },
  ],
};
