#!/bin/bash

# Get the current commit message
ORIGINAL_MSG="$(git log --format=%B -n 1)"

# Replace \n with actual newlines
FIXED_MSG="$(echo "$ORIGINAL_MSG" | sed 's/\\n/\
/g')"

# If the message was changed, amend it
if [ "$ORIGINAL_MSG" != "$FIXED_MSG" ]; then
    echo "Fixing commit message..."
    git commit --amend -m "$FIXED_MSG"
fi
