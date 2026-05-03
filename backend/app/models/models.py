from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class User(Base):
    """Admin / operator user model for authentication."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False, default="admin")  # admin, operator
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.username}>"


class ParkingSlot(Base):
    """Parking slot management model."""

    __tablename__ = "parking_slots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slot_number = Column(String(10), unique=True, nullable=False, index=True)
    floor = Column(Integer, nullable=False, default=1)
    zone = Column(String(5), nullable=False, default="A")
    status = Column(String(20), nullable=False, default="available")  # available, occupied, reserved, blocked
    slot_type = Column(String(20), nullable=False, default="regular")  # regular, disabled, VIP, EV
    last_update = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    logs = relationship("ParkingLog", back_populates="slot", lazy="select")

    def __repr__(self):
        return f"<ParkingSlot {self.slot_number} [{self.status}]>"


class ParkingLog(Base):
    """Parking event log model — tracks vehicle enter/exit/violation/manual events."""

    __tablename__ = "parking_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id", ondelete="RESTRICT"), nullable=False, index=True)
    event = Column(String(30), nullable=False)  # vehicle_enter, vehicle_exit, violation, manual_update
    license_plate = Column(String(20), nullable=True)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    slot = relationship("ParkingSlot", back_populates="logs")

    def __repr__(self):
        return f"<ParkingLog {self.event} slot={self.slot_id}>"
