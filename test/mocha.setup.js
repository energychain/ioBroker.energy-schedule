// test/mocha.setup.js
// Don't silently swallow unhandled rejections
process.on('unhandledRejection', (e) => {
    throw e;
});

// Load chai
const chai = require('chai');
global.expect = chai.expect;

// Load the adapter testing framework
global.tests = require('@iobroker/testing');