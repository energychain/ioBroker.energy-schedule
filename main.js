// main.js
"use strict";

const utils = require("@iobroker/adapter-core");
const CorrentlyClient = require('corrently-api');

class EnergySchedule extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: "energy-schedule",
        });

        this.scheduleCheckInterval = null;
        this.currentSchedule = null;
        this.client = null;

        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async onReady() {
        try {
            this.log.info("Starting energy-schedule adapter...");
            
            // Set connection state to false at startup
            await this.setStateAsync('info.connection', { val: false, ack: true });
    
            this.log.debug(`Config values: ${JSON.stringify(this.config)}`);
    
            // Initialize client configuration
            const clientConfig = {
                appid: "0xb61DD55F0DDA7C17975a82dd18EAeD8C025a64ea"
            };
    
            if (this.config.personalToken) {
                clientConfig.token = this.config.personalToken;
                this.log.debug("Using personal token from config");
            } else {
                this.log.info("No personal token configured, using default token");
            }
    
            try {
                // Initialize Corrently client
                this.log.debug(`Initializing Corrently client with config: ${JSON.stringify(clientConfig)}`);
                this.client = new CorrentlyClient(clientConfig);
                
                // Test the connection with correct method
                const testConnection = await this.client.strommix.getEnergyMix("last7days");
                this.log.debug(`API Test response: ${JSON.stringify(testConnection)}`);
                
                // Mark connection as established
                await this.setStateAsync('info.connection', { val: true, ack: true });
                this.log.info("Successfully connected to Corrently API");
    
            } catch (apiError) {
                this.log.error(`Failed to connect to Corrently API: ${apiError.message}`);
                await this.setStateAsync('info.connection', { val: false, ack: true });
                return;
            }
    
            // Create states
            await this.createStates();
    
            // Start schedule check interval
            this.scheduleCheckInterval = setInterval(() => {
                this.checkScheduleStatus();
            }, 60000); // Check every minute
    
            // Initial schedule creation if requirements are set
            await this.createInitialSchedule();
            
        } catch (error) {
            this.log.error(`Initialization error: ${error.message}`);
            await this.setStateAsync('info.connection', { val: false, ack: true });
        }
    }

    async createStates() {
        await this.setObjectNotExistsAsync("status.scheduleId", {
            type: "state",
            common: {
                name: "Current Schedule ID",
                type: "string",
                role: "text",
                read: true,
                write: false
            },
            native: {}
        });
    
        // Create states for configuration and status
        await this.setObjectNotExistsAsync("requirements", {
            type: "channel",
            common: {
                name: "Schedule Requirements"
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("requirements.energyDemand", {
            type: "state",
            common: {
                name: "Energy Demand",
                type: "number",
                role: "value",
                unit: "kWh",
                read: true,
                write: true
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("requirements.maxLoad", {
            type: "state",
            common: {
                name: "Maximum Load",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: true
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("requirements.avgLoad", {
            type: "state",
            common: {
                name: "Average Load",
                type: "number",
                role: "value",
                unit: "W",
                read: true,
                write: true
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("status", {
            type: "channel",
            common: {
                name: "Schedule Status"
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("status.isActive", {
            type: "state",
            common: {
                name: "Schedule Active",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("status.nextSwitch", {
            type: "state",
            common: {
                name: "Next Switch Time",
                type: "string",
                role: "text",
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("status.scheduleDetails", {
            type: "state",
            common: {
                name: "Complete Schedule Details",
                type: "string",
                role: "json",
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("control", {
            type: "channel",
            common: {
                name: "Schedule Control"
            },
            native: {}
        });

        await this.setObjectNotExistsAsync("control.createSchedule", {
            type: "state",
            common: {
                name: "Create New Schedule",
                type: "boolean",
                role: "button",
                read: false,
                write: true
            },
            native: {}
        });
    }

    async createInitialSchedule() {
        try {
            const energyDemand = await this.getStateAsync("requirements.energyDemand");
            const maxLoad = await this.getStateAsync("requirements.maxLoad");
            const avgLoad = await this.getStateAsync("requirements.avgLoad");

            if (energyDemand && maxLoad && avgLoad) {
                await this.createSchedule({
                    requirements: {
                        energyDemand: energyDemand.val,
                        maxLoad: maxLoad.val,
                        avgLoad: avgLoad.val
                    }
                });
            }
        } catch (error) {
            this.log.error(`Error creating initial schedule: ${error.message}`);
        }
    }

    async createSchedule(requirements) {
        try {
            this.log.info(`Creating schedule with requirements: ${JSON.stringify(requirements)}`);
            
            if (!this.config.zip) {
                this.log.error("No ZIP code configured!");
                return;
            }
    
            const mergedRequirements = {
                zip: this.config.zip,
                coverageHours: this.config.coverageHours || 24,
                requirements: {
                    law: this.config.law || "comfort",
                    activeHours: this.config.activeHours || 1,
                    consecutiveHours: this.config.consecutiveHours !== false,
                    ...requirements.requirements
                }
            };
    
            this.log.debug(`Merged requirements: ${JSON.stringify(mergedRequirements)}`);
    
            // Create new schedule
            this.log.info('Calling API to create schedule...');
            const newSchedule = await this.client.schedule.createSchedule(mergedRequirements);
            this.log.info(`Schedule created with ID: ${newSchedule.scheduleId}`);
            
            // Store scheduleId immediately
            await this.setStateAsync("status.scheduleId", { val: newSchedule.scheduleId, ack: true });
            
            // Get full schedule details
            this.log.info('Fetching schedule details...');
            this.currentSchedule = await this.client.schedule.getSchedule(newSchedule.scheduleId);
            this.log.info(`Retrieved schedule details: ${JSON.stringify(this.currentSchedule)}`);
            
            // Update all states
            await this.updateScheduleStates();
            
        } catch (error) {
            this.log.error(`Schedule creation error: ${error.message}`);
            if (error.response) {
                this.log.error(`API Response: ${JSON.stringify(error.response.data)}`);
            }
            // Clear scheduleId on error
            await this.setStateAsync("status.scheduleId", { val: null, ack: true });
        }
    }

    // Verbesserte checkScheduleStatus Funktion
async checkScheduleStatus() {
    if (!this.currentSchedule) {
        this.log.debug('No schedule to check');
        return;
    }

    try {
        const scheduleId = this.currentSchedule.scheduleId;
        this.log.debug(`Checking status for schedule ${scheduleId}`);

        // Refresh schedule details
        this.currentSchedule = await this.client.schedule.getSchedule(scheduleId);
        await this.updateScheduleStates();

    } catch (error) {
        this.log.error(`Status check error: ${error.message}`);
        this.currentSchedule = null;
        await this.updateScheduleStates(); // This will clear all states
    }
}


    isCurrentlyActive(schedule) {
        if (!schedule || !schedule.timeSlots) {
            this.log.warn('Invalid schedule or no time slots in isCurrentlyActive check');
            return false;
        }
        
        const now = new Date();
        const isActive = schedule.timeSlots.some(slot => {
            const startTime = new Date(slot.startTime);
            const endTime = new Date(slot.endTime);
            return now >= startTime && now < endTime;
        });

        this.log.debug(`Active status check: ${isActive} for schedule ${schedule.scheduleId}`);
        return isActive;
    }

    findNextSwitchTime(schedule) {
        const now = new Date();
        const activeSlots = schedule.timeSlots || [];
        
        for (const slot of activeSlots) {
            const startTime = new Date(slot.startTime);
            const endTime = new Date(slot.endTime);
            
            if (now >= startTime && now < endTime) {
                return endTime;
            } else if (now < startTime) {
                return startTime;
            }
        }
        
        return new Date(activeSlots[0]?.startTime || now);
    }
// Verbesserte updateScheduleStates Funktion
async updateScheduleStates() {
    try {
        if (!this.currentSchedule) {
            this.log.warn('No current schedule available for status update');
            await this.setStateAsync("status.isActive", { val: null, ack: true });
            await this.setStateAsync("status.nextSwitch", { val: null, ack: true });
            await this.setStateAsync("status.scheduleDetails", { val: null, ack: true });
            return;
        }

        this.log.info(`Updating states for schedule ${this.currentSchedule.scheduleId}`);

        const isActive = this.isCurrentlyActive(this.currentSchedule);
        const nextSwitch = this.findNextSwitchTime(this.currentSchedule);

        this.log.debug(`Status update - isActive: ${isActive}, nextSwitch: ${nextSwitch}`);

        const updatePromises = [
            this.setStateAsync("status.isActive", { val: isActive, ack: true }),
            this.setStateAsync("status.nextSwitch", { val: nextSwitch.toISOString(), ack: true }),
            this.setStateAsync("status.scheduleDetails", { 
                val: JSON.stringify(this.currentSchedule), 
                ack: true 
            }),
            this.setStateAsync("status.scheduleId", { 
                val: this.currentSchedule.scheduleId, 
                ack: true 
            })
        ];

        await Promise.all(updatePromises);
        this.log.info('States updated successfully');

        // Debug output of current state values
        const stateValues = {
            isActive: await this.getStateAsync("status.isActive"),
            nextSwitch: await this.getStateAsync("status.nextSwitch"),
            scheduleId: await this.getStateAsync("status.scheduleId")
        };
        this.log.debug(`Current state values: ${JSON.stringify(stateValues)}`);

    } catch (error) {
        this.log.error(`Error updating states: ${error.message}`);
    }
}


    async onStateChange(id, state) {
        if (state && !state.ack) {
            if (id.endsWith("control.createSchedule") && state.val) {
                const energyDemand = await this.getStateAsync("requirements.energyDemand");
                const maxLoad = await this.getStateAsync("requirements.maxLoad");
                const avgLoad = await this.getStateAsync("requirements.avgLoad");

                if (energyDemand && maxLoad && avgLoad) {
                    await this.createSchedule({
                        requirements: {
                            energyDemand: energyDemand.val,
                            maxLoad: maxLoad.val,
                            avgLoad: avgLoad.val
                        }
                    });
                }
            }
        }
    }

    onUnload(callback) {
        try {
            if (this.scheduleCheckInterval) {
                clearInterval(this.scheduleCheckInterval);
            }
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new EnergySchedule(options);
} else {
    // otherwise start the instance directly
    new EnergySchedule();
}