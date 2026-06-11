# data/fetch_data.py
# Loads .env → queries InfluxDB → returns raw df

from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient
import pandas as pd

load_dotenv()

def fetch_raw_data():
    client = InfluxDBClient(
        url=os.getenv("INFLUX_URL"),
        token=os.getenv("INFLUX_TOKEN"),
        org=os.getenv("INFLUX_ORG")
    )
    bucket = os.getenv("INFLUX_BUCKET")
    query = f'''
    from(bucket: "{bucket}")
      |> range(start: -1d)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    df = client.query_api().query_data_frame(query)
    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)
    return df