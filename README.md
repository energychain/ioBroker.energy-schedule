# iobroker.energy-schedule

[![NPM version](https://img.shields.io/npm/v/iobroker.energy-schedule.svg)](https://www.npmjs.com/package/iobroker.energy-schedule)
[![Downloads](https://img.shields.io/npm/dm/iobroker.energy-schedule.svg)](https://www.npmjs.com/package/iobroker.energy-schedule)

The Energy Schedule adapter enables intelligent planning of energy consumption based on the Corrently [GruenstromIndex](https://gruenstromindex.de/). It is specifically developed for the German energy market and helps operate devices at optimal times - whether for lower costs, reduced CO2 emissions, or maximum comfort.

## Features

- Optimization according to various criteria (price, CO2, comfort)
- Flexible time scheduling with configurable active hours
- Support for consecutive and non-consecutive operating times
- Real-time status monitoring
- Persistent schedule tracking
- Simple boolean output for device control
- Detailed schedule information for advanced use cases

## Installation

1. Install the adapter via the ioBroker admin interface
   - Search for "energy-schedule" in the adapter tab
   - Click "+" to create a new instance

2. Alternatively via npm:
```bash
npm install iobroker.energy-schedule
```

## Configuration

### Adapter Settings

| Setting | Description | Default |
|---------|-------------|----------|
| ZIP (Postal Code) | German postal code for location | - |
| Personal Token | Personal API token from console.corrently.io (optional) | - |
| Law (Optimization) | Optimization strategy (comfort/price/co2) | comfort |
| Active Hours | Number of active hours | 1 |
| Coverage Hours | Planning period in hours | 24 |
| Consecutive Hours | Must hours be consecutive? | true |

### States

#### Requirements (Writable)
- `energy-schedule.0.requirements.energyDemand` (number) - Required energy in kWh
- `energy-schedule.0.requirements.maxLoad` (number) - Maximum power in watts
- `energy-schedule.0.requirements.avgLoad` (number) - Average power in watts

#### Control
- `energy-schedule.0.control.createSchedule` (boolean) - Create schedule

#### Status (Readable)
- `energy-schedule.0.status.isActive` (boolean) - Is the schedule active?
- `energy-schedule.0.status.nextSwitch` (string) - Next switching time
- `energy-schedule.0.status.scheduleId` (string) - Current schedule ID
- `energy-schedule.0.status.scheduleDetails` (string) - Detailed schedule information

#### Info
- `energy-schedule.0.info.connection` (boolean) - Connection status to API

## Usage

### Basic Example (JavaScript)
```javascript
// Define energy requirements
setState('energy-schedule.0.requirements.energyDemand', 10);  // 10 kWh
setState('energy-schedule.0.requirements.maxLoad', 3500);     // 3500W
setState('energy-schedule.0.requirements.avgLoad', 2000);     // 2000W

// Create schedule
setState('energy-schedule.0.control.createSchedule', true);

// Monitor status
on('energy-schedule.0.status.isActive', function (obj) {
    if (obj.state.val) {
        log('Device should be turned on now');
    } else {
        log('Device should be turned off now');
    }
});
```

### Typical Values for Different Applications

#### Washing Machine
```javascript
energyDemand: 1.5,    // 1.5 kWh per wash cycle
maxLoad: 2200,        // 2200W maximum power
avgLoad: 1500,        // 1500W average power
activeHours: 2,       // 2 hours runtime
consecutiveHours: true // Must run continuously
```

#### Heat Pump
```javascript
energyDemand: 20,      // 20 kWh per day
maxLoad: 3000,         // 3000W maximum power
avgLoad: 2000,         // 2000W average power
activeHours: 8,        // 8 hours runtime
consecutiveHours: false // Can be interrupted
```

#### EV Charging
```javascript
energyDemand: 40,      // 40 kWh per charge
maxLoad: 11000,        // 11kW charging power
avgLoad: 7200,         // 7.2kW average power
activeHours: 6,        // 6 hours charging time
consecutiveHours: false // Can be interrupted
```

### Vis Integration

Example for a simple Vis widget:
```javascript
[{"tpl":"tplValueBoolean","data":{"oid":"energy-schedule.0.status.isActive","g_fixed":false,"g_visibility":false,"g_css_font_text":false,"g_css_background":false,"g_css_shadow_padding":false,"g_css_border":false,"g_gestures":false,"g_signals":false,"g_last_change":false,"visibility-cond":"==","visibility-val":1,"visibility-groups-action":"hide","signals-cond-0":"==","signals-val-0":true,"signals-icon-0":"/vis/signals/lowbattery.png","signals-icon-size-0":0,"signals-blink-0":false,"signals-horz-0":0,"signals-vert-0":0,"signals-hide-edit-0":false,"signals-cond-1":"==","signals-val-1":true,"signals-icon-1":"/vis/signals/lowbattery.png","signals-icon-size-1":0,"signals-blink-1":false,"signals-horz-1":0,"signals-vert-1":0,"signals-hide-edit-1":false,"signals-cond-2":"==","signals-val-2":true,"signals-icon-2":"/vis/signals/lowbattery.png","signals-icon-size-2":0,"signals-blink-2":false,"signals-horz-2":0,"signals-vert-2":0,"signals-hide-edit-2":false,"lc-type":"last-change","lc-is-interval":true,"lc-is-moment":false,"lc-format":"","lc-position-vert":"top","lc-position-horz":"right","lc-offset-vert":0,"lc-offset-horz":0,"lc-font-size":"12px","lc-font-family":"","lc-font-style":"","lc-bkg-color":"","lc-color":"","lc-border-width":"0","lc-border-style":"","lc-border-color":"","lc-border-radius":10,"lc-zindex":0,"title":"Status","showTitle":true}}]
```

## Limitations

- Only works in Germany (uses the GruenstromIndex)
- Requires a valid German postal code
- API rate limits may apply depending on access type

## Troubleshooting

### No Connection to API
- Check internet connection
- Verify entered postal code
- Check API token (if used)

### Schedule Not Created
- Check log outputs
- Ensure all requirements are set
- Verify configuration values

### Status Updates Missing
- Check connection status
- Look for error messages in logs
- Restart the adapter

## Changelog

### 1.0.0 (2024-11-01)
* (zoernert) Initial release

## License
MIT License

## Author
STROMDAO GmbH <dev@stromdao.com>
Gerhard Weiser Ring 29
69256 Mauer
Germany

Copyright (c) 2024 STROMDAO GmbH