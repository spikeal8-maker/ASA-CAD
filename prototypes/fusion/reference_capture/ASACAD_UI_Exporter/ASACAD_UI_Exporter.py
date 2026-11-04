# ASA-CAD / Fusion UI inventory exporter, read-only.
# Runs only INSIDE Autodesk Fusion as a Python Script (adsk.core API).
# It does not execute commands, change preferences, or access model contents.
import adsk.core
import datetime
import json
import os
import traceback

SCRIPT_NAME = "ASACAD_UI_Exporter"
CAPTURE_DIR = os.path.join(
    os.path.expanduser("~"), "Documents", "ASA-CAD-Fusion-Captures"
)

def read(obj, property_name, default=None):
    if obj is None:
        return default
    try:
        value = getattr(obj, property_name)
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        return str(value)
    except Exception:
        return default

def elements(collection):
    if collection is None:
        return
    count = read(collection, "count", 0)
    for index in range(int(count or 0)):
        try:
            item = collection.item(index)
            if item is not None:
                yield item
        except Exception:
            continue

def command_definition(definition):
    if definition is None:
        return None
    return {
        "id": read(definition, "id"),
        "name": read(definition, "name"),
        "objectType": read(definition, "objectType"),
        "tooltip": read(definition, "tooltip"),
        "tooltipDescription": read(definition, "tooltipDescription"),
        "isNative": read(definition, "isNative"),
        "hasResourceFolder": bool(read(definition, "resourceFolder", "")),
        "controlDefinition": {
            "isEnabled": read(read_object(definition, "controlDefinition"), "isEnabled"),
            "isVisible": read(read_object(definition, "controlDefinition"), "isVisible")
        }
    }

def read_object(obj, property_name):
    try:
        return getattr(obj, property_name)
    except Exception:
        return None

def scan_controls(collection, depth=0):
    if collection is None or depth > 12:
        return []
    result = []
    for index, control in enumerate(elements(collection)):
        kind = str(read(control, "objectType", "")).rsplit("::", 1)[-1]
        item = {
            "index": index,
            "type": kind,
            "id": read(control, "id"),
            "name": read(control, "name"),
            "isVisible": read(control, "isVisible"),
            "isEnabled": read(control, "isEnabled"),
            "isPromoted": read(control, "isPromoted"),
            "isPromotedByDefault": read(control, "isPromotedByDefault")
        }
        definition = read_object(control, "commandDefinition")
        if definition is not None:
            item["commandDefinition"] = command_definition(definition)
        if kind == "DropDownControl":
            item["children"] = scan_controls(read_object(control, "controls"), depth+1)
        elif kind == "SplitButtonControl":
            item["defaultCommandDefinition"] = command_definition(
                read_object(control, "defaultCommandDefinition")
            )
            item["additionalDefinitions"] = [
                command_definition(definition)
                for definition in (
                    read_object(control, "additionalDefinitions") or []
                )
            ]
            item["showLastUsed"] = read(control, "showLastUsed")
        result.append(item)
    return result

def scan_panel(panel, index):
    promoted = read_object(panel, "promotedControls")
    return {
        "index": index,
        "id": read(panel, "id"),
        "name": read(panel, "name"),
        "isVisible": read(panel, "isVisible"),
        "isNative": read(panel, "isNative"),
        "promotedControlIds": [
            read(ctrl, "id") for ctrl in elements(promoted)
        ],
        "controls": scan_controls(read_object(panel, "controls"))
    }

def scan_toolbar(toolbar):
    return {
        "id": read(toolbar, "id"),
        "name": read(toolbar, "name"),
        "controls": scan_controls(read_object(toolbar, "controls"))
    }

def summarize(report):
    counts = {"workspaces": 0, "tabs": 0, "panels": 0,
              "buttons": 0, "dropDowns": 0, "splitButtons": 0,
              "separators": 0, "controlsTotal": 0}
    def visit_control(control):
        counts["controlsTotal"] += 1
        kind = control.get("type", "")
        key = {"CommandControl": "buttons",
               "DropDownControl": "dropDowns",
               "SplitButtonControl": "splitButtons",
               "SeparatorControl": "separators"}.get(kind)
        if key:
            counts[key] += 1
        for child in control.get("children", []):
            visit_control(child)
    counts["workspaces"] = len(report["workspaces"])
    for workspace in report["workspaces"]:
        counts["tabs"] += len(workspace["tabs"])
        for tab in workspace["tabs"]:
            counts["panels"] += len(tab["panels"])
            for panel in tab["panels"]:
                for control in panel["controls"]:
                    visit_control(control)
    for bar in report["toolbars"]:
        for control in bar["controls"]:
            visit_control(control)
    return counts

def run(context):
    app = adsk.core.Application.get()
    ui = app.userInterface
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc)
    report = {
        "schemaVersion": 1,
        "captureSource": "Autodesk Fusion API (read-only)",
        "capturedUTC": now.isoformat(),
        "applicationVersion": read(app, "version"),
        "activeWorkspaceId": read(read_object(ui, "activeWorkspace"), "id"),
        "activeToolbarTabId": read(read_object(ui, "activeToolbarTab"), "id"),
        "workspaces": [],
        "toolbars": [],
        "errors": []
    }
    try:
        for workspace in elements(ui.workspaces):
            ws = {
                "id": read(workspace, "id"),
                "name": read(workspace, "name"),
                "isVisible": read(workspace, "isVisible"),
                "isActive": read(workspace, "isActive"),
                "tabs": []
            }
            for tab in elements(read_object(workspace, "toolbarTabs")):
                tab_info = {
                    "id": read(tab, "id"),
                    "name": read(tab, "name"),
                    "isVisible": read(tab, "isVisible"),
                    "isActive": read(tab, "isActive"),
                    "panels": []
                }
                for index, panel in enumerate(elements(
                    read_object(tab, "toolbarPanels")
                )):
                    try:
                        tab_info["panels"].append(scan_panel(panel, index))
                    except Exception as exc:
                        report["errors"].append({
                            "scope": "panel",
                            "id": read(panel, "id"),
                            "reason": str(exc)
                        })
                ws["tabs"].append(tab_info)
            report["workspaces"].append(ws)
        for toolbar in elements(ui.toolbars):
            report["toolbars"].append(scan_toolbar(toolbar))
        report["counts"] = summarize(report)
        report["status"] = "completed"
    except Exception:
        report["status"] = "error"
        report["errors"].append({
            "scope": "export",
            "reason": traceback.format_exc()
        })
    output = os.path.join(CAPTURE_DIR, "fusion-ui-latest.json")
    temporary = output + ".writing"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    os.replace(temporary, output)
    dated = os.path.join(
        CAPTURE_DIR, "fusion-ui-" + now.strftime("%Y%m%d-%H%M%S") + ".json"
    )
    with open(dated, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    app.log(
        "ASA-CAD UI inventory: " + report["status"] + " -> " + output
    )
