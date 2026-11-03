#!/usr/bin/env python3
"""Safely purges any leftover demo/simulated virtual machines and assignments without affecting users or production tables."""
import os, sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db import SessionLocal
from app.models import VirtualMachine, VmAssignment, AuditLog, User

def cleanup():
    with SessionLocal() as db:
        demo_vms = db.query(VirtualMachine).filter(
            (VirtualMachine.source == 'demo') | 
            (VirtualMachine.name.like('demo-%')) |
            (VirtualMachine.host.like('%simulated%'))
        ).all()
        demo_vm_ids = [v.id for v in demo_vms]
        if demo_vm_ids:
            asgs = db.query(VmAssignment).filter(VmAssignment.vm_id.in_(demo_vm_ids)).delete(synchronize_session=False)
            logs = db.query(AuditLog).filter(AuditLog.detail.like('%SIMULATED%')).delete(synchronize_session=False)
            vms = db.query(VirtualMachine).filter(VirtualMachine.id.in_(demo_vm_ids)).delete(synchronize_session=False)
            db.commit()
            print(f"Cleaned up {vms} demo VMs, {asgs} assignments, and {logs} simulated log entries.")
        else:
            print("No demo virtual machines found. Database is already clean.")

        vm_count = db.query(VirtualMachine).count()
        user_count = db.query(User).count()
        print(f"Current DB state: {vm_count} virtual machines, {user_count} users.")

if __name__ == "__main__":
    cleanup()

