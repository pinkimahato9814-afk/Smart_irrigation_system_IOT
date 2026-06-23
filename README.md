# Smart Soil Moisture Testing With Automated Irrigation

An IoT-based smart irrigation project built around an ESP32, a soil moisture sensor, Firebase Realtime Database, and a React dashboard. The system reads soil moisture in real time, classifies soil condition, automatically turns a water pump on or off through a relay, and publishes live readings to Firebase for remote monitoring.

This repository contains the code and analysis assets used for the project defense work at Acme Engineering College, Purbanchal University.

## Project Summary

Traditional irrigation often depends on manual checking or fixed schedules, which can waste water and increase labor. This project automates that process by:

- reading soil moisture from an analog sensor connected to the ESP32
- deciding whether the soil is wet, dry, or the probe is not properly placed
- turning the pump on automatically when the soil is dry
- pushing timestamped readings to Firebase Realtime Database
- showing the latest readings and recent trends in a web dashboard

## Current Features In This Repository

- ESP32 firmware for sensor reading, Wi-Fi connection, relay control, and Firebase upload
- three-state soil classification
- `GREEN`: soil moisture is acceptable
- `RED`: soil is dry and the pump is turned on
- `YELLOW`: probe is out of soil or the reading is abnormal
- Firebase Realtime Database logging with epoch and ISO timestamps
- React + Vite frontend for live monitoring
- dashboard cards for soil condition and pump status
- moisture trend graph with selectable history range
- CSV export helper and notebook assets for data analysis

## Repository Structure

```text
8thcollegproject/
|-- README.md
|-- Aurdino_code/
|   `-- aurdinofinalcodewithfirebase/
|       |-- moisture_firebase_realtime.ino
|       |-- moisture_types.h
|       `-- original_code.txt
|-- frontend_code/
|   `-- frontedcode/
|       |-- package.json
|       |-- src/
|       |   |-- App.jsx
|       |   |-- lib/firebase.js
|       |   `-- components/
|       `-- public/
`-- ML_model/
    |-- convert.py
    |-- moisture_readings.csv
    `-- ml_model.ipynb
```

## Technology Stack

### Hardware

- ESP32 microcontroller
- soil moisture sensor
- relay module
- water pump
- red, green, and yellow LEDs
- buzzer
- resistor, transistor, diode, and external power source

### Software

- Arduino IDE
- ESP32 board package
- Firebase Realtime Database
- React 19
- Vite
- Python with `pandas` for data conversion

## How The System Works

1. The soil moisture sensor sends an analog reading to the ESP32.
2. The ESP32 compares the reading against threshold values.
3. If the soil is dry, the relay activates the pump.
4. The ESP32 uploads the reading and pump state to Firebase.
5. The React dashboard listens to Firebase and updates in real time.

## Moisture Logic Used In Firmware

The firmware in `Aurdino_code/aurdinofinalcodewithfirebase/moisture_firebase_realtime.ino` currently uses:

- `raw >= 3600` -> `YELLOW`
- `2500 <= raw < 3600` -> `RED`
- `raw < 2500` -> `GREEN`

The relay is configured as active-low in the current code.

## Firebase Data Format

Each reading is stored under the `moisture_readings` node using the Unix epoch as the key. A typical record looks like this:

```json
{
  "raw": 2627,
  "status": "RED",
  "pump_on": true,
  "ts_epoch": 1770288173,
  "ts_iso": "2026-02-05 10:42:53",
  "ts_ms": 467804,
  "time_valid": true
}
```

## Frontend Setup

The frontend app is located in `frontend_code/frontedcode`.

### 1. Install dependencies

```bash
cd frontend_code/frontedcode
npm install
```

### 2. Create a `.env` file

Add the Firebase values used by your project:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
VITE_FIREBASE_AUTH_EMAIL=your_auth_email
VITE_FIREBASE_AUTH_PASSWORD=your_auth_password
```

### 3. Start the dashboard

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
```

## ESP32 Firmware Setup

The firmware is located in `Aurdino_code/aurdinofinalcodewithfirebase`.

### Requirements

- Arduino IDE
- ESP32 board package installed in Arduino IDE
- Firebase ESP Client library

### Steps

1. Open `moisture_firebase_realtime.ino` in Arduino IDE.
2. Select the correct ESP32 board and COM port.
3. Review and update Wi-Fi and Firebase credentials.
4. Connect the sensor, LEDs, relay, and pump according to your circuit.
5. Upload the sketch to the ESP32.
6. Open Serial Monitor at `115200` baud to verify readings and Firebase upload.

## Data Analysis Assets

The `ML_model` folder currently contains dataset conversion and analysis assets rather than a packaged trained model.

- `convert.py` converts a Firebase JSON export into CSV
- `moisture_readings.csv` contains exported readings
- `ml_model.ipynb` can be used for exploration or future model work

To generate a CSV from a Firebase export:

```bash
cd ML_model
python convert.py
```

Make sure the Firebase export file is present with the expected filename before running the script.

## Notes About Scope

This repository clearly contains the core smart irrigation implementation:

- ESP32 sensor and pump control
- Firebase real-time data logging
- React dashboard for monitoring

The project report also discusses broader ideas such as soil fertility sensing, Gmail alerts, WhatsApp alerts, and future machine learning improvements. Those items are part of the wider project direction, but not all of them are present as code in this repository snapshot.

## Known Limitations

- current implementation mainly monitors soil moisture only
- remote monitoring depends on Wi-Fi and Firebase availability
- thresholds are fixed in firmware and may need calibration for different soil types
- the repository includes a data-analysis folder, but not a finished predictive irrigation model

## Recommended Improvements

- move firmware secrets out of source code before sharing publicly
- add a hardware wiring diagram and screenshots to the repository
- add Firebase security rules documentation
- support configurable moisture thresholds from the dashboard
- extend the system with pH, NPK, EC, or weather-based logic

## Team

- Arina Maya Tuladhar
- Pinki Kumari
- Shushma Yogi
- Uttam Mukhiya

Supervisor: Er. Ramesh Prasad Basaula
