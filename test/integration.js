// test/integration.js
const path = require('path');
const { tests } = require('@iobroker/testing');

// Run integration tests - they require a running JS-Controller
const testDir = path.join(__dirname, '..');

tests.integration(testDir, {
    // If the startup takes longer than this, the test will fail
    startTimeout: 30000,
    
    // Define your own tests here
    defineAdapterSuites: ({ suite }) => {
        suite('Test energy-schedule adapter', (getHarness) => {
            let harness;
            
            before(async function() {
                this.timeout(30000);
                harness = getHarness();
            });

            it('Adapter should be loaded', async () => {
                // Check if adapter is running
                const obj = await harness.objects.getObjectAsync('system.adapter.energy-schedule.0');
                expect(obj).to.be.ok;
                expect(obj.common.enabled).to.be.true;
            });

            after(async () => {
                // Stop the adapter after tests
                await harness.stopAdapter();
            });
        });
    },
});