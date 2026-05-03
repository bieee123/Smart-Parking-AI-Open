"""Seed the database with an admin user and initial parking slots."""

import sys
import os

# Ensure the project root is on the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.models.models import User, ParkingSlot
from app.middleware.auth import hash_password


def seed_admin(db: Session):
    """Create default admin user if it doesn't exist."""
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        print("  ⏭  Admin user already exists")
        return

    admin = User(
        username="admin",
        email="admin@smartparking.io",
        password_hash=hash_password("admin123"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    print("  ✅ Admin user created (username: admin, password: admin123)")


def seed_slots(db: Session):
    """Create default parking slots if none exist."""
    count = db.query(ParkingSlot).count()
    if count > 0:
        print(f"  ⏭  {count} parking slots already exist")
        return

    slots = []
    for floor in range(1, 3):  # 2 floors
        for zone in ["A", "B"]:
            for num in range(1, 11):  # 10 slots per zone
                slot_number = f"{zone}{floor}-{num:02d}"
                slots.append(
                    ParkingSlot(
                        slot_number=slot_number,
                        floor=floor,
                        zone=zone,
                        status="available",
                        slot_type="regular",
                    )
                )

    # Add a few special slots
    slots.append(ParkingSlot(slot_number="A1-VP01", floor=1, zone="A", status="available", slot_type="VIP"))
    slots.append(ParkingSlot(slot_number="A1-EV01", floor=1, zone="A", status="available", slot_type="EV"))
    slots.append(ParkingSlot(slot_number="A1-DS01", floor=1, zone="A", status="available", slot_type="disabled"))

    db.add_all(slots)
    db.commit()
    print(f"  ✅ {len(slots)} parking slots created")


def main():
    print("\n🌱 Seeding database...")

    # Drop old tables and recreate (migration from old Node.js schema)
    print("  🔄 Ensuring schema is up to date...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("  ✅ Tables created/refreshed")

    db = SessionLocal()
    try:
        seed_admin(db)
        seed_slots(db)
    except Exception as e:
        db.rollback()
        print(f"  ❌ Seeding failed: {e}")
        raise
    finally:
        db.close()

    print("🎉 Seeding complete!\n")


if __name__ == "__main__":
    main()
