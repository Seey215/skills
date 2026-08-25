from __future__ import annotations

import json
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "tests" / "app-skills" / "harness"))

from runtime import free_port, managed_process

APP_ROOT = REPO_ROOT / "skills" / "kelly-wechat-crm" / "content" / "kelly-wechat-crm-app"
BUSABASE_VERSION = "0.19.0"
EXPECTED_RESOURCE_KEYS = [
    "app-root",
    "people",
    "groups",
    "relationship-snapshots",
    "goals",
    "actions",
    "worklog",
    "settings",
]


def assert_no_horizontal_overflow(page: Page) -> None:
    size = page.evaluate(
        """() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })"""
    )
    assert size["content"] <= size["viewport"] + 1, size


def attach_errors(page: Page) -> list[str]:
    errors: list[str] = []
    page.on("console", lambda message: errors.append(f"console: {message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    return errors


def read_json(url: str):
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.load(response)


def post_json(url: str, payload: dict):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def find_resource(nodes, key: str):
    for node in nodes:
        if (node.get("metadata") or {}).get("resourceKey") == key:
            return node
        found = find_resource(node.get("children") or [], key)
        if found:
            return found
    return None


def resource_keys(nodes) -> list[str]:
    keys: list[str] = []
    for node in nodes:
        key = (node.get("metadata") or {}).get("resourceKey")
        if key:
            keys.append(key)
        keys.extend(resource_keys(node.get("children") or []))
    return keys


def test_demo_ui(browser, base_url: str) -> None:
    desktop = browser.new_context(viewport={"width": 1280, "height": 820})
    page = desktop.new_page()
    errors = attach_errors(page)
    page.goto(f"{base_url}/?demo=1#/actions")
    page.wait_for_load_state("networkidle")
    assert page.locator(".record-row").count() == 4
    assert page.locator("#attentionValue").inner_text() == "3"
    assert_no_horizontal_overflow(page)

    page.locator(".record-row").first.click()
    page.locator("#reviewNote").fill("先确认近况，不直接发送消息。")
    page.locator("[data-action-status='approved']").click()
    page.locator(".action-notice").get_by_text("demo-change-").wait_for(timeout=5_000)
    assert "/actions/" in page.url

    page.goto(f"{base_url}/?demo=1#/goals")
    page.wait_for_load_state("networkidle")
    page.locator("#goalOpen").click()
    page.locator('#goalForm input[name="title"]').fill("维护张三的关系")
    page.locator('#goalForm textarea[name="objective"]').fill("恢复自然互动并了解他的近况。")
    page.locator("#goalScope").select_option("person")
    page.locator('#goalForm input[name="success_metric"]').fill("完成一次双方都有回应的交流")
    page.locator('#goalForm textarea[name="constraints"]').fill("尊重拒绝，不连续催促。")
    page.locator('#goalForm button[type="submit"]').click()
    page.locator("#goalModal").wait_for(state="hidden")
    assert "/goals/demo-goals-" in page.url

    page.locator("#settingsOpen").click()
    assert page.locator("#settingsModal").is_visible()
    page.locator("[data-settings-tab='resources']").click()
    assert page.locator("#settingsGrid").get_by_text("kelly-wechat-crm-actions").is_visible()
    page.locator("#settingsClose").click()
    page.locator("#sidebarClose").click()
    assert page.locator("body.sidebar-collapsed").count() == 1
    assert_no_horizontal_overflow(page)
    assert not errors, errors
    desktop.close()

    for width, height in ((390, 844), (360, 740)):
        mobile = browser.new_context(viewport={"width": width, "height": height})
        page = mobile.new_page()
        errors = attach_errors(page)
        page.goto(f"{base_url}/?demo=1#/actions")
        page.wait_for_load_state("networkidle")
        assert_no_horizontal_overflow(page)
        page.locator("#sidebarOpen").click()
        assert page.locator("body.sidebar-open").count() == 1
        assert page.locator("#sidebarScrim").is_visible()
        page.locator("#sidebarScrim").click(position={"x": width - 5, "y": 5})
        assert page.locator("body.sidebar-open").count() == 0
        page.locator(".record-row").first.click()
        assert page.locator("body.mobile-detail-open").count() == 1
        assert page.locator("#backButton").is_visible()
        assert_no_horizontal_overflow(page)
        page.locator("#backButton").click()
        assert page.locator("body.mobile-detail-open").count() == 0
        page.goto(f"{base_url}/?demo=1#/goals/new")
        page.wait_for_load_state("networkidle")
        assert page.locator("#goalModal").is_visible()
        assert page.locator("#goalTargetWrap").is_hidden()
        assert page.locator("#goalClose").is_visible()
        assert_no_horizontal_overflow(page)
        page.locator("#goalClose").click()
        page.locator("#mobileSettings").click()
        assert page.locator("#settingsModal").is_visible()
        assert_no_horizontal_overflow(page)
        page.locator("#settingsClose").click()
        assert not errors, errors
        mobile.close()


def test_oss_provisioning_and_review(browser) -> None:
    busabase_port = free_port()
    app_port = free_port()
    busabase_url = f"http://127.0.0.1:{busabase_port}"
    app_url = f"http://127.0.0.1:{app_port}"
    with tempfile.TemporaryDirectory(prefix="kelly-wechat-crm-busabase-") as data_dir:
        busabase_command = [
            "npx",
            "-y",
            f"busabase@{BUSABASE_VERSION}",
            "server",
            "--host",
            "127.0.0.1",
            "--port",
            str(busabase_port),
            "--data",
            data_dir,
        ]
        with managed_process(busabase_command, REPO_ROOT, {}, f"{busabase_url}/api/health", timeout=90):
            with tempfile.TemporaryDirectory(prefix="kelly-wechat-crm-home-") as app_home:
                app_env = {"BUSABASE_BASE_URL": busabase_url, "HOME": app_home, "PORT": str(app_port)}
                with managed_process(["node", "server.js"], APP_ROOT, app_env, f"{app_url}/health"):
                    context = browser.new_context(viewport={"width": 1280, "height": 820})
                    page = context.new_page()
                    errors = attach_errors(page)
                    page.goto(f"{app_url}/#/actions")
                    page.wait_for_load_state("networkidle")
                    page.locator("[data-provision]").wait_for(state="visible", timeout=10_000)
                    page.locator("[data-provision]").click()
                    page.wait_for_selector("[data-provision]", state="detached", timeout=20_000)
                    page.wait_for_timeout(800)
                    assert page.locator(".record-row").count() == 0
                    assert_no_horizontal_overflow(page)
                    assert not errors, errors
                    context.close()

                nodes = read_json(f"{busabase_url}/api/v1/nodes?depth=2")
                assert sorted(resource_keys(nodes)) == sorted(EXPECTED_RESOURCE_KEYS), nodes
                people = find_resource(nodes, "people")
                actions = find_resource(nodes, "actions")
                assert people and actions

                person_cr = post_json(
                    f"{busabase_url}/api/v1/bases/{people['baseId']}/change-requests",
                    {
                        "fields": {
                            "display-name": "验收联系人",
                            "username": "wxid_acceptance",
                            "wechat-remark": "老朋友",
                            "relationship-type": "friend",
                            "relationship-strength": 68,
                            "relationship-trend": "stable",
                        },
                        "message": "Seed WeChat CRM acceptance person",
                        "submittedBy": "kelly-skills-test",
                    },
                )
                post_json(
                    f"{busabase_url}/api/v1/change-requests/merge",
                    {"changeRequestIds": [person_cr["id"]]},
                )
                person_records = read_json(f"{busabase_url}/api/v1/records?baseId={people['baseId']}")
                person_items = person_records if isinstance(person_records, list) else person_records.get("records", [])
                person_id = person_items[0]["id"]
                action_cr = post_json(
                    f"{busabase_url}/api/v1/bases/{actions['baseId']}/change-requests",
                    {
                        "fields": {
                            "title": "验收联系人：需要人工判断",
                            "person": [person_id],
                            "action-type": "reconnect",
                            "rationale": "八天未联系，适合先恢复自然交流。",
                            "suggested-message": "最近怎么样？",
                            "evidence-summary": "八天未联系。",
                            "priority": "medium",
                            "confidence": 0.7,
                            "status": "needs-review",
                        },
                        "message": "Seed WeChat CRM acceptance action",
                        "submittedBy": "kelly-skills-test",
                    },
                )
                post_json(
                    f"{busabase_url}/api/v1/change-requests/merge",
                    {"changeRequestIds": [action_cr["id"]]},
                )

                app_port = free_port()
                app_url = f"http://127.0.0.1:{app_port}"
                app_env["PORT"] = str(app_port)
                with managed_process(["node", "server.js"], APP_ROOT, app_env, f"{app_url}/health"):
                    context = browser.new_context(viewport={"width": 390, "height": 844})
                    page = context.new_page()
                    errors = attach_errors(page)
                    page.goto(f"{app_url}/#/actions")
                    page.wait_for_load_state("networkidle")
                    card = page.locator(".record-row", has_text="验收联系人：需要人工判断")
                    card.click()
                    page.locator("#reviewNote").fill("真实验收只提交 CR。")
                    page.locator("[data-action-status='approved']").click()
                    page.locator(".action-notice").get_by_text("ChangeRequest").wait_for(timeout=10_000)
                    page.goto(f"{app_url}/#/goals")
                    page.wait_for_load_state("networkidle")
                    page.locator("#goalOpen").click()
                    page.locator('#goalForm input[name="title"]').fill("验收动态目标")
                    page.locator('#goalForm textarea[name="objective"]').fill("验证目标能通过 AirApp 提交 CR。")
                    page.locator('#goalForm button[type="submit"]').click()
                    page.locator("#goalFormStatus").get_by_text("ChangeRequest").wait_for(timeout=10_000)
                    assert_no_horizontal_overflow(page)
                    assert not errors, errors
                    context.close()

                requests = read_json(f"{busabase_url}/api/v1/change-requests")["changeRequests"]
                decision_requests = [
                    item
                    for item in requests
                    if "Review relationship action"
                    in (((item.get("primaryOperation") or {}).get("headCommit") or {}).get("message") or "")
                ]
                assert len(decision_requests) == 1, requests
                assert decision_requests[0]["status"] == "in_review", decision_requests[0]
                goal_requests = [
                    item
                    for item in requests
                    if "Create relationship goal: 验收动态目标"
                    in (((item.get("primaryOperation") or {}).get("headCommit") or {}).get("message") or "")
                ]
                assert len(goal_requests) == 1, requests
                assert goal_requests[0]["status"] == "in_review", goal_requests[0]

        with managed_process(busabase_command, REPO_ROOT, {}, f"{busabase_url}/api/health", timeout=90):
            nodes = read_json(f"{busabase_url}/api/v1/nodes?depth=2")
            assert sorted(resource_keys(nodes)) == sorted(EXPECTED_RESOURCE_KEYS)
            actions = find_resource(nodes, "actions")
            encoded = urllib.parse.urlencode({"baseId": actions["baseId"]})
            rows = read_json(f"{busabase_url}/api/v1/records?{encoded}")
            assert len(rows if isinstance(rows, list) else rows.get("records", [])) == 1


def main() -> None:
    app_port = free_port()
    app_url = f"http://127.0.0.1:{app_port}"
    with tempfile.TemporaryDirectory(prefix="kelly-wechat-crm-demo-home-") as home:
        with managed_process(
            ["node", "server.js"],
            APP_ROOT,
            {"HOME": home, "PORT": str(app_port)},
            f"{app_url}/health",
        ):
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                test_demo_ui(browser, app_url)
                test_oss_provisioning_and_review(browser)
                browser.close()


if __name__ == "__main__":
    main()
