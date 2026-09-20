// Car pictures and flags shared by the team editor (index.js) and the Team Principal team picker.
// Car pictures available for teams (used by the team editor).
const TEAM_IMAGE_LIST = ["ALP1","ALP24","ALP25","ALP26","AMR24","AMR25","ARR1","ARR201","ARR21","ARR31","AST1","AST26","AUD26","BEL1","BEN1","BRA1","CAD26","FER1","FER201","FER21","FER24","FER25","FER26","FRA1","GBR1","GER1","HAA1","HAA201","HAA21","HAA24","HAA25","HAA26","HAA31","HAA41","HAA51","HON1","JAG1","JAG21","LOT1","LOT21","LOT31","MCL1","MCL201","MCL21","MCL24","MCL25","MCL26","MCL31","MCL41","MER1","MER201","MER21","MER24","MER25","MER26","MER31","MERBLM1","PER26","PET1","PEU1","PEU2","POR1","POR21","POR31","POR41","RBR1","RBR201","RBR21","RBR24","RBR25","RBR26","REN1","REN201","REN21","REN31","RENT201","RPT1","RPT201","RPT21","RPT31","SAT201","SAT21","SAU24","SAU25","STR1","VRB24","VRB25","VRB26","WIL1","WIL201","WIL21","WIL24","WIL25","WIL26","WIL31","WIL41","WILT201"];

// Flags available for drivers (nationality) and teams (constructor), from img/flags/*.png.
// Countries that have actually raced in F1 (and so are the most likely picks)
// come first, alphabetically; everything else follows, also alphabetically.
const FLAG_LIST = ["argentina","australia","austria","belgium","brazil","canada","chile","china","colombia","czechia","denmark","finland","france","germany","hungary","india","indonesia","ireland","italy","japan","liechtenstein","malaysia","mexico","monaco","netherlands","new_zealand","poland","portugal","russia","south_africa","spain","sweden","switzerland","thailand","uk","uruguay","usa","venezuela","afghanistan","albania","algeria","andorra","angola","anguilla","antigua","armenia","aruba","azerbaijan","bahamas","bahrain","bangladesh","barbados","belarus","belize","benin","bermuda","bhutan","bolivia","bonaire","bosnia","botswana","brunei","bulgaria","burkina_faso","burundi","caledonia","cambodia","cameroon","cape_verde","cayman","chad","comoros","congo","cook","costa_rica","croatia","cta","cuba","curacao","cyprus","djibouti","dominica","dominican_rep","dr_congo","ecuador","egypt","england","eq_guinea","eritrea","estonia","eswatini","ethiopia","faroe","fiji","fr_guiana","gabon","gambia","gdr","georgia","ghana","gibraltar","greece","greenland","grenada","guam","guatemala","guinea","guinea_bissau","guyana","haiti","honduras","hong_kong","iceland","iran","iraq","israel","ivory_coast","jamaica","jordan","kazakhstan","kenya","kiribati","kitts","korea","kosovo","kuwait","kyrgyzstan","laos","latvia","lebanon","lesotho","liberia","libya","lithuania","luxembourg","macao","macedonia","madagascar","malawi","maldives","mali","malta","mariana","martinique","mauritania","mauritius","micronesia","moldova","mongolia","montenegro","montserrat","morocco","mozambique","myanmar","namibia","nepal","nicaragua","niger","nigeria","niue","north_korea","northern_cyprus","northern_ireland","norway","oman","pakistan","palau","palestine","panama","papua","paraguay","peru","philippines","puerto_rico","qatar","reunion","romania","rwanda","salvador","samoa","san_marino","sao_tome","saudi_arabia","scotland","senegal","serbia","seychelles","sierra_leone","singapore","slovakia","slovenia","solomon","somalia","south_korea","south_sudan","sri_lanka","st_eustatius","st_lucia","st_maarten","st_vincent","sudan","suriname","syria","tahiti","taiwan","tajikistan","tanzania","timor","togo","tonga","trinidad","tunisia","turkey","turkmenistan","turks_caicos","tuvalu","uae","uganda","ukraine","us_samoa","us_virgin","ussr","uzbekistan","vanuatu","vatican","vietnam","wales","wallis","yemen","yugoslavia","zambia","zimbabwe"];

// Team count bounds. A team always has exactly 2 drivers, so this also bounds
// the field at 20-30 drivers.
const MIN_TEAMS = 10;
const MAX_TEAMS = 15;

// Popups of images (flags, cars) opened from a small thumbnail. They open below it, but flip above
// when there isn't enough room under it (thumbnail low in the window), and are limited to the room
// that is available so that every image stays reachable by scrolling inside the popup.

// Popup positioned with `position: fixed` (top/left set here): call it once it is displayed.
function placeDropdownVertically(dropdown, anchor) {
    const gap = 6, margin = 8;
    const rect = anchor.getBoundingClientRect();
    dropdown.style.boxSizing = 'border-box';   // maxHeight below then includes the padding
    dropdown.style.maxHeight = '';
    const natural = dropdown.offsetHeight;
    const below = window.innerHeight - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    if (natural <= below || below >= above) {
        dropdown.style.maxHeight = Math.max(80, Math.min(natural, below)) + 'px';
        dropdown.style.top = (rect.bottom + gap) + 'px';
    } else {
        const height = Math.max(80, Math.min(natural, above));
        dropdown.style.maxHeight = height + 'px';
        dropdown.style.top = (rect.top - gap - height) + 'px';
    }
}

// Popup positioned with `position: absolute` under its picker (.tp-img-grid): toggles the `up` class.
function placePickerGrid(grid) {
    const gap = 6, margin = 8;
    const anchor = grid.parentElement.getBoundingClientRect();
    grid.classList.remove('up');
    grid.style.boxSizing = 'border-box';
    grid.style.maxHeight = '';
    const natural = grid.offsetHeight;
    const below = window.innerHeight - anchor.bottom - gap - margin;
    const above = anchor.top - gap - margin;
    const up = natural > below && above > below;
    grid.classList.toggle('up', up);
    grid.style.maxHeight = Math.max(80, Math.min(natural, up ? above : below)) + 'px';
}
