#!/usr/bin/env python3
import json, sys, subprocess

data = json.load(sys.stdin)

# Loop guard: if we already blocked once and Claude is in forced-continue,
# let it stop so it can't spin forever.
if data.get("stop_hook_active"):
    sys.exit(0)

# Replace "npm test" with YOUR real command (the esbuild bundle + Node tests).
result = subprocess.run(
    ["npm", "test"], capture_output=True, text=True, timeout=300
)

if result.returncode != 0:
    tail = (result.stdout + result.stderr)[-1500:]
    print(json.dumps({
        "decision": "block",
        "reason": f"Tests/build failed — fix before finishing.\n\n{tail}"
    }))
    sys.exit(0)

sys.exit(0)