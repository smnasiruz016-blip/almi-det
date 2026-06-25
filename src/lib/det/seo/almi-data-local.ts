// Vendored from @smnasiruz016-blip/almi-data (COUNTRIES 197 + the 10 researched
// ORIGINS) so AlmiDET is self-contained (no GitHub Packages auth at build time).
// Facts only; DET copy lives in the SEO templates.

export type Origin = {
  slug: string; name: string; flag: string;
  archetype: string; credentialBody: string; languageNote: string;
  topWorry: string; scholarshipCluster: string[];
};
export type Country = { name: string; slug: string; flag: string };

export const COUNTRIES: readonly Country[] = [
 {
  "name": "Afghanistan",
  "slug": "afghanistan",
  "flag": "🇦🇫"
 },
 {
  "name": "Albania",
  "slug": "albania",
  "flag": "🇦🇱"
 },
 {
  "name": "Algeria",
  "slug": "algeria",
  "flag": "🇩🇿"
 },
 {
  "name": "Andorra",
  "slug": "andorra",
  "flag": "🇦🇩"
 },
 {
  "name": "Angola",
  "slug": "angola",
  "flag": "🇦🇴"
 },
 {
  "name": "Antigua and Barbuda",
  "slug": "antigua-and-barbuda",
  "flag": "🇦🇬"
 },
 {
  "name": "Argentina",
  "slug": "argentina",
  "flag": "🇦🇷"
 },
 {
  "name": "Armenia",
  "slug": "armenia",
  "flag": "🇦🇲"
 },
 {
  "name": "Australia",
  "slug": "australia",
  "flag": "🇦🇺"
 },
 {
  "name": "Austria",
  "slug": "austria",
  "flag": "🇦🇹"
 },
 {
  "name": "Azerbaijan",
  "slug": "azerbaijan",
  "flag": "🇦🇿"
 },
 {
  "name": "Bahamas",
  "slug": "bahamas",
  "flag": "🇧🇸"
 },
 {
  "name": "Bahrain",
  "slug": "bahrain",
  "flag": "🇧🇭"
 },
 {
  "name": "Bangladesh",
  "slug": "bangladesh",
  "flag": "🇧🇩"
 },
 {
  "name": "Barbados",
  "slug": "barbados",
  "flag": "🇧🇧"
 },
 {
  "name": "Belarus",
  "slug": "belarus",
  "flag": "🇧🇾"
 },
 {
  "name": "Belgium",
  "slug": "belgium",
  "flag": "🇧🇪"
 },
 {
  "name": "Belize",
  "slug": "belize",
  "flag": "🇧🇿"
 },
 {
  "name": "Benin",
  "slug": "benin",
  "flag": "🇧🇯"
 },
 {
  "name": "Bhutan",
  "slug": "bhutan",
  "flag": "🇧🇹"
 },
 {
  "name": "Bolivia",
  "slug": "bolivia",
  "flag": "🇧🇴"
 },
 {
  "name": "Bosnia and Herzegovina",
  "slug": "bosnia-and-herzegovina",
  "flag": "🇧🇦"
 },
 {
  "name": "Botswana",
  "slug": "botswana",
  "flag": "🇧🇼"
 },
 {
  "name": "Brazil",
  "slug": "brazil",
  "flag": "🇧🇷"
 },
 {
  "name": "Brunei Darussalam",
  "slug": "brunei",
  "flag": "🇧🇳"
 },
 {
  "name": "Bulgaria",
  "slug": "bulgaria",
  "flag": "🇧🇬"
 },
 {
  "name": "Burkina Faso",
  "slug": "burkina-faso",
  "flag": "🇧🇫"
 },
 {
  "name": "Burundi",
  "slug": "burundi",
  "flag": "🇧🇮"
 },
 {
  "name": "Cabo Verde",
  "slug": "cabo-verde",
  "flag": "🇨🇻"
 },
 {
  "name": "Cambodia",
  "slug": "cambodia",
  "flag": "🇰🇭"
 },
 {
  "name": "Cameroon",
  "slug": "cameroon",
  "flag": "🇨🇲"
 },
 {
  "name": "Canada",
  "slug": "canada",
  "flag": "🇨🇦"
 },
 {
  "name": "Central African Republic",
  "slug": "central-african-republic",
  "flag": "🇨🇫"
 },
 {
  "name": "Chad",
  "slug": "chad",
  "flag": "🇹🇩"
 },
 {
  "name": "Chile",
  "slug": "chile",
  "flag": "🇨🇱"
 },
 {
  "name": "China",
  "slug": "china",
  "flag": "🇨🇳"
 },
 {
  "name": "Colombia",
  "slug": "colombia",
  "flag": "🇨🇴"
 },
 {
  "name": "Comoros",
  "slug": "comoros",
  "flag": "🇰🇲"
 },
 {
  "name": "Costa Rica",
  "slug": "costa-rica",
  "flag": "🇨🇷"
 },
 {
  "name": "Côte d'Ivoire",
  "slug": "cote-divoire",
  "flag": "🇨🇮"
 },
 {
  "name": "Croatia",
  "slug": "croatia",
  "flag": "🇭🇷"
 },
 {
  "name": "Cuba",
  "slug": "cuba",
  "flag": "🇨🇺"
 },
 {
  "name": "Cyprus",
  "slug": "cyprus",
  "flag": "🇨🇾"
 },
 {
  "name": "Czech Republic",
  "slug": "czech-republic",
  "flag": "🇨🇿"
 },
 {
  "name": "Democratic Republic of the Congo",
  "slug": "democratic-republic-of-the-congo",
  "flag": "🇨🇩"
 },
 {
  "name": "Denmark",
  "slug": "denmark",
  "flag": "🇩🇰"
 },
 {
  "name": "Djibouti",
  "slug": "djibouti",
  "flag": "🇩🇯"
 },
 {
  "name": "Dominica",
  "slug": "dominica",
  "flag": "🇩🇲"
 },
 {
  "name": "Dominican Republic",
  "slug": "dominican-republic",
  "flag": "🇩🇴"
 },
 {
  "name": "Ecuador",
  "slug": "ecuador",
  "flag": "🇪🇨"
 },
 {
  "name": "Egypt",
  "slug": "egypt",
  "flag": "🇪🇬"
 },
 {
  "name": "El Salvador",
  "slug": "el-salvador",
  "flag": "🇸🇻"
 },
 {
  "name": "Equatorial Guinea",
  "slug": "equatorial-guinea",
  "flag": "🇬🇶"
 },
 {
  "name": "Eritrea",
  "slug": "eritrea",
  "flag": "🇪🇷"
 },
 {
  "name": "Estonia",
  "slug": "estonia",
  "flag": "🇪🇪"
 },
 {
  "name": "Eswatini",
  "slug": "eswatini",
  "flag": "🇸🇿"
 },
 {
  "name": "Ethiopia",
  "slug": "ethiopia",
  "flag": "🇪🇹"
 },
 {
  "name": "Federated States of Micronesia",
  "slug": "federated-states-of-micronesia",
  "flag": "🇫🇲"
 },
 {
  "name": "Fiji",
  "slug": "fiji",
  "flag": "🇫🇯"
 },
 {
  "name": "Finland",
  "slug": "finland",
  "flag": "🇫🇮"
 },
 {
  "name": "France",
  "slug": "france",
  "flag": "🇫🇷"
 },
 {
  "name": "Gabon",
  "slug": "gabon",
  "flag": "🇬🇦"
 },
 {
  "name": "Gambia",
  "slug": "gambia",
  "flag": "🇬🇲"
 },
 {
  "name": "Georgia",
  "slug": "georgia",
  "flag": "🇬🇪"
 },
 {
  "name": "Germany",
  "slug": "germany",
  "flag": "🇩🇪"
 },
 {
  "name": "Ghana",
  "slug": "ghana",
  "flag": "🇬🇭"
 },
 {
  "name": "Greece",
  "slug": "greece",
  "flag": "🇬🇷"
 },
 {
  "name": "Grenada",
  "slug": "grenada",
  "flag": "🇬🇩"
 },
 {
  "name": "Guatemala",
  "slug": "guatemala",
  "flag": "🇬🇹"
 },
 {
  "name": "Guinea",
  "slug": "guinea",
  "flag": "🇬🇳"
 },
 {
  "name": "Guinea-Bissau",
  "slug": "guinea-bissau",
  "flag": "🇬🇼"
 },
 {
  "name": "Guyana",
  "slug": "guyana",
  "flag": "🇬🇾"
 },
 {
  "name": "Haiti",
  "slug": "haiti",
  "flag": "🇭🇹"
 },
 {
  "name": "Honduras",
  "slug": "honduras",
  "flag": "🇭🇳"
 },
 {
  "name": "Hungary",
  "slug": "hungary",
  "flag": "🇭🇺"
 },
 {
  "name": "Iceland",
  "slug": "iceland",
  "flag": "🇮🇸"
 },
 {
  "name": "India",
  "slug": "india",
  "flag": "🇮🇳"
 },
 {
  "name": "Indonesia",
  "slug": "indonesia",
  "flag": "🇮🇩"
 },
 {
  "name": "Iran",
  "slug": "iran",
  "flag": "🇮🇷"
 },
 {
  "name": "Iraq",
  "slug": "iraq",
  "flag": "🇮🇶"
 },
 {
  "name": "Ireland",
  "slug": "ireland",
  "flag": "🇮🇪"
 },
 {
  "name": "Israel",
  "slug": "israel",
  "flag": "🇮🇱"
 },
 {
  "name": "Italy",
  "slug": "italy",
  "flag": "🇮🇹"
 },
 {
  "name": "Jamaica",
  "slug": "jamaica",
  "flag": "🇯🇲"
 },
 {
  "name": "Japan",
  "slug": "japan",
  "flag": "🇯🇵"
 },
 {
  "name": "Jordan",
  "slug": "jordan",
  "flag": "🇯🇴"
 },
 {
  "name": "Kazakhstan",
  "slug": "kazakhstan",
  "flag": "🇰🇿"
 },
 {
  "name": "Kenya",
  "slug": "kenya",
  "flag": "🇰🇪"
 },
 {
  "name": "Kiribati",
  "slug": "kiribati",
  "flag": "🇰🇮"
 },
 {
  "name": "Kosovo",
  "slug": "kosovo",
  "flag": "🇽🇰"
 },
 {
  "name": "Kuwait",
  "slug": "kuwait",
  "flag": "🇰🇼"
 },
 {
  "name": "Kyrgyzstan",
  "slug": "kyrgyzstan",
  "flag": "🇰🇬"
 },
 {
  "name": "Laos",
  "slug": "laos",
  "flag": "🇱🇦"
 },
 {
  "name": "Latvia",
  "slug": "latvia",
  "flag": "🇱🇻"
 },
 {
  "name": "Lebanon",
  "slug": "lebanon",
  "flag": "🇱🇧"
 },
 {
  "name": "Lesotho",
  "slug": "lesotho",
  "flag": "🇱🇸"
 },
 {
  "name": "Liberia",
  "slug": "liberia",
  "flag": "🇱🇷"
 },
 {
  "name": "Libya",
  "slug": "libya",
  "flag": "🇱🇾"
 },
 {
  "name": "Liechtenstein",
  "slug": "liechtenstein",
  "flag": "🇱🇮"
 },
 {
  "name": "Lithuania",
  "slug": "lithuania",
  "flag": "🇱🇹"
 },
 {
  "name": "Luxembourg",
  "slug": "luxembourg",
  "flag": "🇱🇺"
 },
 {
  "name": "Madagascar",
  "slug": "madagascar",
  "flag": "🇲🇬"
 },
 {
  "name": "Malawi",
  "slug": "malawi",
  "flag": "🇲🇼"
 },
 {
  "name": "Malaysia",
  "slug": "malaysia",
  "flag": "🇲🇾"
 },
 {
  "name": "Maldives",
  "slug": "maldives",
  "flag": "🇲🇻"
 },
 {
  "name": "Mali",
  "slug": "mali",
  "flag": "🇲🇱"
 },
 {
  "name": "Malta",
  "slug": "malta",
  "flag": "🇲🇹"
 },
 {
  "name": "Marshall Islands",
  "slug": "marshall-islands",
  "flag": "🇲🇭"
 },
 {
  "name": "Mauritania",
  "slug": "mauritania",
  "flag": "🇲🇷"
 },
 {
  "name": "Mauritius",
  "slug": "mauritius",
  "flag": "🇲🇺"
 },
 {
  "name": "Mexico",
  "slug": "mexico",
  "flag": "🇲🇽"
 },
 {
  "name": "Moldova",
  "slug": "moldova",
  "flag": "🇲🇩"
 },
 {
  "name": "Monaco",
  "slug": "monaco",
  "flag": "🇲🇨"
 },
 {
  "name": "Mongolia",
  "slug": "mongolia",
  "flag": "🇲🇳"
 },
 {
  "name": "Montenegro",
  "slug": "montenegro",
  "flag": "🇲🇪"
 },
 {
  "name": "Morocco",
  "slug": "morocco",
  "flag": "🇲🇦"
 },
 {
  "name": "Mozambique",
  "slug": "mozambique",
  "flag": "🇲🇿"
 },
 {
  "name": "Myanmar",
  "slug": "myanmar",
  "flag": "🇲🇲"
 },
 {
  "name": "Namibia",
  "slug": "namibia",
  "flag": "🇳🇦"
 },
 {
  "name": "Nauru",
  "slug": "nauru",
  "flag": "🇳🇷"
 },
 {
  "name": "Nepal",
  "slug": "nepal",
  "flag": "🇳🇵"
 },
 {
  "name": "Netherlands",
  "slug": "netherlands",
  "flag": "🇳🇱"
 },
 {
  "name": "New Zealand",
  "slug": "new-zealand",
  "flag": "🇳🇿"
 },
 {
  "name": "Nicaragua",
  "slug": "nicaragua",
  "flag": "🇳🇮"
 },
 {
  "name": "Niger",
  "slug": "niger",
  "flag": "🇳🇪"
 },
 {
  "name": "Nigeria",
  "slug": "nigeria",
  "flag": "🇳🇬"
 },
 {
  "name": "North Korea",
  "slug": "north-korea",
  "flag": "🇰🇵"
 },
 {
  "name": "North Macedonia",
  "slug": "north-macedonia",
  "flag": "🇲🇰"
 },
 {
  "name": "Norway",
  "slug": "norway",
  "flag": "🇳🇴"
 },
 {
  "name": "Oman",
  "slug": "oman",
  "flag": "🇴🇲"
 },
 {
  "name": "Pakistan",
  "slug": "pakistan",
  "flag": "🇵🇰"
 },
 {
  "name": "Palau",
  "slug": "palau",
  "flag": "🇵🇼"
 },
 {
  "name": "Palestine",
  "slug": "palestine",
  "flag": "🇵🇸"
 },
 {
  "name": "Panama",
  "slug": "panama",
  "flag": "🇵🇦"
 },
 {
  "name": "Papua New Guinea",
  "slug": "papua-new-guinea",
  "flag": "🇵🇬"
 },
 {
  "name": "Paraguay",
  "slug": "paraguay",
  "flag": "🇵🇾"
 },
 {
  "name": "Peru",
  "slug": "peru",
  "flag": "🇵🇪"
 },
 {
  "name": "Philippines",
  "slug": "philippines",
  "flag": "🇵🇭"
 },
 {
  "name": "Poland",
  "slug": "poland",
  "flag": "🇵🇱"
 },
 {
  "name": "Portugal",
  "slug": "portugal",
  "flag": "🇵🇹"
 },
 {
  "name": "Qatar",
  "slug": "qatar",
  "flag": "🇶🇦"
 },
 {
  "name": "Republic of the Congo",
  "slug": "republic-of-the-congo",
  "flag": "🇨🇬"
 },
 {
  "name": "Romania",
  "slug": "romania",
  "flag": "🇷🇴"
 },
 {
  "name": "Russia",
  "slug": "russia",
  "flag": "🇷🇺"
 },
 {
  "name": "Rwanda",
  "slug": "rwanda",
  "flag": "🇷🇼"
 },
 {
  "name": "Saint Kitts and Nevis",
  "slug": "saint-kitts-and-nevis",
  "flag": "🇰🇳"
 },
 {
  "name": "Saint Lucia",
  "slug": "saint-lucia",
  "flag": "🇱🇨"
 },
 {
  "name": "Saint Vincent and the Grenadines",
  "slug": "saint-vincent-and-the-grenadines",
  "flag": "🇻🇨"
 },
 {
  "name": "Samoa",
  "slug": "samoa",
  "flag": "🇼🇸"
 },
 {
  "name": "San Marino",
  "slug": "san-marino",
  "flag": "🇸🇲"
 },
 {
  "name": "São Tomé and Príncipe",
  "slug": "sao-tome-and-principe",
  "flag": "🇸🇹"
 },
 {
  "name": "Saudi Arabia",
  "slug": "saudi-arabia",
  "flag": "🇸🇦"
 },
 {
  "name": "Senegal",
  "slug": "senegal",
  "flag": "🇸🇳"
 },
 {
  "name": "Serbia",
  "slug": "serbia",
  "flag": "🇷🇸"
 },
 {
  "name": "Seychelles",
  "slug": "seychelles",
  "flag": "🇸🇨"
 },
 {
  "name": "Sierra Leone",
  "slug": "sierra-leone",
  "flag": "🇸🇱"
 },
 {
  "name": "Singapore",
  "slug": "singapore",
  "flag": "🇸🇬"
 },
 {
  "name": "Slovakia",
  "slug": "slovakia",
  "flag": "🇸🇰"
 },
 {
  "name": "Slovenia",
  "slug": "slovenia",
  "flag": "🇸🇮"
 },
 {
  "name": "Solomon Islands",
  "slug": "solomon-islands",
  "flag": "🇸🇧"
 },
 {
  "name": "Somalia",
  "slug": "somalia",
  "flag": "🇸🇴"
 },
 {
  "name": "South Africa",
  "slug": "south-africa",
  "flag": "🇿🇦"
 },
 {
  "name": "South Korea",
  "slug": "south-korea",
  "flag": "🇰🇷"
 },
 {
  "name": "South Sudan",
  "slug": "south-sudan",
  "flag": "🇸🇸"
 },
 {
  "name": "Spain",
  "slug": "spain",
  "flag": "🇪🇸"
 },
 {
  "name": "Sri Lanka",
  "slug": "sri-lanka",
  "flag": "🇱🇰"
 },
 {
  "name": "Sudan",
  "slug": "sudan",
  "flag": "🇸🇩"
 },
 {
  "name": "Suriname",
  "slug": "suriname",
  "flag": "🇸🇷"
 },
 {
  "name": "Sweden",
  "slug": "sweden",
  "flag": "🇸🇪"
 },
 {
  "name": "Switzerland",
  "slug": "switzerland",
  "flag": "🇨🇭"
 },
 {
  "name": "Syria",
  "slug": "syria",
  "flag": "🇸🇾"
 },
 {
  "name": "Taiwan",
  "slug": "taiwan",
  "flag": "🇹🇼"
 },
 {
  "name": "Tajikistan",
  "slug": "tajikistan",
  "flag": "🇹🇯"
 },
 {
  "name": "Tanzania",
  "slug": "tanzania",
  "flag": "🇹🇿"
 },
 {
  "name": "Thailand",
  "slug": "thailand",
  "flag": "🇹🇭"
 },
 {
  "name": "Timor-Leste",
  "slug": "timor-leste",
  "flag": "🇹🇱"
 },
 {
  "name": "Togo",
  "slug": "togo",
  "flag": "🇹🇬"
 },
 {
  "name": "Tonga",
  "slug": "tonga",
  "flag": "🇹🇴"
 },
 {
  "name": "Trinidad and Tobago",
  "slug": "trinidad-and-tobago",
  "flag": "🇹🇹"
 },
 {
  "name": "Tunisia",
  "slug": "tunisia",
  "flag": "🇹🇳"
 },
 {
  "name": "Türkiye",
  "slug": "turkiye",
  "flag": "🇹🇷"
 },
 {
  "name": "Turkmenistan",
  "slug": "turkmenistan",
  "flag": "🇹🇲"
 },
 {
  "name": "Tuvalu",
  "slug": "tuvalu",
  "flag": "🇹🇻"
 },
 {
  "name": "Uganda",
  "slug": "uganda",
  "flag": "🇺🇬"
 },
 {
  "name": "Ukraine",
  "slug": "ukraine",
  "flag": "🇺🇦"
 },
 {
  "name": "United Arab Emirates",
  "slug": "united-arab-emirates",
  "flag": "🇦🇪"
 },
 {
  "name": "United Kingdom",
  "slug": "united-kingdom",
  "flag": "🇬🇧"
 },
 {
  "name": "United States",
  "slug": "united-states",
  "flag": "🇺🇸"
 },
 {
  "name": "Uruguay",
  "slug": "uruguay",
  "flag": "🇺🇾"
 },
 {
  "name": "Uzbekistan",
  "slug": "uzbekistan",
  "flag": "🇺🇿"
 },
 {
  "name": "Vanuatu",
  "slug": "vanuatu",
  "flag": "🇻🇺"
 },
 {
  "name": "Vatican City (Holy See)",
  "slug": "vatican-city",
  "flag": "🇻🇦"
 },
 {
  "name": "Venezuela",
  "slug": "venezuela",
  "flag": "🇻🇪"
 },
 {
  "name": "Vietnam",
  "slug": "vietnam",
  "flag": "🇻🇳"
 },
 {
  "name": "Yemen",
  "slug": "yemen",
  "flag": "🇾🇪"
 },
 {
  "name": "Zambia",
  "slug": "zambia",
  "flag": "🇿🇲"
 },
 {
  "name": "Zimbabwe",
  "slug": "zimbabwe",
  "flag": "🇿🇼"
 }
];

