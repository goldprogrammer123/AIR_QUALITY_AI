from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient
import pandas as pd

# Load variables from .env
load_dotenv()

# Read variables
url = os.getenv("INFLUX_URL")
token = os.getenv("INFLUX_TOKEN")
org = os.getenv("INFLUX_ORG")
bucket = os.getenv("INFLUX_BUCKET")

# Connect to InfluxDB
client = InfluxDBClient(
    url=url,
    token=token,
    org=org
)

query_api = client.query_api()

print("Connected successfully!")
