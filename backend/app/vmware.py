"""VMware vSphere / ESXi service integration via pyVmomi.
Connects directly to configured VMware hosts for live inventory and power control.
Never logs or exposes credentials.
"""
import logging
import ssl
from dataclasses import dataclass

log = logging.getLogger("nexus.vmware")

@dataclass
class VMInfo:
    uuid: str
    name: str
    guest_os: str
    power_state: str
    cpu: int
    ram_mb: int
    storage_gb: int
    ip_address: str
    host: str
    datastore: str

class VMwareError(Exception):
    """Clean, user-safe error message from VMware operations."""
    pass

class PyVmomiProvider:
    def __init__(self, host: str, user: str, pwd: str, verify_tls: bool = True):
        self.host = host.strip() if host else ""
        self.user = user.strip() if user else ""
        self.pwd = pwd
        self.verify = verify_tls

    def _sanitize(self, msg: str) -> str:
        """Strip passwords or sensitive host info from exception text."""
        if not msg:
            return ""
        if self.pwd and self.pwd in msg:
            msg = msg.replace(self.pwd, "******")
        return msg.strip()

    def _connect(self):
        import socket
        try:
            from pyVim.connect import SmartConnect
            from pyVmomi import vim
        except ImportError:
            raise VMwareError("pyVmomi library is not installed in the backend environment.")

        ctx = ssl.create_default_context() if self.verify else ssl._create_unverified_context()
        try:
            return SmartConnect(host=self.host, user=self.user, pwd=self.pwd, sslContext=ctx)
        except vim.fault.InvalidLogin:
            raise VMwareError("Authentication failed: invalid vCenter or ESXi username or password.")
        except vim.fault.NoPermission as e:
            raise VMwareError(f"Permission denied on VMware host: {getattr(e, 'msg', 'insufficient privileges')}.")
        except (ssl.SSLCertVerificationError, ssl.SSLError) as e:
            err_str = str(e)
            if "certificate verify failed" in err_str.lower() or isinstance(e, ssl.SSLCertVerificationError):
                raise VMwareError(
                    f"TLS certificate verification failed for '{self.host}'. "
                    f"The host uses a self-signed or untrusted certificate. "
                    f"Uncheck 'Verify TLS' if connecting to a development or self-signed host."
                )
            raise VMwareError(f"TLS/SSL handshake failed with '{self.host}': {self._sanitize(err_str)}.")
        except socket.gaierror as e:
            raise VMwareError(
                f"DNS resolution failed: unable to resolve hostname '{self.host}'. "
                f"Please verify the hostname in your DNS server or local /etc/hosts file."
            )
        except ConnectionRefusedError:
            raise VMwareError(
                f"Connection refused: host '{self.host}' is reachable, but port 443 is closed or not accepting connections."
            )
        except (socket.timeout, TimeoutError):
            raise VMwareError(
                f"Connection timed out: host '{self.host}:443' did not respond within the timeout window."
            )
        except OSError as e:
            if getattr(e, "errno", None) == 65 or "No route to host" in str(e):
                raise VMwareError(
                    f"No route to host '{self.host}': the host IP is not reachable on the local network or subnet."
                )
            err_str = self._sanitize(str(e))
            if "certificate verify failed" in err_str.lower():
                raise VMwareError(
                    f"TLS certificate verification failed for '{self.host}'. "
                    f"The host uses a self-signed or untrusted certificate. "
                    f"Uncheck 'Verify TLS' if connecting to a development or self-signed host."
                )
            raise VMwareError(f"Network error connecting to '{self.host}:443': {getattr(e, 'strerror', None) or err_str}.")
        except Exception as e:
            err = self._sanitize(str(e))
            if "certificate verify failed" in err.lower():
                raise VMwareError(
                    f"TLS certificate verification failed for '{self.host}'. "
                    f"The host uses a self-signed or untrusted certificate. "
                    f"Uncheck 'Verify TLS' if connecting to a development or self-signed host."
                )
            raise VMwareError(f"VMware connection failed: {err or type(e).__name__}")

    def test(self) -> str:
        """Test connection and return real VMware host/vCenter version string."""
        from pyVim.connect import Disconnect
        si = self._connect()
        try:
            version_str = str(si.content.about.fullName)
            return version_str
        except VMwareError:
            raise
        except Exception as e:
            raise VMwareError(f"Failed to query VMware host information: {self._sanitize(str(e))}")
        finally:
            try:
                Disconnect(si)
            except Exception:
                pass

    def list_vms(self) -> list[VMInfo]:
        """Fetch real virtual machines from connected VMware host."""
        from pyVim.connect import Disconnect
        from pyVmomi import vim
        si = self._connect()
        out: list[VMInfo] = []
        try:
            content = si.content
            view = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
            try:
                for vm in view.view:
                    try:
                        c = vm.config
                        if not c or c.template:
                            continue

                        # Extract persistent unique identifier
                        vm_uuid = getattr(c, "instanceUuid", None) or getattr(c, "uuid", None)
                        if not vm_uuid and hasattr(vm, "summary") and vm.summary.config:
                            vm_uuid = vm.summary.config.uuid
                        if not vm_uuid:
                            vm_uuid = getattr(vm, "_moId", None)
                        if not vm_uuid:
                            continue

                        # Storage calculation from disks
                        disks = [d for d in c.hardware.device if isinstance(d, vim.vm.device.VirtualDisk)] if (c.hardware and c.hardware.device) else []
                        storage_gb = int(sum(getattr(d, "capacityInKB", 0) for d in disks) / 1048576)

                        # Power state
                        p_state = "off"
                        if vm.runtime and getattr(vm.runtime, "powerState", "") == "poweredOn":
                            p_state = "on"

                        # Guest OS & IP
                        guest_os = getattr(c, "guestFullName", "") or ""
                        ip_addr = ""
                        if vm.guest and getattr(vm.guest, "ipAddress", None):
                            ip_addr = str(vm.guest.ipAddress)

                        # Host name
                        host_name = ""
                        if vm.runtime and vm.runtime.host and hasattr(vm.runtime.host, "name"):
                            host_name = str(vm.runtime.host.name or "")

                        # Datastore name
                        ds_name = ""
                        if vm.datastore and len(vm.datastore) > 0 and hasattr(vm.datastore[0], "name"):
                            ds_name = str(vm.datastore[0].name or "")

                        out.append(VMInfo(
                            uuid=str(vm_uuid),
                            name=str(vm.name),
                            guest_os=str(guest_os),
                            power_state=p_state,
                            cpu=int(c.hardware.numCPU if c.hardware else 1),
                            ram_mb=int(c.hardware.memoryMB if c.hardware else 1024),
                            storage_gb=storage_gb,
                            ip_address=ip_addr,
                            host=host_name,
                            datastore=ds_name
                        ))
                    except Exception as vm_err:
                        log.debug("Skipping unparseable VM entry: %s", vm_err)
                        continue
            finally:
                try:
                    view.Destroy()
                except Exception:
                    pass
        except VMwareError:
            raise
        except Exception as e:
            raise VMwareError(f"Failed to retrieve virtual machine inventory: {self._sanitize(str(e))}")
        finally:
            try:
                Disconnect(si)
            except Exception:
                pass
        return out

    def _find(self, si, uuid: str):
        from pyVmomi import vim
        vm = si.content.searchIndex.FindByUuid(None, uuid, True, True)
        if not vm:
            # Fallback search by instance UUID
            vm = si.content.searchIndex.FindByUuid(None, uuid, True, False)
        if not vm:
            raise VMwareError(f"Virtual machine '{uuid}' not found on VMware host.")
        return vm

    def power(self, vm_row, action: str) -> str:
        """Execute real power operation on VMware host."""
        from pyVim.connect import Disconnect
        from pyVim.task import WaitForTask
        from pyVmomi import vim
        si = self._connect()
        try:
            vm = self._find(si, vm_row.uuid)
            st = getattr(vm.runtime, "powerState", "")
            if action == "start":
                if st == "poweredOn":
                    return "on"
                task = vm.PowerOnVM_Task()
            elif action == "stop":
                if st == "poweredOff":
                    return "off"
                task = vm.PowerOffVM_Task()
            elif action == "restart":
                task = vm.ResetVM_Task()
            else:
                raise VMwareError(f"Invalid power action: '{action}'.")

            result = WaitForTask(task)
            if result != "success" and hasattr(task.info, "error") and task.info.error:
                raise VMwareError(f"Power {action} task failed: {task.info.error.msg}")
            return "off" if action == "stop" else "on"
        except vim.fault.VimFault as e:
            raise VMwareError(f"VMware power task rejected: {getattr(e, 'msg', str(e))}")
        except VMwareError:
            raise
        except Exception as e:
            raise VMwareError(f"Power operation failed: {self._sanitize(str(e))}")
        finally:
            try:
                Disconnect(si)
            except Exception:
                pass

    def console_ticket(self, vm_row) -> dict:
        """Acquire single-use WebMKS ticket from VMware host."""
        from pyVim.connect import Disconnect
        from pyVmomi import vim
        si = self._connect()
        try:
            vm = self._find(si, vm_row.uuid)
            try:
                t = vm.AcquireTicket("webmks")
            except vim.fault.VimFault as e:
                raise VMwareError(f"WebMKS console ticket not supported by target host: {getattr(e, 'msg', str(e))}")
            except Exception as e:
                raise VMwareError(f"Could not acquire console ticket: {self._sanitize(str(e))}")

            h = getattr(t, "host", None) or self.host
            return {
                "host": h,
                "port": getattr(t, "port", 443),
                "ticket": getattr(t, "ticket", ""),
                "thumbprint": getattr(t, "sslThumbprint", "") or "",
                "url": f"wss://{h}:{getattr(t, 'port', 443)}/ticket/{getattr(t, 'ticket', '')}"
            }
        except VMwareError:
            raise
        except Exception as e:
            raise VMwareError(f"Console ticket acquisition failed: {self._sanitize(str(e))}")
        finally:
            try:
                Disconnect(si)
            except Exception:
                pass
