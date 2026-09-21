#!/usr/bin/env bash
R=/home/unexpected/.cache/gltest-direct
echo "R=[$R]"
ls -la "$R" | head -20
find "$R" -maxdepth 4 -type d 2>/dev/null | head -50
find "$R" -name '*nippy*' 2>/dev/null | head
