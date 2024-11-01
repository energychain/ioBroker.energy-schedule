// test/unit.js
const path = require('path');
const { tests } = require('@iobroker/testing');

// Run unit tests - they don't need a running JS-Controller
tests.unit(path.join(__dirname, '..'));