from __future__ import annotations

import os
import signal
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from pathlib import Path


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def wait_for_http(url: str, process: subprocess.Popen[str], logs: list[str], timeout: float = 45) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise AssertionError(f"Process exited before {url} was ready\n{''.join(logs[-100:])}")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status < 400:
                    return
        except Exception:
            time.sleep(0.15)
    raise AssertionError(f"Timed out waiting for {url}\n{''.join(logs[-100:])}")


def _wait_for_busabase_data_layer(
    base_url: str, process: subprocess.Popen[str], logs: list[str], timeout: float = 15
) -> None:
    """`/api/health` can answer before the data layer (DB/migrations) has
    settled under load, so a request landing in that gap gets a transient 500
    instead of a clean response -- e.g. GET /api/v1/nodes right after boot.
    Confirm one real read succeeds before treating the server as ready.
    """
    deadline = time.monotonic() + timeout
    last_status: int | str = "unreachable"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise AssertionError(f"Process exited before the data layer was ready\n{''.join(logs[-100:])}")
        try:
            with urllib.request.urlopen(f"{base_url}/api/v1/nodes?depth=1", timeout=2) as response:
                if response.status < 500:
                    return
                last_status = response.status
        except urllib.error.HTTPError as error:
            if error.code < 500:
                return
            last_status = error.code
        except Exception as error:
            last_status = str(error)
        time.sleep(0.2)
    raise AssertionError(
        f"Busabase data layer never became ready (last status: {last_status})\n{''.join(logs[-100:])}"
    )


@contextmanager
def managed_process(command: list[str], cwd: Path, env: dict[str, str], ready_url: str, timeout: float = 45):
    logs: list[str] = []
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env={**os.environ, **env},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )

    def collect() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            logs.append(line)
            if len(logs) > 500:
                del logs[:100]

    threading.Thread(target=collect, daemon=True).start()
    try:
        wait_for_http(ready_url, process, logs, timeout)
        if ready_url.endswith("/api/health"):
            _wait_for_busabase_data_layer(ready_url[: -len("/api/health")], process, logs)
        yield process, logs
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
