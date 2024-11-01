# iobroker.energy-schedule

[![NPM version](https://img.shields.io/npm/v/iobroker.energy-schedule.svg)](https://www.npmjs.com/package/iobroker.energy-schedule)
[![Downloads](https://img.shields.io/npm/dm/iobroker.energy-schedule.svg)](https://www.npmjs.com/package/iobroker.energy-schedule)

Der Energy Schedule Adapter ermöglicht die intelligente Planung von Energieverbrauch basierend auf dem Corrently [GrünstromIndex](https://gruenstromindex.de/). Er ist speziell für den deutschen Energiemarkt entwickelt und hilft dabei, Geräte zu optimalen Zeiten zu betreiben - sei es für niedrigere Kosten, geringeren CO2-Ausstoß oder maximalen Komfort.

## Features

- Optimierung nach verschiedenen Kriterien (Preis, CO2, Komfort)
- Flexible Zeitplanung mit konfigurierbaren aktiven Stunden
- Unterstützung für aufeinanderfolgende und nicht-aufeinanderfolgende Betriebszeiten
- Echtzeit-Statusüberwachung
- Persistente Zeitplan-Verfolgung
- Einfache Boolean-Ausgabe für Gerätesteuerung
- Detaillierte Zeitplan-Informationen für erweiterte Anwendungsfälle

## Installation

1. Den Adapter über die ioBroker Admin-Oberfläche installieren
   - Im Adapter-Tab nach "energy-schedule" suchen
   - Auf "+" klicken um eine neue Instanz zu erstellen

2. Alternativ über npm:
```bash
npm install iobroker.energy-schedule
```

## Konfiguration

### Adapter-Einstellungen

| Einstellung | Beschreibung | Standard |
|-------------|--------------|----------|
| ZIP (Postleitzahl) | Deutsche Postleitzahl für den Standort | - |
| Personal Token | Persönlicher API-Token von console.corrently.io (optional) | - |
| Law (Optimierung) | Optimierungsstrategie (comfort/price/co2) | comfort |
| Active Hours | Anzahl der aktiven Stunden | 1 |
| Coverage Hours | Planungszeitraum in Stunden | 24 |
| Consecutive Hours | Müssen Stunden aufeinanderfolgend sein? | true |

### States

#### Requirements (Schreibbar)
- `energy-schedule.0.requirements.energyDemand` (number) - Benötigte Energie in kWh
- `energy-schedule.0.requirements.maxLoad` (number) - Maximale Leistung in Watt
- `energy-schedule.0.requirements.avgLoad` (number) - Durchschnittliche Leistung in Watt

#### Control
- `energy-schedule.0.control.createSchedule` (boolean) - Zeitplan erstellen

#### Status (Lesbar)
- `energy-schedule.0.status.isActive` (boolean) - Ist der Zeitplan aktiv?
- `energy-schedule.0.status.nextSwitch` (string) - Nächster Schaltzeitpunkt
- `energy-schedule.0.status.scheduleId` (string) - Aktuelle Zeitplan-ID
- `energy-schedule.0.status.scheduleDetails` (string) - Detaillierte Zeitplan-Informationen

#### Info
- `energy-schedule.0.info.connection` (boolean) - Verbindungsstatus zur API

## Verwendung

### Basis-Beispiel (JavaScript)
```javascript
// Energiebedarf definieren
setState('energy-schedule.0.requirements.energyDemand', 10);  // 10 kWh
setState('energy-schedule.0.requirements.maxLoad', 3500);     // 3500W
setState('energy-schedule.0.requirements.avgLoad', 2000);     // 2000W

// Zeitplan erstellen
setState('energy-schedule.0.control.createSchedule', true);

// Status überwachen
on('energy-schedule.0.status.isActive', function (obj) {
    if (obj.state.val) {
        log('Gerät sollte jetzt eingeschaltet werden');
    } else {
        log('Gerät sollte jetzt ausgeschaltet werden');
    }
});
```

### Typische Werte für verschiedene Anwendungen

#### Waschmaschine
```javascript
energyDemand: 1.5,    // 1.5 kWh pro Waschgang
maxLoad: 2200,        // 2200W maximale Leistung
avgLoad: 1500,        // 1500W durchschnittliche Leistung
activeHours: 2,       // 2 Stunden Laufzeit
consecutiveHours: true // Muss am Stück laufen
```

#### Wärmepumpe
```javascript
energyDemand: 20,      // 20 kWh pro Tag
maxLoad: 3000,         // 3000W maximale Leistung
avgLoad: 2000,         // 2000W durchschnittliche Leistung
activeHours: 8,        // 8 Stunden Laufzeit
consecutiveHours: false // Kann unterbrochen werden
```

#### E-Auto Laden
```javascript
energyDemand: 40,      // 40 kWh für eine Ladung
maxLoad: 11000,        // 11kW Ladeleistung
avgLoad: 7200,         // 7.2kW durchschnittliche Leistung
activeHours: 6,        // 6 Stunden Ladezeit
consecutiveHours: false // Kann unterbrochen werden
```

### Vis-Integration

Beispiel für ein einfaches Vis-Widget:
```javascript
[{"tpl":"tplValueBoolean","data":{"oid":"energy-schedule.0.status.isActive","g_fixed":false,"g_visibility":false,"g_css_font_text":false,"g_css_background":false,"g_css_shadow_padding":false,"g_css_border":false,"g_gestures":false,"g_signals":false,"g_last_change":false,"visibility-cond":"==","visibility-val":1,"visibility-groups-action":"hide","signals-cond-0":"==","signals-val-0":true,"signals-icon-0":"/vis/signals/lowbattery.png","signals-icon-size-0":0,"signals-blink-0":false,"signals-horz-0":0,"signals-vert-0":0,"signals-hide-edit-0":false,"signals-cond-1":"==","signals-val-1":true,"signals-icon-1":"/vis/signals/lowbattery.png","signals-icon-size-1":0,"signals-blink-1":false,"signals-horz-1":0,"signals-vert-1":0,"signals-hide-edit-1":false,"signals-cond-2":"==","signals-val-2":true,"signals-icon-2":"/vis/signals/lowbattery.png","signals-icon-size-2":0,"signals-blink-2":false,"signals-horz-2":0,"signals-vert-2":0,"signals-hide-edit-2":false,"lc-type":"last-change","lc-is-interval":true,"lc-is-moment":false,"lc-format":"","lc-position-vert":"top","lc-position-horz":"right","lc-offset-vert":0,"lc-offset-horz":0,"lc-font-size":"12px","lc-font-family":"","lc-font-style":"","lc-bkg-color":"","lc-color":"","lc-border-width":"0","lc-border-style":"","lc-border-color":"","lc-border-radius":10,"lc-zindex":0,"title":"Status","showTitle":true}}]
```

## Beschränkungen

- Funktioniert nur in Deutschland (nutzt den GrünstromIndex)
- Benötigt eine gültige deutsche Postleitzahl
- API-Ratenlimits können je nach Zugangsart gelten

## Troubleshooting

### Keine Verbindung zur API
- Prüfen Sie die Internetverbindung
- Überprüfen Sie die eingegebene Postleitzahl
- Prüfen Sie den API-Token (falls verwendet)

### Schedule wird nicht erstellt
- Prüfen Sie die Log-Ausgaben
- Stellen Sie sicher, dass alle Requirements gesetzt sind
- Überprüfen Sie die Konfigurationswerte

### Status-Updates bleiben aus
- Prüfen Sie den Connection-Status
- Schauen Sie in die Logs nach Fehlermeldungen
- Starten Sie den Adapter neu

## Changelog

### 1.0.0 (2024-11-01)
* (zoernert) Erstveröffentlichung

## Lizenz
MIT License

## Author
STROMDAO GmbH <dev@stromdao.com>
Gerhard Weiser Ring 29
69256 Mauer
Deutschland

Copyright (c) 2024 STROMDAO GmbH