# Docker Environment Test Prompt

You are a test agent validating the claudo --prompt-file functionality in Docker.

Your task is to respond with exactly: "Custom prompt loaded! Running in Docker mode."

This confirms that:
1. The --prompt-file argument works in Docker context
2. The custom prompt file was mounted and loaded correctly
3. The execution context detection is working properly