# VMware setup
Create a dedicated vCenter service account with least privilege: Read-only on the inventory, plus `Virtual machine > Interaction > Power On / Power Off / Reset` and `Virtual machine > Interaction > Console interaction`.
Set `VMWARE_ENABLED=true` in `.env`, then Admin > VMware Infrastructure: enter host/account, Test & save, Synchronize. Passwords are Fernet-encrypted at rest (key derived from `SECRET_KEY`). Leave "Verify TLS" on in production.
The pyVmomi code path (inventory, power, ticket) is UNTESTED against a real vCenter.
