// Centralized environment loader ensuring .env is loaded regardless of cwd
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
// Export nothing; just side-effect import
module.exports = {};