from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient
import pandas as pd
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

load_dotenv()

client = InfluxDBClient(
    url=os.getenv("INFLUX_URL"),
    token=os.getenv("INFLUX_TOKEN"),
    org=os.getenv("INFLUX_ORG")
)

bucket = os.getenv("INFLUX_BUCKET")

query = f'''
from(bucket: "{bucket}")
  |> range(start: -30d)
  |> filter(fn: (r) =>
    r._measurement == "temperature" or
    r._measurement == "humidity" or
    r._measurement == "pressure" or
    r._measurement == "co2" or
    r._measurement == "pm25" or
    r._measurement == "pm10" or
      r._measurement == "no2" or
    r._measurement == "so2"
  )
  |> pivot(
      rowKey: ["_time"],
      columnKey: ["_measurement"],
      valueColumn: "_value"
  )
'''

df = client.query_api().query_data_frame(query)

# If multiple tables → merge
if isinstance(df, list):
    df = pd.concat(df, ignore_index=True)

    print(df.head())
print(df.tail())
print(df.columns)
print("Rows:", len(df))

    # CLEAN
df = df.drop(columns=[
    "result",
    "table",
    "_start",
    "_stop",
    "_field"
], errors="ignore")

# fixing time 
df["_time"] = pd.to_datetime(df["_time"])
df["hour"] = df["_time"].dt.hour
df["day"] = df["_time"].dt.day
df["month"] = df["_time"].dt.month
df = df.drop(columns=["_time"])

print("Rows after pivot:", len(df))

print(df.isna().sum())
#  handle missing values 
df = df.dropna()

# remove overflow and noise data 
df = df[(df["co2"] < 5000) & (df["pm25"] < 1000)]

# print(df.head())
# print(df.columns)

# Simple AQI approximation formula:



# AQI CALCULATION
def compute_aqi(concentration, breakpoints):
    """
    breakpoints = list of tuples:
    (C_low, C_high, I_low, I_high)
    """
    for C_lo, C_hi, I_lo, I_hi in breakpoints:
        if C_lo <= concentration <= C_hi:
            return ((I_hi - I_lo) / (C_hi - C_lo)) * (concentration - C_lo) + I_lo
    return 500  # fallback if extreme pollution

# EPA breakpoint for pm2.5 
pm25_bp = [
    (0.0, 12.0, 0, 50),
    (12.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 150.4, 151, 200),
    (150.5, 250.4, 201, 300),
    (250.5, 350.4, 301, 400),
    (350.5, 500.4, 401, 500)
]

#EPA for PM10.
pm10_bp = [
    (0, 54, 0, 50),
    (55, 154, 51, 100),
    (155, 254, 101, 150),
    (255, 354, 151, 200),
    (355, 424, 201, 300),
    (425, 504, 301, 400),
    (505, 604, 401, 500)
]

df["no2_ppb"] = df["no2"] * 1000
df["so2_ppb"] = df["so2"] * 1000

# AQI FOR NO2
no2_bp = [
    (0, 53, 0, 50),
    (54, 100, 51, 100),
    (101, 360, 101, 150),
    (361, 649, 151, 200),
    (650, 1249, 201, 300),
    (1250, 1649, 301, 400),
    (1650, 2049, 401, 500)
]

# AQI for SO2
so2_bp = [
    (0, 35, 0, 50),
    (36, 75, 51, 100),
    (76, 185, 101, 150),
    (186, 304, 151, 200),
    (305, 604, 201, 300),
    (605, 804, 301, 400),
    (805, 1004, 401, 500)
]

df["aqi_pm25"] = df["pm25"].apply(lambda x: compute_aqi(x, pm25_bp))
df["aqi_pm10"] = df["pm10"].apply(lambda x: compute_aqi(x, pm10_bp))
df["aqi_no2"] = df["no2"].apply(lambda x: compute_aqi(x, no2_bp))
df["aqi_so2"] = df["so2"].apply(lambda x: compute_aqi(x, so2_bp))

df["aqi"] = df[
    [
        "aqi_pm25",
        "aqi_pm10",
        "aqi_no2",
        "aqi_so2"
    ]
].max(axis=1)

# Prepare ML Dataset
X = df[
    [
        "co2",
        "humidity",
        "pm10",
        "pm25",
        "no2",
        "so2",
        "pressure",
        "temperature",
        "hour",
        "day",
        "month"
    ]
]

y = df["aqi"]

print(df["aqi"].describe())

print("Rows:", len(df))

# splitting the dataset and Training the model 
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42
)

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=20,
    random_state=42
)

model.fit(X_train, y_train)

print("Model trained successfully!")

# feature importance 
importance = pd.DataFrame({
    "feature": X.columns,
    "importance": model.feature_importances_
})

print(
    importance.sort_values(
        by="importance",
        ascending=False
    )
)
# Model prediction

preds = model.predict(X_test)

print(preds[:5])
print(y_test[:5].values)

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np

preds = model.predict(X_test)

# model evaluation
mae = mean_absolute_error(y_test, preds)
mse = mean_squared_error(y_test, preds)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, preds)

print("\n📊 MODEL EVALUATION")
print("MAE  =", mae)
print("MSE  =", mse)
print("RMSE =", rmse)
print("R2   =", r2)

joblib.dump(model, "aqi_model.pkl")