export const BASE_ORIGINS: readonly Origin[] = [
 {
  "slug": "pakistan",
  "name": "Pakistan",
  "flag": "🇵🇰",
  "archetype": "work-sponsorship",
  "credentialBody": "HEC (Higher Education Commission) — degree attestation",
  "languageNote": "IELTS/PTE usually required; some universities accept MOI (English-medium degree).",
  "topWorry": "Cost + can I actually get sponsored",
  "scholarshipCluster": [
   "Fully funded scholarships",
   "Chevening",
   "Commonwealth"
  ]
 },
 {
  "slug": "india",
  "name": "India",
  "flag": "🇮🇳",
  "archetype": "pr-roi",
  "credentialBody": "AIU (Association of Indian Universities) — equivalence where asked",
  "languageNote": "MOI certificate can waive a test where the degree was English-medium; visa English may still apply.",
  "topWorry": "Will it lead to PR / is it worth the money",
  "scholarshipCluster": [
   "Commonwealth",
   "Fulbright",
   "Chevening"
  ]
 },
 {
  "slug": "nigeria",
  "name": "Nigeria",
  "flag": "🇳🇬",
  "archetype": "scholarship",
  "credentialBody": "NUC (National Universities Commission) — institution recognition",
  "languageNote": "English-medium; some study-without-IELTS via MOI. Proof of funds is a real visa step.",
  "topWorry": "Funding + visa approval odds",
  "scholarshipCluster": [
   "Chevening",
   "Commonwealth",
   "World Bank"
  ]
 },
 {
  "slug": "bangladesh",
  "name": "Bangladesh",
  "flag": "🇧🇩",
  "archetype": "scholarship",
  "credentialBody": "UGC (University Grants Commission of Bangladesh)",
  "languageNote": "Most need IELTS; some universities accept MOI to waive a test.",
  "topWorry": "Affordability (taka–dollar gap)",
  "scholarshipCluster": [
   "Fulbright",
   "Chevening",
   "CSC",
   "GKS",
   "DAAD",
   "Commonwealth"
  ]
 },
 {
  "slug": "nepal",
  "name": "Nepal",
  "flag": "🇳🇵",
  "archetype": "scholarship",
  "credentialBody": "UGC Nepal + Ministry of Education NOC (No Objection Certificate)",
  "languageNote": "Most need IELTS. Part-time work-hour caps apply per destination.",
  "topWorry": "Funding + earning while studying",
  "scholarshipCluster": [
   "Scholarships for Nepali students",
   "Chevening",
   "Australia Awards"
  ]
 },
 {
  "slug": "philippines",
  "name": "Philippines",
  "flag": "🇵🇭",
  "archetype": "healthcare",
  "credentialBody": "CHED (Commission on Higher Education); PRC licence for nursing",
  "languageNote": "English-medium. Nursing registration uses OET/IELTS (UK NMC does NOT accept PTE; AHPRA does).",
  "topWorry": "Which English test the regulator counts; placement-fee scams",
  "scholarshipCluster": [
   "Healthcare scholarships",
   "Fulbright"
  ]
 },
 {
  "slug": "vietnam",
  "name": "Vietnam",
  "flag": "🇻🇳",
  "archetype": "healthcare",
  "credentialBody": "MOET (Ministry of Education and Training) — certified English translation",
  "languageNote": "English (PTE/IELTS) for AU/UK/CA; JLPT N4/JFT for Japan, EPS-TOPIK for Korea, German for Germany.",
  "topWorry": "Which language test the route actually needs",
  "scholarshipCluster": [
   "Erasmus Mundus",
   "Government scholarships"
  ]
 },
 {
  "slug": "china",
  "name": "China",
  "flag": "🇨🇳",
  "archetype": "ranking",
  "credentialBody": "CHSI/CHESICC (Ministry of Education verification)",
  "languageNote": "IELTS/PTE set per university; more selective universities ask for higher scores.",
  "topWorry": "Competitive admissions — no inflated admit-chance claims",
  "scholarshipCluster": [
   "CSC",
   "University funding"
  ]
 },
 {
  "slug": "egypt",
  "name": "Egypt",
  "flag": "🇪🇬",
  "archetype": "scholarship",
  "credentialBody": "Supreme Council of Universities (Egyptian Ministry of Higher Education)",
  "languageNote": "Many degrees English-medium; some universities waive a test via MOI; scholarship/visa may still need a score.",
  "topWorry": "Funding + IELTS vs MOI",
  "scholarshipCluster": [
   "Chevening",
   "DAAD",
   "Erasmus Mundus",
   "Fulbright"
  ]
 },
 {
  "slug": "sri-lanka",
  "name": "Sri Lanka",
  "flag": "🇱🇰",
  "archetype": "scholarship",
  "credentialBody": "UGC (University Grants Commission of Sri Lanka) — NOT Pakistan's HEC",
  "languageNote": "Most need IELTS; some accept MOI. Nursing registration is a separate step.",
  "topWorry": "Funding + recognition (UGC)",
  "scholarshipCluster": [
   "Chevening",
   "Commonwealth",
   "Australia Awards"
  ]
 }
];

const _cBySlug = new Map(COUNTRIES.map((c) => [c.slug, c]));
export const findCountry = (slug: string): Country | undefined => _cBySlug.get(slug);
export const COUNTRY_SLUGS = COUNTRIES.map((c) => c.slug);
