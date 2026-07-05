from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from db.database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, nullable=False, index=True)
    email           = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, nullable=False, default="user")  # "user" | "admin"
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)


class ModelHistory(Base):
    __tablename__ = "model_history"

    id           = Column(Integer, primary_key=True, index=True)
    model_name   = Column(String, nullable=False, index=True)   # regression | trend | lstm_forecast
    sensor       = Column(String, nullable=False, index=True)   # lands | planning
    dataset_size = Column(Integer, nullable=True)
    r2           = Column(Float, nullable=True)
    mae          = Column(Float, nullable=True)
    rmse         = Column(Float, nullable=True)
    trained_at   = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
