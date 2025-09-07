#!/bin/sh

# Entrypoint for claudo container
# Automatically adds --dangerously-skip-permissions flag

# If first argument is 'claude', add the dangerous permissions flag
if [ "$1" = "claude" ]; then
    # Check if --dangerously-skip-permissions is already present
    if echo "$*" | grep -q -- "--dangerously-skip-permissions"; then
        exec "$@"
    else
        exec claude --dangerously-skip-permissions "${@:2}"
    fi
else
    # For other commands, pass through as-is
    exec "$@"
fi