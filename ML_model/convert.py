import json
import pandas as pd

# 1. Read Firebase JSON file
with open("smart-agriculture-9827-default-rtdb-export.json", "r", encoding="utf-8") as file:
    data = json.load(file)

# 2. Get moisture_readings data
readings = data["moisture_readings"]

# 3. Convert JSON object to table
df = pd.DataFrame.from_dict(readings, orient="index")

# 4. Add Firebase key as separate column
df.reset_index(inplace=True)
df.rename(columns={"index": "reading_id"}, inplace=True)

# 5. Save as CSV
df.to_csv("moisture_readings.csv", index=False)

print("CSV file created successfully!")