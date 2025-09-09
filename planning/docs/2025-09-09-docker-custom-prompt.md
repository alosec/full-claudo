# Test Docker Custom Prompt

Please test the custom prompt functionality in Docker by running:

```bash
claudo plan --prompt-file=./test-docker-prompt.md "confirm environment"
```

The test-docker-prompt.md file should make the agent respond with:
"Custom prompt loaded! Running in Docker mode."

This will confirm that:
1. The claudo command works inside Docker
2. Custom prompt files are accessible
3. The execution context detection is working

After running the test, please report the results.