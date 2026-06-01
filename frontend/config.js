// config.js
const API_BASE_URL = window.location.protocol === 'file:' || window.location.hostname === ''
    ? 'http://localhost:5000' 
    : ''; // Bo'sh joy bo'lsa, relative path ishlatiladi (CORS va IP muammolarini yo'qotadi)

