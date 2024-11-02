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
            
            // Validate ZIP code
            if (!this.config.zip) {
                this.log.error("No ZIP code configured!");
                return;
            }
    
            // Initialize client configuration
            const clientConfig = {
                appid: "0xb61DD55F0DDA7C17975a82dd18EAeD8C025a64ea",
                zip: this.config.zip // Add ZIP to client config
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
                
                // Test the connection with correct method and ZIP
                const testConnection = await this.client.strommix.getEnergyMix({
                    zip: this.config.zip,
                    timeframe: "last7days"
                });
                
                if (!testConnection) {
                    throw new Error("No response from API");
                }
                
                this.log.debug(`API Test response received: ${JSON.stringify(testConnection)}`);
                
                // Mark connection as established
                await this.setStateAsync('info.connection', { val: true, ack: true });
                this.log.info("Successfully connected to Corrently API");
    
                // Create states after successful connection
                await this.createStates();
    
                // Start schedule check interval
                this.scheduleCheckInterval = setInterval(() => {
                    this.checkScheduleStatus();
                }, 60000); // Check every minute
    
                // Initial schedule creation if requirements are set
                await this.createInitialSchedule();
    
            } catch (apiError) {
                this.log.error(`Failed to connect to Corrently API: ${apiError.message}`);
                if (apiError.response) {
                    this.log.error(`API Response: ${JSON.stringify(apiError.response.data)}`);
                }
                await this.setStateAsync('info.connection', { val: false, ack: true });
                return;
            }
            
        } catch (error) {
            this.log.error(`Initialization error: ${error.message}`);
            if (error.stack) this.log.debug(`Stack: ${error.stack}`);
            await this.setStateAsync('info.connection', { val: false, ack: true });
        }
    }

    async createStates() {
        try {
            // Erstelle zuerst die Channels
            await this.setObjectNotExistsAsync("requirements", {
                type: "channel",
                common: {
                    name: "Schedule Requirements"
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
    
            await this.setObjectNotExistsAsync("control", {
                type: "channel",
                common: {
                    name: "Schedule Control"
                },
                native: {}
            });
    
            // Warte kurz
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            // Erstelle dann die States
            const states = {
                "requirements.energyDemand": {
                    name: "Energy Demand",
                    type: "number",
                    role: "value",
                    unit: "kWh",
                    read: true,
                    write: true
                },
                "requirements.maxLoad": {
                    name: "Maximum Load",
                    type: "number",
                    role: "value",
                    unit: "W",
                    read: true,
                    write: true
                },
                "requirements.avgLoad": {
                    name: "Average Load",
                    type: "number",
                    role: "value",
                    unit: "W",
                    read: true,
                    write: true
                },
                "status.isActive": {
                    name: "Schedule Active",
                    type: "boolean",
                    role: "indicator",
                    read: true,
                    write: false
                },
                "status.nextSwitch": {
                    name: "Next Switch Time",
                    type: "string",
                    role: "text",
                    read: true,
                    write: false
                },
                "status.scheduleId": {
                    name: "Current Schedule ID",
                    type: "string",
                    role: "text",
                    read: true,
                    write: false
                },
                "status.scheduleDetails": {
                    name: "Complete Schedule Details",
                    type: "string",
                    role: "json",
                    read: true,
                    write: false
                },
                "control.createSchedule": {
                    name: "Create New Schedule",
                    type: "boolean",
                    role: "button",
                    read: false,
                    write: true
                }
            };
    
            // Erstelle alle States
            for (const [id, common] of Object.entries(states)) {
                await this.setObjectNotExistsAsync(id, {
                    type: "state",
                    common: common,
                    native: {}
                });
            }
    
            this.log.info("All states created successfully");
        } catch (error) {
            this.log.error(`Error creating states: ${error.message}`);
            throw error;
        }
    }

    async createInitialSchedule() {
        try {
            // Warte kurz, bis alle States erstellt sind
            await new Promise(resolve => setTimeout(resolve, 2000));
    
            this.log.info("Checking for existing requirements...");
            
            const energyDemand = await this.getStateAsync("requirements.energyDemand");
            const maxLoad = await this.getStateAsync("requirements.maxLoad");
            const avgLoad = await this.getStateAsync("requirements.avgLoad");
    
            // Prüfe, ob die States existieren UND Werte haben
            if (energyDemand && maxLoad && avgLoad &&
                energyDemand.val !== null && 
                maxLoad.val !== null && 
                avgLoad.val !== null) {
                    
                this.log.info(`Found existing requirements: Energy=${energyDemand.val}, Max=${maxLoad.val}, Avg=${avgLoad.val}`);
                
                // Erstelle Schedule mit den gefundenen Werten
                await this.createSchedule({
                    requirements: {
                        energyDemand: energyDemand.val,
                        maxLoad: maxLoad.val,
                        avgLoad: avgLoad.val
                    }
                });
            } else {
                this.log.info("No complete requirements found for initial schedule");
                
                // Setze Default-Werte
                await this.setStateAsync("requirements.energyDemand", { val: 10, ack: true });
                await this.setStateAsync("requirements.maxLoad", { val: 3500, ack: true });
                await this.setStateAsync("requirements.avgLoad", { val: 2000, ack: true });
                
                // Erstelle Schedule mit Default-Werten
                await this.createSchedule({
                    requirements: {
                        energyDemand: 10,
                        maxLoad: 3500,
                        avgLoad: 2000
                    }
                });
            }
        } catch (error) {
            this.log.error(`Error in initial schedule creation: ${error.message}`);
            if (error.stack) this.log.debug(`Stack: ${error.stack}`);
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
                requirements: {
                    law: this.config.law || "comfort",
                    activeHours: this.config.activeHours || 1,
                    consecutiveHours: this.config.consecutiveHours !== false,
                    coverageHours: this.config.coverageHours || 23,
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
        try {
            // Prüfe ob schedule und seine Eigenschaften existieren
            if (!schedule?.schedule?.currentRecommendation?.currentPowerState) {
                this.log.warn('No currentPowerState found in currentRecommendation');
                return false;
            }

            return schedule.schedule.currentRecommendation.currentPowerState === 'on';
        } catch (error) {
            this.log.error(`Error in isCurrentlyActive: ${error.message}`);
            return false;
        }
    }

    findNextSwitchTime(schedule) {
        try {
            // Prüfe ob schedule und seine Eigenschaften existieren
            if (!schedule?.schedule?.currentRecommendation?.nextSwitch) {
                this.log.warn('No nextSwitch found in currentRecommendation');
                return new Date();
            }
    
            return new Date(schedule.schedule.currentRecommendation.nextSwitch);
        } catch (error) {
            this.log.error(`Error in findNextSwitchTime: ${error.message}`);
            return new Date();
        }
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

        const isActive = this.isCurrentlyActive(this.currentSchedule);
        const nextSwitch = this.findNextSwitchTime(this.currentSchedule);

        this.log.debug(`Status update - isActive: ${isActive}, nextSwitch: ${nextSwitch}, currentPowerState: ${this.currentSchedule.schedule.currentRecommendation.currentPowerState}`);

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
        this.log.debug('States updated successfully');

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