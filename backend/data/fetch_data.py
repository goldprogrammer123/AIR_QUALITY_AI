# data/fetch_data.py

from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient
import pandas as pd

load_dotenv()

def fetch_raw_data():
    client = InfluxDBClient(
        url=os.getenv("INFLUX_URL"),
        token=os.getenv("INFLUX_TOKEN"),
        org=os.getenv("INFLUX_ORG"),
        timeout=30000  # increase timeout
    )

    bucket = os.getenv("INFLUX_BUCKET")

    query = f'''
    from(bucket: "{bucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''

    df = client.query_api().query_data_frame(query)

    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)

    return df






































    

df = fetch_raw_data()

print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}")

print("Oldest:", df["_time"].min())
print("Newest:", df["_time"].max())

print(df.head())